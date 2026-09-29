import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type NextFunction, type Request, type Response } from 'express'
import { deepSeekConfig, enrichTools, type AiToolInput } from './ai.js'
import { analysisBacklog, runAnalysisBatch, selectAnalysisBatch } from './analysis.js'
import { planMining, runMiningBatch } from './mining.js'
import { applyAiPatches, enableCandidatePersistence, findPoolEntryById, listPool, poolStats, upsertCandidates } from './candidates.js'
import {
  candidateToTool,
  candidateToRepo,
  githubDiscoveryConnector,
  githubRequest,
  isUsableRepo,
  parseGitHubRepository,
  repoToCandidate,
  repoToTool,
  type GitHubRepo,
  type GitHubRequestError,
  type GitHubSearchResult,
} from './connectors/github.js'
import { connectorStatuses } from './connectors/index.js'
import {
  getTelegramPublicChannels,
  saveTelegramPublicChannels,
  syncTelegramPublicChannels,
  telegramPublicStatus,
} from './connectors/telegram-public.js'
import { eventCount, eventStats, listEvents, recordEvents, type UserEventInput } from './events.js'
import {
  buildInterestProfile,
  hasProfile,
  rankCandidates,
  summarizeProfile,
} from './recommend.js'
import { sourceRegistry } from './sources.js'
import { listStaged, stagingStats, updateStagedStatus, type StagedStatus } from './staging.js'
import { resolveDataDir } from './store.js'
import { disconnectTelegram, startTelegramLogin, telegramLoginStatus, telegramStatus } from './telegram.js'

const app = express()
const port = Number(process.env.PORT ?? 8787)
const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dataDir = resolveDataDir()
enableCandidatePersistence(path.join(dataDir, 'candidates.json'))
const sessionSecretFile = process.env.SESSION_SECRET_FILE ?? path.join(dataDir, 'session-secret')
const githubClientId = process.env.GITHUB_CLIENT_ID
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET
const githubCallbackUrl = process.env.GITHUB_CALLBACK_URL ?? `http://127.0.0.1:${port}/api/auth/github/callback`

type GitHubUser = {
  login: string
  name: string | null
  avatar_url: string
}

type Session = {
  accessToken: string
  refreshToken?: string
  accessTokenExpiresAt?: number
  refreshTokenExpiresAt?: number
  user: GitHubUser
  createdAt: number
}

const sessions = new Map<string, Session>()
const oauthStates = new Map<string, number>()

function getSessionKey() {
  fs.mkdirSync(dataDir, { recursive: true })
  const configuredSecret = process.env.SESSION_SECRET
  if (configuredSecret) return crypto.createHash('sha256').update(configuredSecret).digest()
  if (!fs.existsSync(sessionSecretFile)) fs.writeFileSync(sessionSecretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 })
  return crypto.createHash('sha256').update(fs.readFileSync(sessionSecretFile, 'utf8').trim()).digest()
}

const sessionKey = getSessionKey()

type SavedSession = {
  id: string
  iv: string
  authTag: string
  payload: string
}

function encryptSession(session: Session): Omit<SavedSession, 'id'> {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv)
  const payload = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()])
  return { iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex'), payload: payload.toString('base64') }
}

function decryptSession(saved: SavedSession) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey, Buffer.from(saved.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(saved.authTag, 'hex'))
    const payload = Buffer.concat([decipher.update(Buffer.from(saved.payload, 'base64')), decipher.final()]).toString('utf8')
    return JSON.parse(payload) as Session
  } catch {
    return undefined
  }
}

function persistSessions() {
  const file = path.join(dataDir, 'sessions.json')
  const temporary = `${file}.tmp`
  const saved = [...sessions.entries()].map(([id, session]) => ({ id, ...encryptSession(session) }))
  fs.writeFileSync(temporary, JSON.stringify(saved), { mode: 0o600 })
  fs.renameSync(temporary, file)
}

function restoreSessions() {
  const file = path.join(dataDir, 'sessions.json')
  if (!fs.existsSync(file)) return
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as SavedSession[]
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    for (const item of saved) {
      const session = decryptSession(item)
      if (session && session.createdAt > cutoff) sessions.set(item.id, session)
    }
    persistSessions()
  } catch {
    console.warn('OpenRadar 无法读取已有 GitHub 会话，将从空会话开始。')
  }
}

