/**
 * 暂存区回采：把「消息已经下载、但从未变成候选」的 GitHub 项目挖出来。
 *
 * 背景：Telegram 公开频道同步时，每条消息都存进了暂存区，但只有一部分
 * 真的抓到了 GitHub 元数据并成为候选——未认证额度只有 60 次/小时，
 * 一次批量同步很容易在中途耗尽额度，剩下的链接就留在暂存区里没人管。
 * 实测有 1271 个仓库处于这个状态，而它们的消息早就下载好了。
 *
 * 设计：
 * - 天生可续跑：候选池按 canonicalUrl 去重，重复运行会自动跳过已入池的。
 * - 限流感知：一旦 GitHub 报限流就立刻停下，不把限流当成仓库失败。
 * - 不碰 DeepSeek：只负责把项目放进候选池，中文卡片交给分析队列。
 */
import { githubRequest, isUsableRepo, parseGitHubRepository, repoToCandidate, type GitHubRequestError, type GitHubRepo } from './connectors/github.js'
import { inferGitHubLinks } from './connectors/telegram-public.js'
import { findInPool, upsertCandidates } from './candidates.js'
import { listStaged } from './staging.js'
import { listMiningAttempts, recordMiningAttempt } from './store.js'
import type { StagedMessage } from './staging.js'

export const DEFAULT_MINING_BATCH = 20
export const MAX_MINING_BATCH = 50

export function clampMiningBatch(limit?: number) {
  const value = Math.trunc(Number(limit ?? DEFAULT_MINING_BATCH))
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MINING_BATCH
  return Math.min(value, MAX_MINING_BATCH)
}

export type MiningTarget = {
  url: string
  owner: string
  repo: string
  channel: string
  sourceId: string
  messageId: number
  messageUrl: string
}

/** 从一条暂存消息里提取所有 GitHub 仓库（链接 + 正文里写成 owner/repo 的）。 */
function reposInMessage(message: StagedMessage): Array<{ owner: string; repo: string }> {
  const found = new Map<string, { owner: string; repo: string }>()
  const candidates = [...(message.links ?? []), ...inferGitHubLinks(message.text ?? '')]
  for (const value of candidates) {
    try {
      const { owner, repo } = parseGitHubRepository(value)
      const key = `${owner.toLowerCase()}/${repo.toLowerCase()}`
      if (!found.has(key)) found.set(key, { owner, repo })
    } catch { /* 频道里也有非 GitHub 链接，先聚焦 GitHub */ }
  }
  return [...found.values()]
}

/**
 * 扫描暂存区，算出还有多少仓库没进候选池。
 * 优先级按消息时间从新到旧——用户更可能想看最近分享的东西。
 */
export function collectMiningTargets(): { targets: MiningTarget[]; stagedMessages: number; mentioned: number; attempted: number } {
  const messages = listStaged(5000)
  // 已经尝试过的目标不再重试——仓库改名/转移会让「池里有没有这个 URL」
  // 永远判断为否，只靠池子查重会陷进死循环。详见 store.ts 的说明。
  const attempted = new Set(listMiningAttempts().map((item) => item.targetUrl.toLowerCase()))
  const seen = new Set<string>()
  const targets: MiningTarget[] = []

  const ordered = [...messages].sort((a, b) => String(b.publishedAt ?? b.updatedAt).localeCompare(String(a.publishedAt ?? a.updatedAt)))
  for (const message of ordered) {
    for (const { owner, repo } of reposInMessage(message)) {
      const url = `https://github.com/${owner}/${repo}`
      const key = url.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      if (attempted.has(key)) continue
      if (findInPool(url)) continue
      targets.push({
        url,
        owner,
        repo,
        channel: message.channel,
        sourceId: message.sourceId,
        messageId: message.messageId,
        messageUrl: message.messageUrl,
      })
    }
  }

  return { targets, stagedMessages: messages.length, mentioned: seen.size, attempted: attempted.size }
}

export type MiningPlan = {
  stagedMessages: number
  /** 暂存区里提到过的、去重后的 GitHub 仓库总数。 */
  mentioned: number
  /** 已经在候选池里的。 */
  alreadyInPool: number
  /** 还需要挖的。 */
  toMine: number
  byChannel: Record<string, number>
  /** 下一批会处理哪些（最多 10 个，只用于预览）。 */
  preview: Array<{ url: string; channel: string }>
}

export function planMining(): MiningPlan {
  const { targets, stagedMessages, mentioned } = collectMiningTargets()
  const byChannel: Record<string, number> = {}
  for (const target of targets) byChannel[target.channel] = (byChannel[target.channel] ?? 0) + 1
  return {
    stagedMessages,
    mentioned,
    alreadyInPool: mentioned - targets.length,
    toMine: targets.length,
    byChannel,
    preview: targets.slice(0, 10).map((t) => ({ url: t.url, channel: t.channel })),
  }
}

export type MiningRunResult = {
  dryRun: boolean
  attempted: number
  added: number
  /** 仓库已不存在 / 被归档 / 是 fork。 */
  skipped: number
  /** 请求失败（网络、404 等）。 */
  failed: number
  rateLimited: boolean
  rateLimitResetAt: string | null
  /** 回采后还没入池的数量。 */
  remaining: number
  /** 已记录的重试状态条数（含改名、已删除、失败）。 */
  attemptsRecorded: number
  ids: string[]
  errors: string[]
}

/**
 * 跑一批回采。
 *
 * 遇到限流立刻停止：剩下的留到额度恢复，绝不把限流记成仓库失败。
 */
export async function runMiningBatch(options: { limit?: number; token?: string; dryRun?: boolean } = {}): Promise<MiningRunResult> {
  const size = clampMiningBatch(options.limit)
  const { targets } = collectMiningTargets()
  const batch = targets.slice(0, size)
  const base: MiningRunResult = {
    dryRun: Boolean(options.dryRun),
    attempted: batch.length,
    added: 0,
    skipped: 0,
    failed: 0,
    rateLimited: false,
    rateLimitResetAt: null,
    remaining: targets.length,
    attemptsRecorded: listMiningAttempts().length,
    ids: batch.map((t) => t.url),
    errors: [],
  }
  if (options.dryRun || batch.length === 0) return base

  let added = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []
  let rateLimited = false
  let rateLimitResetAt: string | null = null

  for (const target of batch) {
    try {
      const repo = await githubRequest<GitHubRepo>(`/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`, options.token)
      if (!isUsableRepo(repo)) {
        skipped += 1
        recordMiningAttempt(target.url, 'unusable', repo.html_url)
        continue
      }
      upsertCandidates([repoToCandidate(repo, target.sourceId, `纸飞机公开频道 · ${target.channel}`)])
      added += 1
      // 记录解析后的真实 URL：仓库改名时它和消息里的不同，这正是以前死循环的原因。
      recordMiningAttempt(target.url, 'added', repo.html_url)
    } catch (error) {
      const requestError = error as GitHubRequestError
      if (requestError.rateLimited) {
        rateLimited = true
        rateLimitResetAt = requestError.rateLimitResetAt ?? null
        break
      }
      if (requestError.status === 404 || requestError.status === 403 || requestError.status === 451) {
        skipped += 1
        recordMiningAttempt(target.url, 'missing')
        continue
      }
      failed += 1
      recordMiningAttempt(target.url, 'failed')
      if (errors.length < 3) errors.push(`${target.url}: ${requestError.message}`)
    }
  }

  const { targets: left, attempted } = collectMiningTargets()
  return { ...base, added, skipped, failed, rateLimited, rateLimitResetAt, remaining: left.length, attemptsRecorded: attempted, errors }
}
