/**
 * GitHub 来源连接器。
 *
 * 这里只处理“GitHub 上的东西”：
 * - 统一的 HTTP 调用（不关心 OAuth 会话和刷新，交给 server/index.ts）
 * - 仓库 → 统一 Candidate
 * - 仓库 → 中文推荐卡片
 *
 * 不在这里做：OAuth、会话加密、推荐排序、UI 文案组合。
 */
import type { Candidate, FetchCandidatesInput, FetchCandidatesResult, SourceConnector, ToolCard } from './types.js'

export const GITHUB_API = 'https://api.github.com'

export type GitHubRepo = {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  language: string | null
  topics?: string[]
  pushed_at: string
  owner: { login: string }
  archived: boolean
  fork: boolean
}

export type GitHubSearchResult = {
  items: GitHubRepo[]
}

/** repoToCandidate 写进 metadata 的约定结构。 */
export type GitHubCandidateMetadata = {
  repoId: number
  owner: string
  name: string
  fullName: string
  stars: number
  language: string | null
  topics: string[]
  updatedAt: string
}

export type GitHubRequestError = Error & {
  status?: number
  detail?: string
  /** 本次请求后剩余的额度。GitHub 在成功和失败响应里都会带。 */
  rateLimitRemaining?: number
  /** 额度重置时间（ISO）。 */
  rateLimitResetAt?: string
  /** 是否确定是被限流，而不是链接本身有问题。 */
  rateLimited?: boolean
}

function readRateLimit(response: Response) {
  const remainingRaw = response.headers.get('x-ratelimit-remaining')
  const resetRaw = response.headers.get('x-ratelimit-reset')
  const remaining = remainingRaw === null ? undefined : Number(remainingRaw)
  const resetSeconds = resetRaw === null ? undefined : Number(resetRaw)
  return {
    rateLimitRemaining: remaining !== undefined && Number.isFinite(remaining) ? remaining : undefined,
    rateLimitResetAt: resetSeconds !== undefined && Number.isFinite(resetSeconds) && resetSeconds > 0
      ? new Date(resetSeconds * 1000).toISOString()
      : undefined,
  }
}

/**
 * 唯一的 GitHub HTTP 入口。鉴权 Token 由调用方注入，
 * 401 刷新逻辑留在 server/index.ts，避免连接器碰会话。
 *
 * 限流会被单独标出来（403/429 且剩余额度为 0，或带 Retry-After）。
 * 批量回填必须能区分「额度用完了，等会儿再来」和「这个链接是死的」，
 * 否则一次限流会把几十个正常项目报成失败。
 */
