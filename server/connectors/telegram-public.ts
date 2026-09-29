/**
 * Telegram 公开频道网页来源。
 *
 * 这条路线不使用 Telegram API，不登录，也不读取桌面端数据；只读取
 * Telegram 为公开频道提供的 https://t.me/s/<username> 网页预览。
 * 状态保存到 data/telegram-web/，因此服务重启后仍能只抓取新消息。
 */
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import type { Candidate, FetchCandidatesInput, FetchCandidatesResult, SourceConnector } from './types.js'
import { githubRequest, isUsableRepo, parseGitHubRepository, repoToCandidate, type GitHubRepo } from './github.js'
import { stageTelegramMessages } from '../staging.js'
import { looksLikePromotion } from '../contentFilter.js'
import { resolveDataDir } from '../store.js'

const execFileAsync = promisify(execFile)
const USER_AGENT = 'OpenRadar-Personal-TelegramWebReader/0.2 (public-channel-reader)'
const dataDir = path.join(resolveDataDir(), 'telegram-web')
const channelsFile = path.join(dataDir, 'channels.json')
const stateFile = path.join(dataDir, 'state.json')

export const TELEGRAM_PUBLIC_SOURCE_ID = 'telegram-public'

export type TelegramPublicMessage = {
  id: number
  url: string
  channel: string
  text: string
  publishedAt: string | null
  viewsText: string | null
  author: string | null
  forwardedFrom: string | null
  image: string | null
  links: string[]
}

export type TelegramPublicChannel = {
  username: string
  name: string
  description: string | null
  subscribersText: string | null
  url: string
}

type TelegramChannelState = {
  lastMessageId?: number
  lastFetchedAt?: string
  lastMessageCount?: number
  lastCandidateCount?: number
  lastError?: string
}

type TelegramPublicState = {
  lastSyncAt?: string
  lastSyncOk?: boolean
  lastError?: string
  channels: Record<string, TelegramChannelState>
}

export type TelegramPublicStatus = {
  configured: boolean
  channels: Array<{ username: string; url: string; lastMessageId: number | null; lastFetchedAt: string | null; lastCandidateCount: number; lastError: string | null }>
  lastSyncAt: string | null
  lastSyncOk: boolean | null
  lastError: string | null
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true })
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, value: unknown) {
  ensureDataDir()
  const temporary = `${file}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  fs.renameSync(temporary, file)
}

export function normalizePublicChannel(input: string) {
  const raw = String(input ?? '').trim()
  if (!raw) throw new Error('请提供公开频道用户名或链接，例如 @GithubCOTV。')
  let candidate = raw
  if (/^https?:\/\//i.test(candidate)) {
    let url: URL
    try { url = new URL(candidate) } catch { throw new Error('频道链接格式不正确。') }
    if (!['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'].includes(url.hostname.toLowerCase())) {
      throw new Error('当前只支持 t.me 或 telegram.me 的公开频道链接。')
    }
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0]?.toLowerCase() === 's') parts.shift()
    candidate = parts[0] ?? ''
  }
  candidate = candidate.replace(/^@/, '').replace(/\/$/, '')
  if (candidate === 's' || candidate.startsWith('joinchat') || candidate.startsWith('+') || candidate.startsWith('c/')) {
    throw new Error('这个链接看起来是私有邀请链接，公开网页读取器暂时不能读取。')
  }
  if (!/^[A-Za-z0-9_]{1,64}$/.test(candidate)) throw new Error('没有识别到公开频道用户名。请使用 @频道名 或 https://t.me/频道名。')
  return candidate
}

function configuredUsernames() {
  const saved = readJson<{ channels?: unknown }>(channelsFile, {})
  const savedChannels = Array.isArray(saved.channels) ? saved.channels.filter((item): item is string => typeof item === 'string') : []
  const envChannels = (process.env.TELEGRAM_PUBLIC_CHANNELS ?? '').split(',').map((item) => item.trim()).filter(Boolean)
  const values = savedChannels.length > 0 ? savedChannels : envChannels
  const normalized: string[] = []
  for (const value of values) {
    try {
      const username = normalizePublicChannel(value)
      if (!normalized.includes(username)) normalized.push(username)
    } catch { /* 配置文件中的坏条目不应阻止其他频道工作 */ }
  }
  if (savedChannels.length === 0 && normalized.length > 0) writeJson(channelsFile, { channels: normalized })
  return normalized
}

export function getTelegramPublicChannels() {
  return configuredUsernames()
}

export function saveTelegramPublicChannels(inputs: string[]) {
  const normalized: string[] = []
  for (const input of inputs.slice(0, 50)) {
    const username = normalizePublicChannel(input)
    if (!normalized.includes(username)) normalized.push(username)
  }
  writeJson(channelsFile, { channels: normalized, updatedAt: new Date().toISOString() })
  return normalized
}

function getState() {
  const state = readJson<TelegramPublicState>(stateFile, { channels: {} })
  state.channels ??= {}
  return state
}

function saveState(state: TelegramPublicState) {
  writeJson(stateFile, state)
}

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
}

function htmlToText(value: string) {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p\s*>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function htmlAttribute(block: string, name: string) {
  const expression = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i')
  return decodeHtml(block.match(expression)?.[1] ?? '')
}

export function inferGitHubLinks(text: string) {
  const links: string[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    const match = line.match(/^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]{1,100})$/)
    if (!match) continue
    const href = `https://github.com/${match[1]}/${match[2].replace(/\.git$/i, '')}`
    if (!links.includes(href)) links.push(href)
  }
  return links
}