restoreSessions()

app.use(express.json({ limit: '200kb' }))

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch(next)
  }
}

function parseCookies(request: Request) {
  return Object.fromEntries(
    (request.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=')
        return [decodeURIComponent(part.slice(0, separator)), decodeURIComponent(part.slice(separator + 1))]
      }),
  )
}

function setCookie(response: Response, name: string, value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.append('Set-Cookie', `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`)
}

function getSession(request: Request) {
  const id = parseCookies(request).openradar_session
  return id ? sessions.get(id) : undefined
}

/**
 * 取一个已保存的 GitHub 会话，给没有 Cookie 的后台任务用（暂存区回采、定时同步）。
 *
 * 为什么需要：`getSession` 依赖浏览器 Cookie，而后台批量任务没有浏览器。
 * 之前回填接口也走 Cookie，所以从命令行触发时永远拿不到 Token，只能靠
 * 未认证的 60 次/小时，1271 个仓库要跑 21 小时。
 *
 * 安全性：这是单用户本地工具，API 只监听 127.0.0.1，而且 data/sessions.json
 * 本来就在本机磁盘上、token 也是加密的——所以这不额外扩大攻击面。
 * 但仍然只在服务端内部使用，不通过任何接口把会话内容暴露出去。
 */
function getStoredSession(): Session | undefined {
  let newest: Session | undefined
  for (const session of sessions.values()) {
    if (!newest || session.createdAt > newest.createdAt) newest = session
  }
  return newest
}

/** 优先用请求里的会话，其次回落到本机保存的会话。拿不到 Token 就返回 undefined。 */
async function resolveGitHubToken(request: Request): Promise<string | undefined> {
  const session = getSession(request) ?? getStoredSession()
  if (!session) return undefined
  try {
    return await refreshSessionIfNeeded(session)
  } catch {
    return undefined
  }
}

async function refreshSession(session: Session) {
  if (!session.refreshToken || !githubClientId || !githubClientSecret) return session.accessToken
  if (session.refreshTokenExpiresAt && session.refreshTokenExpiresAt <= Date.now()) {
    throw Object.assign(new Error('GitHub 连接已过期，请重新连接一次。'), { status: 401 })
  }
  const body = new URLSearchParams({
    client_id: githubClientId,
    client_secret: githubClientSecret,
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
  })
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'OpenRadar-Personal' },
    body,
  })
  const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number; error?: string }
  if (!response.ok || !data.access_token) throw Object.assign(new Error('GitHub 连接已过期，请重新连接一次。'), { status: 401 })
  session.accessToken = data.access_token
  if (data.refresh_token) session.refreshToken = data.refresh_token
  if (data.expires_in) session.accessTokenExpiresAt = Date.now() + data.expires_in * 1000
  if (data.refresh_token_expires_in) session.refreshTokenExpiresAt = Date.now() + data.refresh_token_expires_in * 1000
  persistSessions()
  return session.accessToken
}

/**
 * 把本地加密会话翻译成 GitHub Token，并处理 401 刷新。
 * 真正的 HTTP 调用在 connectors/github.ts，会话逻辑不外泄到连接器。
 */
async function githubFetch<T>(endpoint: string, tokenOrSession?: string | Session, init?: RequestInit): Promise<T> {
  const session = typeof tokenOrSession === 'object' ? tokenOrSession : undefined
  const plainToken = typeof tokenOrSession === 'string' ? tokenOrSession : undefined
  const token = session ? await refreshSessionIfNeeded(session) : plainToken

  try {
    return await githubRequest<T>(endpoint, token, init)
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 401 && session?.refreshToken) {
      const refreshedToken = await refreshSession(session)
      return githubRequest<T>(endpoint, refreshedToken, init)
    }
    throw error
  }
}

async function refreshSessionIfNeeded(session: Session) {
  if (!session.accessTokenExpiresAt || session.accessTokenExpiresAt > Date.now() + 60_000) return session.accessToken
  return refreshSession(session)
}

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'openradar-api',
    /**
     * 是否跑在隔离的数据目录里（设了 OPENRADAR_DATA_DIR）。
     *
     * 暴露这个标志是为了让 npm run smoke 能拒绝往真实数据里写测试内容。
     * 之前「以为隔离了、其实没隔离」导致测试候选和事件直接写进了用户真实画像，
     * 见交接手册的隔离事故记录。
     */
    isolated: Boolean(process.env.OPENRADAR_DATA_DIR),
  })
})

