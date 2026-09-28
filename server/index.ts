import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type NextFunction, type Request, type Response } from 'express'
import { deepSeekConfig, enrichTools, type AiToolInput } from './ai.js'
import { listPool, poolStats, upsertCandidates } from './candidates.js'
import {
  candidateToTool,
  githubDiscoveryConnector,
  githubRequest,
  isUsableRepo,
  parseGitHubRepository,
  repoToCandidate,
  repoToTool,
  type GitHubRepo,
  type GitHubSearchResult,
} from './connectors/github.js'
import { connectorStatuses } from './connectors/index.js'
import { sourceRegistry } from './sources.js'
import { disconnectTelegram, startTelegramLogin, telegramLoginStatus, telegramStatus } from './telegram.js'

const app = express()
const port = Number(process.env.PORT ?? 8787)
const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(currentDir, '..')
const dataDir = path.join(projectDir, 'data')
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
  response.json({ ok: true, service: 'openradar-api' })
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
  response.json({ provider: 'deepseek', configured: true, model: deepSeekConfig.model, patches })
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

app.get('/api/github/stars', asyncRoute(async (request, response) => {
  const username = String(request.query.username ?? '').trim()
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) {
    response.status(400).json({ error: '请输入正确的 GitHub 用户名。' })
    return
  }
  const repos = await githubFetch<GitHubRepo[]>(`/users/${encodeURIComponent(username)}/starred?per_page=30&sort=created&direction=desc`)
  const usable = repos.filter(isUsableRepo)
  upsertCandidates(usable.map((repo) => repoToCandidate(repo, 'github-stars', '我的 GitHub Star')))
  response.json({ username, tools: usable.map((repo) => repoToTool(repo)) })
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
  response.json({ username: session.user.login, tools: usable.map((repo) => repoToTool(repo)) })
}))

app.post('/api/github/repository', asyncRoute(async (request, response) => {
  const { owner, repo } = parseGitHubRepository(String(request.body?.url ?? ''))
  const session = getSession(request)
  const result = await githubFetch<GitHubRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, session)
  const pool = upsertCandidates([repoToCandidate(result, 'manual', '我丢一个链接')])
  response.json({ tool: repoToTool(result), pool: { size: pool.poolSize, added: pool.addedCount, duplicates: pool.duplicateCount } })
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
  response.json({ source: source.full_name, tools: usable.map((item) => repoToTool(item)) })
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
})