/** 资源频道常见的广告模式；命中后只暂存，不进入候选推荐。 */
export function isLikelyAdvertisement(text: string) {
  return looksLikePromotion(text)
}

function extractLinks(block: string, text: string, username: string) {
  const links: string[] = []
  for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = decodeHtml(match[1]).trim()
    const sameChannel = new RegExp(`^https?:\\/\\/(?:www\\.)?t\\.me\\/${username}(?:\\/|$)`, 'i').test(href)
    if (/^https?:\/\//i.test(href) && !sameChannel && !links.includes(href)) links.push(href)
  }
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/gi)) {
    const href = match[0].replace(/[),.;!?]+$/, '')
    if (!links.includes(href)) links.push(href)
  }
  for (const href of inferGitHubLinks(text)) if (!links.includes(href)) links.push(href)
  return links
}

function extractImage(block: string) {
  const background = block.match(/background-image\s*:\s*url\(\s*["']?([^"')\s]+)["']?\s*\)/i)
  if (background) return decodeHtml(background[1])
  const image = block.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)
  return image ? decodeHtml(image[1]) : null
}

export function parseTelegramPreview(html: string, username: string) {
  const starts = [...html.matchAll(/data-post=["']([^"']+)["']/gi)]
  const messages: TelegramPublicMessage[] = []
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index].index ?? 0
    const block = html.slice(start, starts[index + 1]?.index ?? html.length)
    const post = decodeHtml(starts[index][1])
    const parts = post.split('/')
    const postUsername = parts[0] || username
    const id = Number(parts.at(-1))
    if (!Number.isInteger(id)) continue
    const text = htmlToText(block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
    const date = htmlAttribute(block.match(/<time\b[^>]*datetime=["'][^"']+["'][^>]*>/i)?.[0] ?? '', 'datetime') || null
    const dateLink = htmlAttribute(block.match(/<a\b[^>]*class=["'][^"']*tgme_widget_message_date[^"']*["'][^>]*>/i)?.[0] ?? '', 'href') || `https://t.me/${postUsername}/${id}`
    messages.push({
      id, url: dateLink, channel: postUsername, text, publishedAt: date,
      viewsText: htmlToText(block.match(/class="tgme_widget_message_views[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '') || null,
      author: htmlToText(block.match(/class="tgme_widget_message_from_author[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '') || null,
      forwardedFrom: htmlToText(block.match(/class="tgme_widget_message_forwarded_from[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '') || null,
      image: extractImage(block), links: extractLinks(block, text, postUsername),
    })
  }
  return messages
}

function extractChannelMeta(html: string, username: string): TelegramPublicChannel {
  const name = htmlToText(html.match(/class="tgme_channel_info_header_title[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
  const description = htmlToText(html.match(/class="tgme_channel_info_description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
  const subscribersText = htmlToText(html.match(/class="tgme_channel_info_counter[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
  return { username, name: name || `@${username}`, description: description || null, subscribersText: subscribersText || null, url: `https://t.me/${username}` }
}

async function fetchPreview(username: string, before?: number) {
  const url = new URL(`https://t.me/s/${username}`)
  if (before) url.searchParams.set('before', String(before))
  let html = ''
  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(`Telegram 网页返回 ${response.status}`)
    html = await response.text()
  } catch (fetchError) {
    if (process.platform !== 'win32') throw new Error(`无法访问 Telegram 公开页面：${fetchError instanceof Error ? fetchError.message : String(fetchError)}`)
    try {
      const result = await execFileAsync('curl.exe', ['-L', '--fail', '--max-time', '20', '-A', USER_AGENT, url.toString()], { maxBuffer: 8 * 1024 * 1024, windowsHide: true })
      html = result.stdout
    } catch (curlError) {
      throw new Error(`无法访问 Telegram 公开页面（Node 和 curl 都失败）：${curlError instanceof Error ? curlError.message : String(curlError)}`)
    }
  }
  if (!html.includes('tgme_widget_message')) throw new Error(`没有找到 @${username} 的公开网页预览。它可能是私有频道、用户名不正确，或 Telegram 暂时限制了访问。`)
  return { html, url: url.toString() }
}

async function readNewMessages(username: string, lastMessageId: number | undefined, limit: number, pages: number) {
  const messages: TelegramPublicMessage[] = []
  const seen = new Set<number>()
  let before = 0
  let previousOldest = 0
  let firstHtml = ''
  let pagesFetched = 0
  while (messages.length < limit && pagesFetched < pages) {
    const page = await fetchPreview(username, before)
    if (!firstHtml) firstHtml = page.html
    const pageMessages = parseTelegramPreview(page.html, username)
    if (pageMessages.length === 0) break
    for (const message of pageMessages) {
      if (seen.has(message.id) || (lastMessageId !== undefined && message.id <= lastMessageId)) continue
      seen.add(message.id)
      messages.push(message)
      if (messages.length >= limit) break
    }
    pagesFetched += 1
    const oldest = Math.min(...pageMessages.map((message) => message.id))
    if (!oldest || oldest === previousOldest || (lastMessageId !== undefined && oldest <= lastMessageId)) break
    previousOldest = oldest
    before = oldest
  }
  messages.sort((left, right) => right.id - left.id)
  return { channel: extractChannelMeta(firstHtml, username), messages, pagesFetched }
}

function githubLinks(messages: TelegramPublicMessage[]) {
  const result: Array<{ message: TelegramPublicMessage; url: string }> = []
  const seen = new Set<string>()
  for (const message of messages) {
    for (const link of message.links) {
      try {
        const { owner, repo } = parseGitHubRepository(link)
        const url = `https://github.com/${owner}/${repo}`
        if (!seen.has(url)) { seen.add(url); result.push({ message, url }) }
      } catch { /* 公开频道也可能分享非 GitHub 资源；V0.6 先聚焦 GitHub */ }
    }
  }
  return result
}

export type TelegramPublicSyncResult = {
  source: string
  channels: string[]
  messagesRead: number
  candidates: Candidate[]
  channelResults: Array<{ username: string; messagesRead: number; candidates: number; lastMessageId: number | null; error?: string }>
}

export async function syncTelegramPublicChannels(options: { channels?: string[]; limit?: number; pages?: number; token?: string; persistChannels?: boolean } = {}): Promise<TelegramPublicSyncResult> {
  const channels = options.channels?.length
    ? (options.persistChannels ? saveTelegramPublicChannels(options.channels) : [...new Set(options.channels.map(normalizePublicChannel))])
    : getTelegramPublicChannels()
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 40), 1), 100)
  const pages = Math.min(Math.max(Math.trunc(options.pages ?? 3), 1), 10)
  const state = getState()
  const candidates: Candidate[] = []
  const channelResults: TelegramPublicSyncResult['channelResults'] = []
  let messagesRead = 0
  let hasError = false

  for (const username of channels) {
    const channelState = state.channels[username] ?? {}
    try {
      const result = await readNewMessages(username, channelState.lastMessageId, limit, pages)
      const filteredIds = new Set(result.messages.filter((message) => isLikelyAdvertisement(message.text)).map((message) => message.id))
      stageTelegramMessages(username, result.messages, filteredIds)
      const links = githubLinks(result.messages.filter((message) => !filteredIds.has(message.id)))
      let channelCandidates = 0
      for (const item of links) {
        try {
          const { owner, repo } = parseGitHubRepository(item.url)
          const githubRepo = await githubRequest<GitHubRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, options.token)
          if (!isUsableRepo(githubRepo)) continue
          const sourceId = `${TELEGRAM_PUBLIC_SOURCE_ID}:${username}`
          const candidate = repoToCandidate(githubRepo, sourceId, `纸飞机公开频道 · ${result.channel.name}`)
          candidates.push({
            ...candidate,
            sourceKind: 'telegram',
            sourceItemId: `telegram-${username}-${item.message.id}-${githubRepo.id}`,
            sourcePublishedAt: item.message.publishedAt ?? candidate.sourcePublishedAt,
            rawText: item.message.text,
            metadata: { ...candidate.metadata, telegramChannel: username, telegramMessageId: item.message.id, telegramMessageUrl: item.message.url, telegramViewsText: item.message.viewsText, telegramImage: item.message.image },
          })
          channelCandidates += 1
        } catch {
          // GitHub 限流时先留下待补全候选；原始消息已经在 staging 中保存，
          // 下一次带 Token 的回填可以继续处理，不丢链接。
          try {
            const { owner, repo } = parseGitHubRepository(item.url)
            candidates.push({
              canonicalUrl: item.url,
              sourceItemId: 'telegram-pending-' + username + '-' + item.message.id,
              title: repo,
              sourceKind: 'telegram',
              sourceId: 'telegram-public:' + username,
              sourceLabel: '纸飞机公开频道 · ' + result.channel.name,
              sourcePublishedAt: item.message.publishedAt ?? undefined,
              rawText: item.message.text,
              status: 'pending',
              metadata: { owner, name: repo, fullName: owner + '/' + repo, telegramChannel: username, telegramMessageId: item.message.id, telegramMessageUrl: item.message.url },
            })
            channelCandidates += 1
          } catch { /* 链接解析失败时仍只保留原始暂存消息 */ }
        }
      }
      const newest = result.messages.reduce((max, message) => Math.max(max, message.id), channelState.lastMessageId ?? 0)
      state.channels[username] = { lastMessageId: newest || channelState.lastMessageId, lastFetchedAt: new Date().toISOString(), lastMessageCount: result.messages.length, lastCandidateCount: channelCandidates }
      messagesRead += result.messages.length
      channelResults.push({ username, messagesRead: result.messages.length, candidates: channelCandidates, lastMessageId: newest || null })
    } catch (error) {
      hasError = true
      const message = error instanceof Error ? error.message : String(error)
      state.channels[username] = { ...channelState, lastFetchedAt: new Date().toISOString(), lastError: message }
      channelResults.push({ username, messagesRead: 0, candidates: 0, lastMessageId: channelState.lastMessageId ?? null, error: message })
    }
  }
  state.lastSyncAt = new Date().toISOString()
  state.lastSyncOk = !hasError
  state.lastError = hasError ? channelResults.find((item) => item.error)?.error : undefined
  saveState(state)
  return { source: TELEGRAM_PUBLIC_SOURCE_ID, channels, messagesRead, candidates, channelResults }
}

export function telegramPublicStatus(): TelegramPublicStatus {
  const state = getState()
  const channels = getTelegramPublicChannels().map((username) => {
    const item = state.channels[username] ?? {}
    return { username, url: `https://t.me/${username}`, lastMessageId: item.lastMessageId ?? null, lastFetchedAt: item.lastFetchedAt ?? null, lastCandidateCount: item.lastCandidateCount ?? 0, lastError: item.lastError ?? null }
  })
  return { configured: channels.length > 0, channels, lastSyncAt: state.lastSyncAt ?? null, lastSyncOk: state.lastSyncOk ?? null, lastError: state.lastError ?? null }
}

export const telegramPublicConnector: SourceConnector = {
  id: TELEGRAM_PUBLIC_SOURCE_ID,
  label: '纸飞机公开频道',
  kind: 'telegram',
  async checkConfig() {
    const channels = getTelegramPublicChannels()
    return channels.length > 0
      ? { ready: true, message: `已配置 ${channels.length} 个公开频道；每天最多自动读取一次。` }
      : { ready: false, message: '粘贴公开频道链接后即可读取；不需要 Telegram API。' }
  },
  async fetchCandidates(input: FetchCandidatesInput): Promise<FetchCandidatesResult> {
    const result = await syncTelegramPublicChannels({ limit: input.limit, token: input.auth?.token })
    return { candidates: result.candidates }
  },
}