app.get('/api/ai/config', (_request, response) => {
  response.json({ provider: 'deepseek', configured: deepSeekConfig.configured, model: deepSeekConfig.model })
})

app.post('/api/ai/enrich', asyncRoute(async (request, response) => {
  const tools = Array.isArray(request.body?.tools) ? request.body.tools.slice(0, 8) as AiToolInput[] : []
  if (tools.length === 0) {
    response.status(400).json({ error: '没有可分析的项目。' })
    return
  }
  if (!deepSeekConfig.configured) {
    response.json({ provider: 'deepseek', configured: false, patches: [] })
    return
  }
  const patches = await enrichTools(tools)
  const stored = applyAiPatches(patches)
  response.json({ provider: 'deepseek', configured: true, model: deepSeekConfig.model, patches, stored })
}))

/**
 * 暂存区回采状态。只读，不发请求。
 */
app.get('/api/mining/status', (_request, response) => {
  const plan = planMining()
  response.json({
    ...plan,
    githubConnected: Boolean(getStoredSession()),
  })
})

/**
 * 跑一批回采：把暂存区里从未入池的 GitHub 项目抓成候选。
 *
 * 和 /api/analysis/run 一样默认 dryRun，必须显式传 `"dryRun": false` 才会真的抓。
 * 天生可续跑：已入池的会被 canonicalUrl 去重跳过。
 */
app.post('/api/mining/run', asyncRoute(async (request, response) => {
  const token = await resolveGitHubToken(request)
  const result = await runMiningBatch({
    limit: request.body?.limit,
    token,
    dryRun: request.body?.dryRun !== false,
  })
  response.json({ ...result, authenticated: Boolean(token) })
}))

/**
 * 分析队列状态。只报告积压和批次计划，不发任何请求。
 * `configured: false` 时 nextBatch 仍然会列出来，方便先看清工作量再决定要不要配 Key。
 */
app.get('/api/analysis/status', (_request, response) => {
  const backlog = analysisBacklog()
  response.json({
    configured: deepSeekConfig.configured,
    provider: 'deepseek',
    model: deepSeekConfig.model,
    backlog,
    nextBatch: selectAnalysisBatch().map((entry) => ({
      id: entry.candidate.sourceItemId ?? entry.canonicalUrl,
      title: entry.candidate.title ?? null,
      sourceKind: entry.candidate.sourceKind,
      sourceId: entry.candidate.sourceId,
    })),
  })
})

/**
 * 跑一批分析。
 *
 * 默认是 dryRun，必须显式传 `"dryRun": false` 才会真的调用 DeepSeek 并写回候选池。
 * 这样误触接口不会一下子消耗掉一批额度。
 */
app.post('/api/analysis/run', asyncRoute(async (request, response) => {
  const result = await runAnalysisBatch({
    limit: request.body?.limit,
    dryRun: request.body?.dryRun !== false,
  })
  response.status(result.error ? 502 : 200).json(result)
}))

app.get('/api/github/config', (request, response) => {
  const session = getSession(request)
  response.json({
    oauthConfigured: Boolean(githubClientId && githubClientSecret),
    connected: Boolean(session),
    user: session?.user ?? null,
  })
})

app.get('/api/sources', asyncRoute(async (_request, response) => {
  response.json({ sources: sourceRegistry, connectors: await connectorStatuses() })
}))

/** 记录用户行为。丢一条埋点不应该影响用户正在做的事，所以部分非法条目只跳过不报错。 */
app.post('/api/events', (request, response) => {
  const raw = Array.isArray(request.body?.events) ? request.body.events : Array.isArray(request.body) ? request.body : [request.body]
  const inputs = raw.filter((item: unknown): item is UserEventInput => Boolean(item) && typeof item === 'object')
  const result = recordEvents(inputs)
  response.json({ stored: result.stored.length, rejected: result.rejected, stats: eventStats() })
})

app.get('/api/events', (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit ?? 20), 1), 200)
  response.json({
    stats: eventStats(),
    items: listEvents(limit).map((item) => ({
      toolId: item.toolId,
      event: item.event,
      sourceId: item.sourceId ?? null,
      tags: item.tags ?? [],
      occurredAt: item.occurredAt,
    })),
  })
})

