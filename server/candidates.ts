/**
 * 候选池：所有来源找到的东西先落到这里，再做推荐。
 *
 * 当前阶段（P0）只有内存池，进程重启即清空。它的作用是：
 * - 提供统一的 canonicalUrl 归一化，让跨来源去重有唯一依据；
 * - 记录每个候选中被哪些来源看到过（sourceIds）和看到过几次；
 * - 为后续 SQLite 持久化、兴趣评分和推荐重排留出唯一入口。
 *
 * 明确不在本文件里做：UI 文案、推荐排序、AI 调用。
 */
import type { Candidate } from './connectors/types.js'

export type PooledCandidate = {
  candidate: Candidate
  canonicalUrl: string
  firstSeenAt: string
  lastSeenAt: string
  /** 被来源返回过多少次（含同批重复）。 */
  seenCount: number
  /** 看到过这个候选的所有来源 id。 */
  sourceIds: string[]
}

export type UpsertResult = {
  /** 本批首次进入池中的候选，已按 canonicalUrl 去重。 */
  added: Candidate[]
  /** 本批中池里已经存在的候选（包含同一批里重复出现的）。 */
  duplicates: Candidate[]
  addedCount: number
  duplicateCount: number
  poolSize: number
}

const pool = new Map<string, PooledCandidate>()

/**
 * 常见的跟踪参数。同一篇文章带不同 utm 参数时不应该被当成两个候选。
 */
const TRACKING_PARAMS = new Set([
  'ref', 'ref_src', 'source', 'from', 'spm', 'share', 'share_source',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'msclkid', 'yclid', 'igshid', 'mc_cid', 'mc_eid',
])

/**
 * 把任意链接归一化成去重用的唯一键。
 *
 * 规则：
 * - 去掉 hash、去掉末尾斜杠、去掉 .git 后缀；
 * - 主机名小写并去掉 www.；
 * - 删除跟踪参数；
 * - github.com 只保留 owner/repo 两段并小写（/tree/main、/issues 等都视为同一个项目）。
 *
 * 无法解析的字符串退化为去掉首尾空格的原文，保证不会抛错打断抓取流程。
 */
export function canonicalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return trimmed.toLowerCase()
  }

  url.hash = ''
  url.protocol = url.protocol.toLowerCase()
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key)
  }

  let pathname = url.pathname.replace(/\/+$/, '').replace(/\.git$/i, '')
  if (url.hostname === 'github.com') {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length >= 2) pathname = `/${segments[0].toLowerCase()}/${segments[1].toLowerCase()}`
  }

  const search = url.searchParams.toString()
  const port = url.port ? `:${url.port}` : ''
  return `${url.protocol}//${url.hostname}${port}${pathname}${search ? `?${search}` : ''}`
}

/**
 * 把一批候选写入池中。
 *
 * 幂等：同一批里出现两次的同一个 canonicalUrl 只会算一次 added，
 * 第二次计入 duplicates，避免同一次抓取内部就产生重复卡片。
 */
export function upsertCandidates(items: Candidate[]): UpsertResult {
  const now = new Date().toISOString()
  const added: Candidate[] = []
  const duplicates: Candidate[] = []

  for (const item of items) {
    const canonicalUrl = canonicalizeUrl(item.canonicalUrl)
    if (!canonicalUrl) continue

    const existing = pool.get(canonicalUrl)
    if (existing) {
      existing.lastSeenAt = now
      existing.seenCount += 1
      if (!existing.sourceIds.includes(item.sourceId)) existing.sourceIds.push(item.sourceId)
      // 只补空字段，不用后面的结果覆盖已经拿到的信息。
      if (!existing.candidate.title && item.title) existing.candidate.title = item.title
      if (!existing.candidate.description && item.description) existing.candidate.description = item.description
      duplicates.push(existing.candidate)
      continue
    }

    const candidate: Candidate = { ...item, canonicalUrl }
    pool.set(canonicalUrl, {
      candidate,
      canonicalUrl,
      firstSeenAt: now,
      lastSeenAt: now,
      seenCount: 1,
      sourceIds: [item.sourceId],
    })
    added.push(candidate)
  }

  return {
    added,
    duplicates,
    addedCount: added.length,
    duplicateCount: duplicates.length,
    poolSize: pool.size,
  }
}

export type PoolStats = {
  size: number
  bySource: Record<string, number>
  /** 同时被多个来源看到的候选数量，用来观察跨来源重合度。 */
  multiSource: number
}

export function poolStats(): PoolStats {
  const bySource: Record<string, number> = {}
  let multiSource = 0
  for (const entry of pool.values()) {
    for (const sourceId of entry.sourceIds) bySource[sourceId] = (bySource[sourceId] ?? 0) + 1
    if (entry.sourceIds.length > 1) multiSource += 1
  }
  return { size: pool.size, bySource, multiSource }
}

export function listPool(limit = 50): PooledCandidate[] {
  return [...pool.values()]
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, Math.max(limit, 0))
}

export function findInPool(rawUrl: string) {
  return pool.get(canonicalizeUrl(rawUrl))
}

/** 仅供本地自检和测试使用。 */
export function clearPool() {
  pool.clear()
}