export async function githubRequest<T>(endpoint: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'OpenRadar-Personal',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    const error = new Error(`GitHub 请求失败（${response.status}）`) as GitHubRequestError
    error.status = response.status
    error.detail = detail
    Object.assign(error, readRateLimit(response))
    error.rateLimited = (response.status === 403 || response.status === 429)
      && (response.headers.get('retry-after') !== null || error.rateLimitRemaining === 0)
    throw error
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/** 统一过滤：归档仓库和 fork 不进入推荐流。 */
export function isUsableRepo(repo: GitHubRepo) {
  return !repo.archived && !repo.fork
}

export function repoToCandidate(repo: GitHubRepo, sourceId = 'github-discovery', sourceLabel = 'GitHub 项目'): Candidate {
  const metadata: GitHubCandidateMetadata = {
    repoId: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    stars: repo.stargazers_count,
    language: repo.language,
    topics: repo.topics ?? [],
    updatedAt: repo.pushed_at,
  }
  return {
    canonicalUrl: repo.html_url,
    sourceItemId: `github-${repo.id}`,
    title: repo.name,
    description: repo.description ?? undefined,
    sourceKind: 'github',
    sourceId,
    sourceLabel,
    sourcePublishedAt: repo.pushed_at,
    status: 'ready',
    // 与 repoToTool 用的是同一套分类，保证评分标签和卡片标签一致。
    tags: classifyRepo(repo).tags.slice(0, 3),
    metadata,
  }
}

function compactNumber(value: number) {
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)} 万`
  return value.toLocaleString('zh-CN')
}

function classifyRepo(repo: GitHubRepo) {
  const haystack = [repo.name, repo.description ?? '', repo.language ?? '', ...(repo.topics ?? [])].join(' ').toLowerCase()
  const mappings = [
    { words: ['ai', 'llm', 'agent', 'gpt', 'machine-learning'], scene: 'AI 工具与自动化', tags: ['AI 工具', '自动化', '可二次开发'], title: '想把 AI 真正用起来？这个开源项目值得认识。', value: '改装价值高' },
    { words: ['file', 'sync', 'transfer', 'backup', 'storage'], scene: '文件整理与传输', tags: ['文件工具', '效率工具', '日常实用'], title: '文件处理总有点麻烦？它可能把步骤变简单。', value: '日常价值高' },
    { words: ['desktop', 'windows', 'macos', 'launcher'], scene: '桌面效率', tags: ['桌面工具', '效率工具', '能马上用'], title: '电脑上的小麻烦，也许可以交给这个工具。', value: '上手价值高' },
    { words: ['privacy', 'local', 'self-hosted', 'offline'], scene: '本地与隐私', tags: ['本地运行', '隐私友好', '自己掌控'], title: '不想把数据交给云端？这个项目可以自己掌控。', value: '隐私价值高' },
    { words: ['browser', 'extension', 'chrome', 'firefox'], scene: '浏览器增强', tags: ['浏览器插件', '效率工具', '轻量'], title: '每天都在用浏览器？它可能替你省下一些重复操作。', value: '使用频率高' },
    { words: ['cli', 'developer', 'devtool', 'api', 'sdk'], scene: '开发与连接', tags: ['开发工具', '自动化', '可二次开发'], title: '需要把工具串起来？这个项目可能正好补上连接环节。', value: '扩展价值高' },
  ]

  const matchesWord = (word: string) => word.length <= 3
    ? new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(haystack)
    : haystack.includes(word)
  return mappings.find((item) => item.words.some(matchesWord)) ?? {
    scene: '开源新工具',
    tags: ['开源工具', repo.language ?? '值得探索', '可以改装'],
    title: `发现一个叫 ${repo.name} 的项目，先用中文看懂它。`,
    value: '探索价值高',
  }
}

/**
 * 规则版中文卡片。注意这是“启发式判断”，不是事实结论，
 * 文案里必须保留“可能”“先看看”这类谨慎语气（见手册 9.3 和 17.1）。
 */
export function repoToTool(repo: GitHubRepo, sourceLabel = 'GitHub 项目', sourceId?: string): ToolCard {
  const category = classifyRepo(repo)
  const updatedDays = Math.max(0, Math.round((Date.now() - new Date(repo.pushed_at).getTime()) / 86_400_000))
  const activeText = updatedDays <= 14 ? '最近仍在活跃更新' : updatedDays <= 90 ? '近三个月有更新' : '适合先收藏观察'
  const difficulty = category.tags.includes('能马上用') || category.tags.includes('浏览器插件') ? '上手低' : '上手中'
  const accent = (repo.id % 3 === 0 ? 'ink' : repo.id % 2 === 0 ? 'teal' : 'coral') as 'ink' | 'teal' | 'coral'

  return {
    id: `github-${repo.id}`,
    name: repo.name,
    eyebrow: `${repo.language ?? '开源'} · ${compactNumber(repo.stargazers_count)} Star`,
    title: category.title,
    summary: `这是一个围绕“${category.scene}”打造的开源项目。${activeText}，可以先看看实际用途再决定是否尝试。`,
    tags: category.tags.slice(0, 3),
    fit: updatedDays <= 30 ? '值得现在看看' : repo.stargazers_count >= 10_000 ? '口碑项目' : '探索性推荐',
    difficulty,
    value: category.value,
    source: repo.html_url,
    sourceLabel,
    image: `https://opengraph.githubassets.com/1/${repo.full_name}`,
    accent,
    explore: true,
    sourceKind: 'github',
    sourceId,
    repository: {
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      stars: repo.stargazers_count,
      language: repo.language,
      updatedAt: repo.pushed_at,
      topics: repo.topics ?? [],
    },
  }
}

/** 只接受 github.com 或 www.github.com 的仓库链接。 */
export function parseGitHubRepository(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw Object.assign(new Error('请输入完整的 GitHub 项目链接。'), { status: 400 })
  }
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
    throw Object.assign(new Error('当前版本先支持 GitHub 项目链接。'), { status: 400 })
  }
  const [owner, repo] = url.pathname.split('/').filter(Boolean)
  if (!owner || !repo) throw Object.assign(new Error('没有识别到项目名称。'), { status: 400 })
  return { owner, repo: repo.replace(/\.git$/, '') }
}