/** 兴趣画像。只返回推导结果和计数，不返回原始事件 id。 */
app.get('/api/profile', (_request, response) => {
  const profile = buildInterestProfile(listEvents())
  response.json({
    ...summarizeProfile(profile),
    eventCount: eventCount(),
    profile: {
      tagWeights: profile.tagWeights,
      sourceKindWeights: profile.sourceKindWeights,
      sourceIdWeights: profile.sourceIdWeights,
      positiveCount: profile.positiveCount,
      negativeCount: profile.negativeCount,
      skippedCount: profile.skippedToolIds.length,
      dismissedCount: profile.dismissedToolIds.length,
    },
  })
})

/**
 * 从候选池出推荐。这是候选池第一次真正参与排序：
 * 评分 → 硬规则降权 → 多样性重排 → 渲染卡片。
 */
app.get('/api/recommend', (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit ?? 12), 1), 50)
  const profile = buildInterestProfile(listEvents())
  const entries = listPool(300)
  const ranked = rankCandidates(entries, profile, { limit })

  const tools = ranked
    .map((item) => {
      const tool = candidateToTool(item.candidate)
      if (!tool) return undefined
      return {
        ...tool,
      }
    })
    .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool))

  response.json({
    source: 'candidate-pool',
    hasProfile: hasProfile(profile),
    updatedAt: profile.updatedAt,
    considered: entries.length,
    tools,
  })
})

function decodeFeedCursor(raw: unknown) {
  if (typeof raw !== 'string' || !raw) return 0
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { offset?: number }
    return Number.isFinite(parsed.offset) ? Math.max(0, Math.trunc(parsed.offset ?? 0)) : 0
  } catch { return 0 }
}

function encodeFeedCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset })).toString('base64url')
}

/** 面向首页的持续浏览流：只返回可展示卡片，不暴露内部评分和推荐理由。 */
app.get('/api/feed', (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit ?? 20), 1), 50)
  const entries = listPool(100_000)
  const profile = buildInterestProfile(listEvents())
  const ready = entries.filter((entry) => !entry.candidate.status || entry.candidate.status === 'ready' || entry.candidate.status === 'analyzed')
  const ranked = rankCandidates(ready, profile, { limit: ready.length })
  const offset = decodeFeedCursor(request.query.cursor)
  const page = ranked.slice(offset, offset + limit)
  const tools = page.map((item) => candidateToTool(item.candidate)).filter((tool): tool is NonNullable<typeof tool> => Boolean(tool))
  const nextOffset = offset + page.length
  response.json({
    source: 'candidate-feed',
    hasProfile: hasProfile(profile),
    items: tools,
    nextCursor: nextOffset < ranked.length ? encodeFeedCursor(nextOffset) : null,
    hasMore: nextOffset < ranked.length,
    considered: ready.length,
    pending: entries.filter((entry) => entry.candidate.status === 'pending' || entry.candidate.status === 'staged').length,
  })
})

/** 反馈是行为事件的产品化别名，保留同一套兴趣画像权重。 */
app.post('/api/feedback', (request, response) => {
  const toolId = String(request.body?.projectId ?? request.body?.toolId ?? '').trim()
  const event = String(request.body?.event ?? '').trim() as UserEventInput['event']
  if (!toolId || !['like', 'save', 'star', 'compare', 'similar', 'skip', 'dismiss', 'view', 'open_source'].includes(event)) {
    response.status(400).json({ error: '项目或反馈类型不正确。' })
    return
  }
  const result = recordEvents([{
    toolId,
    event,
    sourceKind: typeof request.body?.sourceKind === 'string' ? request.body.sourceKind : undefined,
    sourceId: typeof request.body?.sourceId === 'string' ? request.body.sourceId : undefined,
    tags: Array.isArray(request.body?.tags) ? request.body.tags : undefined,
  }])
  response.json({ stored: result.stored.length, profile: summarizeProfile(buildInterestProfile(listEvents())) })
})

