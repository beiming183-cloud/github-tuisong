/**
 * 第一版可解释的兴趣评分。
 *
 * 设计原则（对照交接手册第 13 节）：
 * - 不训练模型。用户现在还不确定自己喜欢什么，先做可解释的行为评分。
 * - 每个维度都要能被讲成一句中文，讲不出来的信号不要放进来。
 * - 事实与推断分开：星数、更新时间是事实；「适合你」是推断，必须带 reasonCode。
 * - 分值不是事实。UI 必须展示理由，而不是只展示一个数字。
 *
 * 本文件是纯函数，不读文件、不联网、不碰密钥，方便自检。
 */
import type { PooledCandidate } from './candidates.js'
import type { Candidate } from './connectors/types.js'
import { EVENT_WEIGHTS, type UserEvent } from './events.js'

/** 六个维度的权重，合计 1.00，对照手册 13.3。 */
export const SCORE_WEIGHTS = {
  interest: 0.35,
  value: 0.20,
  novelty: 0.15,
  activity: 0.10,
  trust: 0.10,
  explore: 0.10,
} as const

export const SCORE_LABELS: Record<keyof typeof SCORE_WEIGHTS, string> = {
  interest: '兴趣匹配',
  value: '实用价值',
  novelty: '新颖度',
  activity: '最近活跃',
  trust: '来源可信度',
  explore: '探索奖励',
}

/**
 * 来源可信度。这是产品判断，不是客观事实：
 * 用户自己 Star 的和自己丢进来的链接最可信，泛探索最低。
 */
export const SOURCE_TRUST: Record<string, number> = {
  manual: 1.0,
  'github-stars': 0.95,
  'github-similar': 0.75,
  'github-discovery': 0.7,
}

const DEFAULT_TRUST = 0.5

/**
 * 来源 → 解释用法的映射。
 * 必须与 SOURCE_TRUST 一一对应：可信度是排序用的数字，解释是给用户看的话，
 * 两者混用会让「通用探索」被说成「从你感兴趣的项目延伸出来的」。
 */
const TRUST_REASON_CODES: Record<string, string> = {
  manual: 'trust:self-curated',
  'github-stars': 'trust:self-curated',
  'github-similar': 'trust:related',
  'github-discovery': 'trust:discovery',
}

/** 干扰惩罚：跳过和「不再推荐」降权，但不永久隐藏（手册 13.3）。 */
export const SKIP_PENALTY = 0.5
export const DISMISS_PENALTY = 0.1

/** 画像里的一项：标签/来源名，以及它累加出来的权重。 */
export type WeightedEntry = { label: string; weight: number }

export type InterestProfile = {
  tagWeights: Record<string, number>
  sourceKindWeights: Record<string, number>
  sourceIdWeights: Record<string, number>
  positiveCount: number
  negativeCount: number
  /** 用户明确说过「不再推荐」的项目。 */
  dismissedToolIds: string[]
  /** 用户跳过的项目，降权但保留。 */
  skippedToolIds: string[]
  /** 每个项目被看过几次，用于判断新颖度。 */
  viewCountByTool: Record<string, number>
  updatedAt: string | null
  topTags: WeightedEntry[]
  topSourceKinds: WeightedEntry[]
  topSourceIds: WeightedEntry[]
}

/**
 * 从原始事件推导兴趣画像。
 *
 * 注意：这里只做加权计数，不做任何「猜测」。如果用户没有行为，
 * 画像就是空的，推荐必须诚实地说「还没有足够的偏好信号」。
 */
export function buildInterestProfile(events: UserEvent[]): InterestProfile {
  const tagWeights: Record<string, number> = {}
  const sourceKindWeights: Record<string, number> = {}
  const sourceIdWeights: Record<string, number> = {}
  const viewCountByTool: Record<string, number> = {}
  const dismissed = new Set<string>()
  const skipped = new Set<string>()
  let positiveCount = 0
  let negativeCount = 0

  for (const item of events) {
    const weight = EVENT_WEIGHTS[item.event] ?? 0
    if (weight > 0) positiveCount += 1
    if (weight < 0) negativeCount += 1

    for (const tag of item.tags ?? []) tagWeights[tag] = (tagWeights[tag] ?? 0) + weight
    if (item.sourceKind) sourceKindWeights[item.sourceKind] = (sourceKindWeights[item.sourceKind] ?? 0) + weight
    if (item.sourceId) sourceIdWeights[item.sourceId] = (sourceIdWeights[item.sourceId] ?? 0) + weight
    if (item.event === 'view') viewCountByTool[item.toolId] = (viewCountByTool[item.toolId] ?? 0) + 1
    if (item.event === 'dismiss') dismissed.add(item.toolId)
    if (item.event === 'skip') skipped.add(item.toolId)
  }

  return {
    tagWeights,
    sourceKindWeights,
    sourceIdWeights,
    positiveCount,
    negativeCount,
    dismissedToolIds: [...dismissed],
    skippedToolIds: [...skipped],
    viewCountByTool,
    updatedAt: events.length > 0 ? events[events.length - 1].occurredAt : null,
    topTags: toTopEntries(tagWeights, 6),
    topSourceKinds: toTopEntries(sourceKindWeights, 4),
    topSourceIds: toTopEntries(sourceIdWeights, 4),
  }
}