/**
 * 从候选池里的 Candidate 还原出仓库信息。
 *
 * 这是“卡片从候选渲染”而不是“卡片直接来自 API 响应”的关键一步：
 * 以后候选池换成 SQLite、或者候选来自 Telegram 转发的 GitHub 链接时，
 * 只要 metadata 结构一致，卡片生成逻辑不需要改。
 */
export function candidateToRepo(candidate: Candidate): GitHubRepo | undefined {
  const meta = candidate.metadata as Partial<GitHubCandidateMetadata> | undefined
  if (!meta || typeof meta.repoId !== 'number' || !meta.owner || !meta.name) return undefined
  return {
    id: meta.repoId,
    name: meta.name,
    full_name: meta.fullName ?? `${meta.owner}/${meta.name}`,
    html_url: candidate.canonicalUrl,
    description: candidate.description ?? null,
    stargazers_count: typeof meta.stars === 'number' ? meta.stars : 0,
    language: meta.language ?? null,
    topics: Array.isArray(meta.topics) ? meta.topics : [],
    pushed_at: meta.updatedAt ?? candidate.sourcePublishedAt ?? new Date(0).toISOString(),
    owner: { login: meta.owner },
    // 归档和 fork 在进入候选池之前已经过滤，这里按可用处理。
    archived: false,
    fork: false,
  }
}

export function candidateToTool(candidate: Candidate): ToolCard | undefined {
  const repo = candidateToRepo(candidate)
  if (!repo) return undefined
  const tool = repoToTool(repo, candidate.sourceLabel, candidate.sourceId)
  const aiPatch = (candidate.metadata as { aiPatch?: Partial<ToolCard> } | undefined)?.aiPatch
  if (aiPatch) {
    if (typeof aiPatch.title === 'string') tool.title = aiPatch.title
    if (typeof aiPatch.summary === 'string') tool.summary = aiPatch.summary
    if (Array.isArray(aiPatch.tags) && aiPatch.tags.length > 0) tool.tags = aiPatch.tags.slice(0, 3)
    if (typeof aiPatch.fit === 'string') tool.fit = aiPatch.fit
    if (typeof aiPatch.difficulty === 'string') tool.difficulty = aiPatch.difficulty
    if (typeof aiPatch.value === 'string') tool.value = aiPatch.value
  }
  // 卡片标签必须和评分用的候选标签完全一致，否则「为什么给你看」会对不上。
  const hasAiTags = Boolean((candidate.metadata as { aiPatch?: { tags?: unknown[] } } | undefined)?.aiPatch?.tags?.length)
  return { ...tool, sourceKind: candidate.sourceKind, ...(!hasAiTags && candidate.tags && candidate.tags.length > 0 ? { tags: candidate.tags } : {}) }
}

const DISCOVERY_WINDOW_DAYS = 180
const DISCOVERY_MIN_STARS = 500
/**
 * 参考实现：GitHub 新项目发现。
 *
 * 这是第一个完整实现 SourceConnector 的来源，后续 RSS / Telegram /
 * Hacker News / Product Hunt 应照着这个形状实现，而不是继续往 server/index.ts 里加路由。
 */
export const githubDiscoveryConnector: SourceConnector = {
  id: 'github-discovery',
  label: 'GitHub 新项目',
  kind: 'github',

  async checkConfig() {
    return { ready: true, message: '无需配置；未登录时使用 GitHub 公开搜索额度。' }
  },

  async fetchCandidates({ limit, query, auth }: FetchCandidatesInput): Promise<FetchCandidatesResult> {
    const recentDate = new Date(Date.now() - DISCOVERY_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
    const resolvedQuery = query?.trim() || `stars:>${DISCOVERY_MIN_STARS} pushed:>${recentDate}`
    const perPage = Math.min(Math.max(Math.trunc(limit) || 24, 1), 100)
    const result = await githubRequest<GitHubSearchResult>(
      `/search/repositories?q=${encodeURIComponent(resolvedQuery)}&sort=updated&order=desc&per_page=${perPage}`,
      auth?.token,
    )
    return {
      candidates: result.items.filter(isUsableRepo).map((repo) => repoToCandidate(repo)),
    }
  },
}