app.get('/api/projects/:id/related', asyncRoute(async (request, response) => {
  const id = decodeURIComponent(String(request.params.id))
  const entry = findPoolEntryById(id)
  if (!entry) {
    response.status(404).json({ error: '没有找到这个项目。' })
    return
  }
  const repo = candidateToRepo(entry.candidate)
  if (repo) {
    const session = getSession(request)
    const topic = repo.topics?.[0]
    const qualifiers = [topic ? 'topic:' + topic : '', repo.language ? 'language:' + repo.language : '', 'stars:>100'].filter(Boolean).join(' ')
    const result = await githubFetch<GitHubSearchResult>('/search/repositories?q=' + encodeURIComponent(qualifiers) + '&sort=stars&order=desc&per_page=12', session)
    const usable = result.items.filter((item) => item.full_name !== repo.full_name && isUsableRepo(item)).slice(0, 8)
    const pool = upsertCandidates(usable.map((item) => repoToCandidate(item, 'github-similar', '相似项目')))
    response.json({ source: repo.full_name, tools: usable.map((item) => repoToTool(item, 'GitHub 项目', 'github-similar')), pool: { size: pool.poolSize, added: pool.addedCount, duplicates: pool.duplicateCount } })
    return
  }
  const tags = new Set(entry.candidate.tags ?? [])
  const related = listPool(100_000).filter((item) => item.canonicalUrl !== entry.canonicalUrl && (item.candidate.tags ?? []).some((tag) => tags.has(tag))).slice(0, 8)
  response.json({ source: entry.candidate.title ?? entry.canonicalUrl, tools: related.map((item) => candidateToTool(item.candidate)).filter((tool): tool is NonNullable<typeof tool> => Boolean(tool)) })
}))

/** 候选池状态。只暴露地址和计数，不暴露任何凭证。 */
app.get('/api/candidates', (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit ?? 20), 1), 100)
  response.json({
    stats: poolStats(),
    items: listPool(limit).map((entry) => ({
      canonicalUrl: entry.canonicalUrl,
      title: entry.candidate.title ?? null,
      sourceKind: entry.candidate.sourceKind,
      sourceIds: entry.sourceIds,
      seenCount: entry.seenCount,
      firstSeenAt: entry.firstSeenAt,
      lastSeenAt: entry.lastSeenAt,
    })),
  })
})

/** 原始来源暂存区：批量抓取先进入这里，不直接污染推荐流。 */
app.get('/api/staging', (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 200)
  const rawStatus = String(request.query.status ?? '')
  const status = ['new', 'ready', 'dismissed', 'filtered'].includes(rawStatus) ? rawStatus as StagedStatus : undefined
  response.json({ stats: stagingStats(), items: listStaged(limit, status) })
})

app.patch('/api/staging/:id', (request, response) => {
  const status = String(request.body?.status ?? '')
  if (!['new', 'ready', 'dismissed', 'filtered'].includes(status)) {
    response.status(400).json({ error: '暂存状态不正确。' })
    return
  }
  const item = updateStagedStatus(String(request.params.id), status as StagedStatus)
  if (!item) {
    response.status(404).json({ error: '没有找到这条暂存内容。' })
    return
  }
  response.json({ item, stats: stagingStats() })
})

app.get('/api/telegram/config', asyncRoute(async (_request, response) => {
  response.json(await telegramStatus())
}))

app.post('/api/telegram/login/start', asyncRoute(async (_request, response) => {
  response.json(await startTelegramLogin())
}))

app.get('/api/telegram/login/:id', asyncRoute(async (request, response) => {
  response.json(await telegramLoginStatus(String(request.params.id)))
}))

app.post('/api/telegram/logout', asyncRoute(async (_request, response) => {
  await disconnectTelegram()
  response.status(204).end()
}))

/**
 * 公开频道路线不依赖 Telegram API：用户只需粘贴公开频道链接，配置保存在
 * data/telegram-web/channels.json。同步结果会进入统一候选池。
 */
app.get('/api/telegram/public/status', (_request, response) => {
  response.json(telegramPublicStatus())
})