function toTopEntries(weights: Record<string, number>, limit: number): WeightedEntry[] {
  return Object.entries(weights)
    .map(([label, weight]) => ({ label, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
}

export function hasProfile(profile: InterestProfile) {
  return profile.positiveCount > 0
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export type ScorePart = {
  key: keyof typeof SCORE_WEIGHTS
  label: string
  /** 归一化到 0..1 的维度原始分。 */
  raw: number
  weight: number
  weighted: number
}

export type ScoredCandidate = {
  candidate: Candidate
  canonicalUrl: string
  tags: string[]
  /** 0..1 的加权总分。 */
  total: number
  parts: ScorePart[]
  reasonCodes: string[]
  /** 面向用户的中文推荐理由，必须能单独读懂。 */
  reason: string
  /** 命中的具体兴趣标签，用于解释「为什么给你看」。 */
  matchedTags: string[]
}

type RepoFacts = {
  stars?: number
  updatedAt?: string
  topics?: string[]
  hasDescription: boolean
}

/** 从 metadata 里读事实。非 GitHub 来源没有这些字段时优雅退化。 */
function readRepoFacts(candidate: Candidate): RepoFacts {
  const meta = (candidate.metadata ?? {}) as Record<string, unknown>
  return {
    stars: typeof meta.stars === 'number' ? meta.stars : undefined,
    updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : candidate.sourcePublishedAt,
    topics: Array.isArray(meta.topics) ? (meta.topics as string[]) : undefined,
    hasDescription: Boolean(candidate.description && candidate.description.trim()),
  }
}

/** 实用价值：只用可核对的信号，属于粗略代理，不是真实有用程度的判断。 */
function valueScore(facts: RepoFacts) {
  let score = 0.3
  if (typeof facts.stars === 'number') {
    if (facts.stars >= 20_000) score = 0.9
    else if (facts.stars >= 5_000) score = 0.75
    else if (facts.stars >= 1_000) score = 0.6
    else if (facts.stars >= 200) score = 0.45
    else score = 0.3
  }
  if (facts.hasDescription) score += 0.08
  if (facts.topics && facts.topics.length > 0) score += 0.04
  return clamp01(score)
}

/** 最近活跃：按最近更新时间分档，没有时间就取中性值。 */
function activityScore(facts: RepoFacts, now: number) {
  if (!facts.updatedAt) return 0.4
  const time = new Date(facts.updatedAt).getTime()
  if (!Number.isFinite(time)) return 0.4
  const days = Math.max(0, (now - time) / 86_400_000)
  if (days <= 7) return 1
  if (days <= 30) return 0.85
  if (days <= 90) return 0.65
  if (days <= 180) return 0.45
  if (days <= 365) return 0.25
  return 0.1
}

/** 兴趣匹配：把候选标签对画像标签权重取平均，再按画像里的最强兴趣归一化。 */
function interestScore(tags: string[], profile: InterestProfile) {
  if (!hasProfile(profile) || tags.length === 0) {
    return { raw: 0, matched: [] as string[] }
  }
  const maxWeight = Math.max(...Object.values(profile.tagWeights), 1)
  const weights = tags.map((tag) => profile.tagWeights[tag] ?? 0)
  const matched = tags.filter((tag) => (profile.tagWeights[tag] ?? 0) > 0)
  const average = weights.reduce((sum, value) => sum + value, 0) / tags.length
  return { raw: clamp01(average / maxWeight), matched }
}

/** 新颖度：用户没看过的最新高，看过多次的最低。 */
function noveltyScore(toolId: string, likes: number, profile: InterestProfile) {
  const views = profile.viewCountByTool[toolId] ?? 0
  let score = views === 0 ? 1 : views === 1 ? 0.4 : 0.15
  if (likes <= 0) score += 0.1
  return clamp01(score)
}

/**
 * 探索奖励：候选标签越是画像里没有的，分越高。
 * 这是「探索」页能扩大范围、而不是永远推同一类东西的机制。
 */
function exploreScore(tags: string[], profile: InterestProfile) {
  if (tags.length === 0) return 0.5
  if (!hasProfile(profile)) return 0.6
  const known = tags.filter((tag) => (profile.tagWeights[tag] ?? 0) !== 0).length
  if (known === 0) return 1
  if (known === tags.length) return 0.1
  return 0.5
}

export function scoreCandidate(entry: PooledCandidate, profile: InterestProfile, now = Date.now()): ScoredCandidate {
  const { candidate } = entry
  const tags = candidate.tags ?? []
  const facts = readRepoFacts(candidate)
  const reasonCodes: string[] = []

  const interest = interestScore(tags, profile)
  const value = valueScore(facts)
  const novelty = noveltyScore(candidate.sourceItemId ?? entry.canonicalUrl, entry.seenCount, profile)
  const activity = activityScore(facts, now)
  const trust = SOURCE_TRUST[candidate.sourceId] ?? DEFAULT_TRUST
  const explore = exploreScore(tags, profile)

  if (!hasProfile(profile)) reasonCodes.push('interest:no-profile')
  else if (interest.matched.length >= 2) reasonCodes.push('interest:strong-match')
  else if (interest.matched.length === 1) reasonCodes.push('interest:partial-match')
  else reasonCodes.push('interest:no-match')

  if (novelty >= 0.9) reasonCodes.push('novelty:first-time')
  else reasonCodes.push('novelty:seen-before')
  if (activity >= 0.85) reasonCodes.push('activity:active')
  else if (activity <= 0.25) reasonCodes.push('activity:stale')
  if (value >= 0.75) reasonCodes.push('value:popular')
  else if (value <= 0.4) reasonCodes.push('value:obscure')
  if (explore >= 1) reasonCodes.push('explore:broaden')
  else if (explore <= 0.1) reasonCodes.push('explore:known-area')
  // 来源的解释必须按 sourceId 精确对应，不能用可信度数值分档。
  // 曾经用 trust >= 0.7 兜底，结果 github-discovery（0.7）和 github-similar（0.75）
  // 落到同一档，通用探索被说成「从你感兴趣的项目延伸出来的」——凭空编造了关系。
  reasonCodes.push(TRUST_REASON_CODES[candidate.sourceId] ?? 'trust:discovery')

  const parts: ScorePart[] = (Object.keys(SCORE_WEIGHTS) as Array<keyof typeof SCORE_WEIGHTS>).map((key) => {
    const raw = { interest: interest.raw, value, novelty, activity, trust, explore }[key]
    return { key, label: SCORE_LABELS[key], raw, weight: SCORE_WEIGHTS[key], weighted: raw * SCORE_WEIGHTS[key] }
  })

  let total = parts.reduce((sum, part) => sum + part.weighted, 0)

  const toolId = candidate.sourceItemId ?? entry.canonicalUrl
  if (profile.dismissedToolIds.includes(toolId)) {
    total *= DISMISS_PENALTY
    reasonCodes.push('penalty:dismissed')
  } else if (profile.skippedToolIds.includes(toolId)) {
    total *= SKIP_PENALTY
    reasonCodes.push('penalty:skipped')
  }

  return {
    candidate,
    canonicalUrl: entry.canonicalUrl,
    tags,
    total: clamp01(total),
    parts,
    reasonCodes,
    reason: buildReason({ reasonCodes, profile, tags, matchedTags: interest.matched, title: candidate.title }),
    matchedTags: interest.matched,
  }
}

/**
 * 把评分翻译成一句用户能读懂的中文。
 * 刻意不出现「分数」「权重」「模型」这类词。
 */
export function buildReason(input: {
  reasonCodes: string[]
  profile: InterestProfile
  tags: string[]
  matchedTags: string[]
  title?: string
}): string {
  const { reasonCodes, profile, matchedTags } = input
  const name = input.title ? `「${input.title}」` : '它'

  if (reasonCodes.includes('penalty:dismissed')) return `你之前说过不再推荐类似的，所以先放在后面，不会直接消失。`
  if (reasonCodes.includes('penalty:skipped')) return `你之前跳过过它，这次排在后面，想看还是能翻到。`
  if (reasonCodes.includes('interest:no-profile')) return `还没有足够的偏好信号，先放一批不同类型的项目让你挑，你的兴趣会随着点击慢慢长出来。`
  if (matchedTags.length >= 2) return `你最近对「${matchedTags[0]}」「${matchedTags[1]}」这类东西有兴趣，${name}正好在这个方向上。`
  if (matchedTags.length === 1) return `你之前点过「${matchedTags[0]}」方向的项目，${name}和它相邻，可以先看一眼。`
  if (reasonCodes.includes('explore:broaden')) return `这是一个你还没接触过的方向，放进来帮你看看有没有新兴趣。`
  if (reasonCodes.includes('trust:self-curated')) return `这是你自己收藏过或主动丢进来的项目，值得再看一遍。`
  if (reasonCodes.includes('activity:active') && reasonCodes.includes('value:popular')) {
    const top = profile.topTags[0]
    return top ? `它最近还在更新，口碑也不错；虽然不在你常看的「${top.label}」里，但可能用得上。` : `它最近还在更新，口碑也不错，可能用得上。`
  }
  return `它和你看过的一些项目相邻，先放进来让你判断值不值得试。`
}

export type DiversifyOptions = {
  /** 连续多少张不能是同一个来源或同一个标签。 */
  maxRunLength?: number
  /** 单一来源最多占本页的比例。 */
  maxSourceShare?: number
  limit?: number
}

/**
 * 多样性重排（手册 13.3 的硬规则）。
 *
 * 严格保证「连续 maxRunLength 张不是同一来源、也不是同一标签」，
 * 实在放不下时按原顺序收尾——宁可少一点多样性，也不能丢卡片。
 */
export function diversify(scored: ScoredCandidate[], options: DiversifyOptions = {}): ScoredCandidate[] {
  const maxRun = Math.max(2, options.maxRunLength ?? 3)
  const maxShare = options.maxSourceShare ?? 0.6
  const out: ScoredCandidate[] = []
  const pending = [...scored]
  let relaxSource = false

  while (pending.length > 0) {
    let index = pickNext(out, pending, maxRun, maxShare, relaxSource)
    if (index < 0 && !relaxSource) {
      // 整个池子只有一个来源时（现在只有 GitHub 探索一个连接器，这是常态），
      // 来源规则不可能满足。这时退一步只保证「不连续三张同标签」，
      // 而不是直接放弃重排把同类标签堆在一起。
      relaxSource = true
      index = pickNext(out, pending, maxRun, maxShare, true)
    }
    if (index < 0) {
      // 连标签规则都排不出来了，按分数顺序收尾，宁可少一点多样性也不能丢卡片。
      out.push(...pending)
      break
    }
    out.push(pending.splice(index, 1)[0])
  }

  return options.limit ? out.slice(0, options.limit) : out
}

function primaryTag(item: ScoredCandidate) {
  return item.tags[0]
}

/** 连续 maxRun 张不能同来源、也不能同标签。relaxSource 时只看标签。 */
function violatesRun(out: ScoredCandidate[], item: ScoredCandidate, maxRun: number, relaxSource: boolean) {
  const recent = out.slice(-(maxRun - 1))
  if (recent.length < maxRun - 1 || recent.length === 0) return false
  if (!relaxSource && recent.every((entry) => entry.candidate.sourceId === item.candidate.sourceId)) return true
  const tag = primaryTag(item)
  return Boolean(tag) && recent.every((entry) => primaryTag(entry) === tag)
}

function withinShare(out: ScoredCandidate[], item: ScoredCandidate, maxShare: number, relaxSource: boolean) {
  if (relaxSource) return true
  if (out.length < 3) return true
  const sameSource = out.filter((entry) => entry.candidate.sourceId === item.candidate.sourceId).length
  return sameSource / (out.length + 1) < maxShare
}

/**
 * 在还能放的位置里挑一个。
 *
 * 单纯「按顺序放第一个能放的」会把某一类全部留到最后，最后只能连排收尾。
 * 所以这里优先消耗「剩余数量最多」的来源或标签，先把大头均匀摊开。
 * 分享上限只是软约束：如果所有可选位置都超了上限，就照常放，避免把自己饿死。
 */
function pickNext(out: ScoredCandidate[], pending: ScoredCandidate[], maxRun: number, maxShare: number, relaxSource: boolean) {
  const placeable: number[] = []
  for (let index = 0; index < pending.length; index += 1) {
    if (!violatesRun(out, pending[index], maxRun, relaxSource)) placeable.push(index)
  }
  if (placeable.length === 0) return -1

  const underShare = placeable.filter((index) => withinShare(out, pending[index], maxShare, relaxSource))
  const candidates = underShare.length > 0 ? underShare : placeable

  let best = candidates[0]
  let bestPressure = -1
  for (const index of candidates) {
    const item = pending[index]
    const tag = primaryTag(item)
    const sourceRemaining = pending.filter((entry) => entry.candidate.sourceId === item.candidate.sourceId).length
    const tagRemaining = tag ? pending.filter((entry) => primaryTag(entry) === tag).length : 0
    // relaxSource 时来源已经不重要了，压力只看标签。
    const pressure = relaxSource ? tagRemaining : Math.max(sourceRemaining, tagRemaining)
    if (pressure > bestPressure) {
      bestPressure = pressure
      best = index
    }
  }
  return best
}

/** 排序 + 重排的完整流水线。 */
export function rankCandidates(
  entries: PooledCandidate[],
  profile: InterestProfile,
  options: DiversifyOptions & { now?: number } = {},
): ScoredCandidate[] {
  const scored = entries
    .map((entry) => scoreCandidate(entry, profile, options.now))
    .sort((a, b) => b.total - a.total || a.canonicalUrl.localeCompare(b.canonicalUrl))
  return diversify(scored, options)
}

export type ProfileSummaryLine = { label: string; detail: string }

/**
 * 给「我的兴趣」弹窗用的中文摘要。
 * 放在服务端算，避免前端再实现一遍权重逻辑。
 */
export function summarizeProfile(profile: InterestProfile) {
  const lines: ProfileSummaryLine[] = []

  if (profile.topTags.length > 0) {
    lines.push({
      label: '你在意的方向',
      detail: profile.topTags.map((entry) => `${entry.label}（${entry.weight > 0 ? '+' : ''}${entry.weight}）`).join('、'),
    })
  }
  if (profile.topSourceKinds.length > 0) {
    lines.push({ label: '你常看的来源', detail: profile.topSourceKinds.map((entry) => entry.label).join('、') })
  }
  if (profile.topSourceIds.length > 0) {
    lines.push({ label: '你常走的入口', detail: profile.topSourceIds.map((entry) => entry.label).join('、') })
  }

  const dismissed = profile.dismissedToolIds.length
  const skipped = profile.skippedToolIds.length
  if (dismissed > 0 || skipped > 0) {
    lines.push({ label: '你不想看的', detail: `${dismissed} 个已标记不再推荐，${skipped} 个已跳过（仍可翻到）` })
  }

  const positive = profile.positiveCount
  const negative = profile.negativeCount
  lines.push({ label: '你的动作', detail: `留下 ${positive} 次喜欢/收藏/Star 这类正向动作，${negative} 次跳过或不想看。` })

  return {
    hasProfile: hasProfile(profile),
    headline: hasProfile(profile)
      ? '这些是你点出来的兴趣，会用来决定先给你看什么。'
      : '还没有足够的偏好信号。随便点点喜欢、收藏或跳过，画像就会开始形成。',
    updatedAt: profile.updatedAt,
    lines,
  }
}

/**
 * 把 reasonCode 翻成人话，用于详情弹窗里的「为什么会有这张卡片」。
 * 这是给用户看的透明度，不是给开发者看的日志，所以不出现代码名和数字。
 */
const REASON_CODE_TEXT: Record<string, string> = {
  'interest:no-profile': '你还没有留下足够的偏好信号，这张属于探索性质。',
  'interest:strong-match': '命中多个你关注过的方向。',
  'interest:partial-match': '命中一个你关注过的方向。',
  'interest:no-match': '不在你已有关注的方向里，用来拓宽范围。',
  'novelty:first-time': '这是你第一次看到它。',
  'novelty:seen-before': '你之前已经看过它。',
  'activity:active': '项目最近还在更新。',
  'activity:stale': '项目有段时间没更新了。',
  'value:popular': '关注它的人比较多。',
  'value:obscure': '关注它的人还不多，属于冷门探索。',
  'explore:broaden': '这是你还没接触过的方向。',
  'explore:known-area': '这是你已经熟悉的领域。',
  'trust:self-curated': '这是你自己收藏过或主动找来的。',
  'trust:related': '这是你从一个感兴趣的项目继续找出来的。',
  'trust:discovery': '这来自通用探索，不是根据你的收藏推出来的。',
  'penalty:skipped': '你之前跳过过它，所以排在后面。',
  'penalty:dismissed': '你标记过不想看类似的，所以放在很后面，但不会消失。',
}

export function explainReasonCodes(codes: string[]): string[] {
  return codes.map((code) => REASON_CODE_TEXT[code]).filter((text): text is string => Boolean(text))
}