app.put('/api/telegram/public/channels', (request, response) => {
  const raw = Array.isArray(request.body?.channels) ? request.body.channels : []
  if (raw.length > 50 || raw.some((item: unknown) => typeof item !== 'string')) {
    response.status(400).json({ error: '频道数量或格式不正确，最多保存 50 个公开频道。' })
    return
  }
  try {
    const channels = saveTelegramPublicChannels(raw)
    response.json({ channels, status: telegramPublicStatus() })
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

app.post('/api/telegram/public/sync', asyncRoute(async (request, response) => {
  const rawChannels = Array.isArray(request.body?.channels) ? request.body.channels as string[] : undefined
  if (rawChannels && rawChannels.some((item) => typeof item !== 'string')) {
    response.status(400).json({ error: '频道格式不正确。' })
    return
  }
  const session = getSession(request)
  const result = await syncTelegramPublicChannels({
    channels: rawChannels,
    limit: Math.min(Math.max(Number(request.body?.limit ?? 40), 1), 100),
    pages: Math.min(Math.max(Number(request.body?.pages ?? 3), 1), 10),
    token: session ? await refreshSessionIfNeeded(session) : undefined,
  })
  const pool = upsertCandidates(result.candidates)
  response.json({
    source: result.source,
    channels: result.channels,
    messagesRead: result.messagesRead,
    channelResults: result.channelResults,
    candidates: result.candidates.map(candidateToTool).filter((tool): tool is NonNullable<typeof tool> => Boolean(tool)),
    pool: { size: pool.poolSize, added: pool.addedCount, duplicates: pool.duplicateCount },
    status: telegramPublicStatus(),
  })
}))

app.get('/api/github/stars', asyncRoute(async (request, response) => {
  const username = String(request.query.username ?? '').trim()
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) {
    response.status(400).json({ error: '请输入正确的 GitHub 用户名。' })
    return
  }
  const repos = await githubFetch<GitHubRepo[]>(`/users/${encodeURIComponent(username)}/starred?per_page=30&sort=created&direction=desc`)
  const usable = repos.filter(isUsableRepo)
  upsertCandidates(usable.map((repo) => repoToCandidate(repo, 'github-stars', '我的 GitHub Star')))
  response.json({ username, tools: usable.map((repo) => repoToTool(repo, 'GitHub 项目', 'github-stars')) })
}))

app.get('/api/github/me/stars', asyncRoute(async (request, response) => {
  const session = getSession(request)
  if (!session) {
    response.status(401).json({ error: '请先连接 GitHub。' })
    return
  }
  const repos = await githubFetch<GitHubRepo[]>('/user/starred?per_page=30&sort=created&direction=desc', session)
  const usable = repos.filter(isUsableRepo)
  upsertCandidates(usable.map((repo) => repoToCandidate(repo, 'github-stars', '我的 GitHub Star')))
  response.json({ username: session.user.login, tools: usable.map((repo) => repoToTool(repo, 'GitHub 项目', 'github-stars')) })
}))

app.post('/api/github/repository', asyncRoute(async (request, response) => {
  const { owner, repo } = parseGitHubRepository(String(request.body?.url ?? ''))
  const session = getSession(request)
  const result = await githubFetch<GitHubRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, session)
  const pool = upsertCandidates([repoToCandidate(result, 'manual', '我丢一个链接')])
  response.json({ tool: repoToTool(result, 'GitHub 项目', 'manual'), pool: { size: pool.poolSize, added: pool.addedCount, duplicates: pool.duplicateCount } })
}))

app.get('/api/github/similar', asyncRoute(async (request, response) => {
  const owner = String(request.query.owner ?? '')
  const repo = String(request.query.repo ?? '')
  if (!owner || !repo) {
    response.status(400).json({ error: '缺少项目名称。' })
    return
  }
  const session = getSession(request)
  const source = await githubFetch<GitHubRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, session)
  const topic = source.topics?.[0]
  const qualifiers = [topic ? `topic:${topic}` : '', source.language ? `language:${source.language}` : '', 'stars:>100'].filter(Boolean).join(' ')
  const result = await githubFetch<GitHubSearchResult>(`/search/repositories?q=${encodeURIComponent(qualifiers)}&sort=stars&order=desc&per_page=12`, session)
  const usable = result.items.filter((item) => item.full_name !== source.full_name && isUsableRepo(item)).slice(0, 8)
  upsertCandidates(usable.map((item) => repoToCandidate(item, 'github-similar', '相似项目')))
  response.json({ source: source.full_name, tools: usable.map((item) => repoToTool(item, 'GitHub 项目', 'github-similar')) })
}))

/**
 * 统一入口：路由只负责鉴权、限流和把结果送进候选池，
 * 真正的抓取逻辑在 server/connectors/。
 * 卡片由候选池里的 Candidate 反向渲染，而不是直接用原始 API 对象。
 */
app.get('/api/discover/github', asyncRoute(async (request, response) => {
  const customQuery = String(request.query.q ?? '').trim()
  const session = getSession(request)
  const { candidates } = await githubDiscoveryConnector.fetchCandidates({
    limit: 24,
    query: customQuery || undefined,
    auth: { token: session ? await refreshSessionIfNeeded(session) : undefined },
  })
  const pool = upsertCandidates(candidates)
  const tools = candidates.map(candidateToTool).filter((tool): tool is NonNullable<typeof tool> => Boolean(tool))
  response.json({
    source: 'github-discovery',
    query: customQuery || 'stars:>500 且最近 180 天有更新',
    tools,
    pool: { size: pool.poolSize, added: pool.addedCount, duplicates: pool.duplicateCount },
  })
}))

/** 回填 Telegram 或其他来源因 GitHub 限流而暂存的项目。 */
app.post('/api/github/backfill', asyncRoute(async (request, response) => {
  const session = getSession(request) ?? getStoredSession()
  const limit = Math.min(Math.max(Number(request.body?.limit ?? 20), 1), 50)
  const pending = listPool(100_000).filter((entry) => entry.candidate.status === 'pending').slice(0, limit)
  let updated = 0
  let failed = 0
  let rateLimited = false
  let rateLimitResetAt: string | undefined

  for (const entry of pending) {
    const metadata = (entry.candidate.metadata ?? {}) as { owner?: string; name?: string }
    if (!metadata.owner || !metadata.name) { failed += 1; continue }
    try {
      const repo = await githubFetch<GitHubRepo>('/repos/' + encodeURIComponent(metadata.owner) + '/' + encodeURIComponent(metadata.name), session)
      if (!isUsableRepo(repo)) { failed += 1; continue }
      upsertCandidates([repoToCandidate(repo, entry.candidate.sourceId, entry.candidate.sourceLabel)])
      updated += 1
    } catch (error) {
      // 限流不是「这个项目坏了」。立刻停下来，剩下的留到额度恢复后再回填，
      // 否则一次限流会把整批正常项目都记成失败，报告完全失真。
      if ((error as GitHubRequestError).rateLimited) {
        rateLimited = true
        rateLimitResetAt = (error as GitHubRequestError).rateLimitResetAt
        break
      }
      failed += 1
    }
  }

  const remaining = listPool(100_000).filter((entry) => entry.candidate.status === 'pending').length
  response.json({
    attempted: pending.length,
    updated,
    failed,
    rateLimited,
    rateLimitResetAt: rateLimitResetAt ?? null,
    remaining,
    message: rateLimited
      ? `GitHub 额度用完了，本批在 ${updated} 个成功后就停下，剩下的 ${remaining} 个等额度恢复后再回填。`
      : `本批处理 ${pending.length} 个，成功 ${updated} 个，失败 ${failed} 个，剩余 ${remaining} 个待回填。`,
  })
}))

app.put('/api/github/star/:owner/:repo', asyncRoute(async (request, response) => {
  const session = getSession(request)
  if (!session) {
    response.status(401).json({ error: '请先连接 GitHub，才能同步 Star。' })
    return
  }
  await githubFetch<void>(`/user/starred/${encodeURIComponent(String(request.params.owner))}/${encodeURIComponent(String(request.params.repo))}`, session, { method: 'PUT' })
  response.status(204).end()
}))

app.delete('/api/github/star/:owner/:repo', asyncRoute(async (request, response) => {
  const session = getSession(request)
  if (!session) {
    response.status(401).json({ error: '请先连接 GitHub，才能同步 Star。' })
    return
  }
  await githubFetch<void>(`/user/starred/${encodeURIComponent(String(request.params.owner))}/${encodeURIComponent(String(request.params.repo))}`, session, { method: 'DELETE' })
  response.status(204).end()
}))

app.get('/api/auth/github/start', (request, response) => {
  if (!githubClientId || !githubClientSecret) {
    response.status(503).send('GitHub OAuth 尚未配置，请先填写 .env。')
    return
  }
  const state = crypto.randomBytes(24).toString('hex')
  oauthStates.set(state, Date.now() + 10 * 60 * 1000)
  setCookie(response, 'openradar_oauth_state', state, 10 * 60)
  const authorize = new URL('https://github.com/login/oauth/authorize')
  authorize.searchParams.set('client_id', githubClientId)
  authorize.searchParams.set('redirect_uri', githubCallbackUrl)
  authorize.searchParams.set('scope', 'read:user public_repo offline_access')
  authorize.searchParams.set('state', state)
  response.redirect(authorize.toString())
})

app.get('/api/auth/github/callback', asyncRoute(async (request, response) => {
  if (!githubClientId || !githubClientSecret) {
    response.redirect(`${appUrl}/?github=not-configured`)
    return
  }
  const code = String(request.query.code ?? '')
  const state = String(request.query.state ?? '')
  const expectedState = parseCookies(request).openradar_oauth_state
  const expiresAt = oauthStates.get(state)
  oauthStates.delete(state)
  if (!code || !state || state !== expectedState || !expiresAt || expiresAt < Date.now()) {
    response.redirect(`${appUrl}/?github=invalid-state`)
    return
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'OpenRadar-Personal' },
    body: JSON.stringify({ client_id: githubClientId, client_secret: githubClientSecret, code, redirect_uri: githubCallbackUrl }),
  })
  const tokenData = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number; error?: string }
  if (!tokenResponse.ok || !tokenData.access_token) {
    response.redirect(`${appUrl}/?github=token-error`)
    return
  }

  const user = await githubFetch<GitHubUser>('/user', tokenData.access_token)
  const sessionId = crypto.randomBytes(32).toString('hex')
  sessions.set(sessionId, {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    accessTokenExpiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined,
    refreshTokenExpiresAt: tokenData.refresh_token_expires_in ? Date.now() + tokenData.refresh_token_expires_in * 1000 : undefined,
    user,
    createdAt: Date.now(),
  })
  persistSessions()
  setCookie(response, 'openradar_session', sessionId, 30 * 24 * 60 * 60)
  setCookie(response, 'openradar_oauth_state', '', 0)
  response.redirect(`${appUrl}/?github=connected`)
}))

app.post('/api/auth/logout', (request, response) => {
  const sessionId = parseCookies(request).openradar_session
  if (sessionId) sessions.delete(sessionId)
  persistSessions()
  setCookie(response, 'openradar_session', '', 0)
  response.status(204).end()
})

/**
 * 轻量本地调度：默认每 24 小时最多同步一次公开频道。
 * 服务器没有持续运行时，下次启动会根据 lastSyncAt 补跑一次；不会为了定时任务
 * 强行启动 Telegram 登录，也不会高频访问频道页面。
 */
const telegramSyncIntervalHours = Math.max(Number(process.env.TELEGRAM_PUBLIC_SYNC_INTERVAL_HOURS ?? 24), 1)
let telegramSyncRunning = false

async function runScheduledTelegramSync() {
  if (telegramSyncRunning || getTelegramPublicChannels().length === 0) return
  const status = telegramPublicStatus()
  // 首次同步必须由用户手动触发，避免刚配置一批频道就自动回看大量历史消息。
  if (!status.lastSyncAt) return
  const due = Date.now() - new Date(status.lastSyncAt).getTime() >= telegramSyncIntervalHours * 3_600_000
  if (!due) return
  telegramSyncRunning = true
  try {
    const result = await syncTelegramPublicChannels({ limit: 40, pages: 3 })
    const pool = upsertCandidates(result.candidates)
    console.log(`Telegram 公开频道同步完成：读取 ${result.messagesRead} 条新消息，候选新增 ${pool.addedCount} 条。`)
  } catch (error) {
    console.warn(`Telegram 公开频道自动同步失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    telegramSyncRunning = false
  }
}

const distDir = path.resolve(currentDir, '..', 'dist')
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDir))
  app.use((_request, response) => response.sendFile(path.join(distDir, 'index.html')))
}

app.use((error: Error & { status?: number; detail?: string }, _request: Request, response: Response, _next: NextFunction) => {
  const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500
  const message = status === 404 ? 'GitHub 上没有找到这个内容。' : error.message || '服务暂时出了点问题。'
  if (status >= 500) console.error(error)
  response.status(status).json({ error: message })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`OpenRadar API running at http://127.0.0.1:${port}`)
  void runScheduledTelegramSync()
  setInterval(() => { void runScheduledTelegramSync() }, telegramSyncIntervalHours * 3_600_000)
})
