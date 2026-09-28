/**
 * 兴趣画像与评分的本地自检。
 *
 * 不联网、不读 .env、不写 data/（用的是内存里构造的事件和候选）。
 * 运行：npm run check
 *
 * 调整 EVENT_WEIGHTS、SCORE_WEIGHTS、SOURCE_TRUST 或评分公式时，
 * 必须同步更新这里的用例和交接手册第 13.2 节。
 */
import type { PooledCandidate } from './candidates.js'
import type { Candidate } from './connectors/types.js'
import { EVENT_WEIGHTS, type UserEvent } from './events.js'
import {
  SCORE_WEIGHTS,
  buildInterestProfile,
  diversify,
  explainReasonCodes,
  hasProfile,
  rankCandidates,
  scoreCandidate,
  summarizeProfile,
} from './recommend.js'

let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) console.log(`      期望: ${JSON.stringify(expected)}\n      实际: ${JSON.stringify(actual)}`)
}

function checkTrue(label: string, actual: boolean) {
  check(label, actual, true)
}

const now = Date.now()
const iso = (offsetDays = 0) => new Date(now - offsetDays * 86_400_000).toISOString()

function makeCandidate(overrides: Partial<Candidate> = {}, pool: Partial<PooledCandidate> = {}): PooledCandidate {
  const candidate: Candidate = {
    canonicalUrl: 'https://github.com/owner/repo',
    sourceItemId: 'github-1',
    title: 'repo',
    description: '一个用来测试的仓库',
    tags: ['开源工具'],
    sourceKind: 'github',
    sourceId: 'github-discovery',
    sourceLabel: 'GitHub 项目',
    sourcePublishedAt: iso(0),
    metadata: { stars: 1200, updatedAt: iso(1), topics: ['cli'] },
    ...overrides,
  }
  return {
    candidate,
    canonicalUrl: candidate.canonicalUrl,
    firstSeenAt: iso(0),
    lastSeenAt: iso(0),
    seenCount: 1,
    sourceIds: [candidate.sourceId],
    ...pool,
  }
}

function makeEvent(overrides: Partial<UserEvent> = {}): UserEvent {
  return { id: 'e1', toolId: 'github-1', event: 'like', occurredAt: iso(0), ...overrides }
}

console.log('\n— 权重必须和交接手册 13.2 / 13.3 一致 —')
check('事件权重与手册一致',
  { star: EVENT_WEIGHTS.star, save: EVENT_WEIGHTS.save, like: EVENT_WEIGHTS.like, compare: EVENT_WEIGHTS.compare, view: EVENT_WEIGHTS.view, open_source: EVENT_WEIGHTS.open_source, skip: EVENT_WEIGHTS.skip, dismiss: EVENT_WEIGHTS.dismiss },
  { star: 5, save: 4, like: 3, compare: 2, view: 1, open_source: 2, skip: -2, dismiss: -4 })
check('六个维度权重合计为 1',
  Math.round(Object.values(SCORE_WEIGHTS).reduce((sum, value) => sum + value, 0) * 100) / 100, 1)

console.log('\n— 兴趣画像：只做加权计数，不猜 —')
const emptyProfile = buildInterestProfile([])
check('没有事件时画像为空', hasProfile(emptyProfile), false)
check('没有事件时没有标签权重', emptyProfile.topTags, [])

const profile = buildInterestProfile([
  makeEvent({ event: 'save', tags: ['文件工具', '本地运行'] }),
  makeEvent({ event: 'star', tags: ['文件工具'] }),
  makeEvent({ event: 'view', tags: ['AI 工具'] }),
  makeEvent({ event: 'skip', toolId: 'github-9', tags: ['AI 工具'] }),
  makeEvent({ event: 'dismiss', toolId: 'github-8' }),
])
checkTrue('有正向动作后画像成立', hasProfile(profile))
check('标签权重按事件权重累加：文件工具 = 4 + 5', profile.tagWeights['文件工具'], 9)
check('负向事件拉低标签权重：AI 工具 = 1 - 2', profile.tagWeights['AI 工具'], -1)
check('最强兴趣标签排在最前', profile.topTags[0].label, '文件工具')
check('跳过的项目被单独记录', profile.skippedToolIds, ['github-9'])
check('不再推荐的项目被单独记录', profile.dismissedToolIds, ['github-8'])
check('看过次数被记录', profile.viewCountByTool['github-1'], 1)

console.log('\n— 评分：每个维度都要能被讲出来 —')
const scored = scoreCandidate(makeCandidate(), profile, now)
check('分数落在 0..1', scored.total >= 0 && scored.total <= 1, true)
check('六个维度都有取值', scored.parts.map((part) => part.key),
  ['interest', 'value', 'novelty', 'activity', 'trust', 'explore'])
check('加权分等于原始分乘权重',
  scored.parts.every((part) => Math.abs(part.weighted - part.raw * part.weight) < 1e-9), true)

const liked = scoreCandidate(makeCandidate({ tags: ['文件工具'] }), profile, now)
const unknown = scoreCandidate(makeCandidate({ tags: ['完全没见过的方向'] }), profile, now)
checkTrue('命中已有关注方向的候选，兴趣分更高', liked.parts[0].raw > unknown.parts[0].raw)
checkTrue('没见过的方向，探索分更高',
  unknown.parts.find((part) => part.key === 'explore')!.raw > liked.parts.find((part) => part.key === 'explore')!.raw)

const fresh = scoreCandidate(makeCandidate({ metadata: { stars: 1200, updatedAt: iso(2) } }), profile, now)
const stale = scoreCandidate(makeCandidate({ metadata: { stars: 1200, updatedAt: iso(400) } }), profile, now)
checkTrue('最近更新的活跃分更高', fresh.parts[3].raw > stale.parts[3].raw)

const curated = scoreCandidate(makeCandidate({ sourceId: 'manual' }), profile, now)
const discovery = scoreCandidate(makeCandidate({ sourceId: 'github-discovery' }), profile, now)
checkTrue('自己丢进来的链接，来源可信度更高',
  curated.parts.find((part) => part.key === 'trust')!.raw > discovery.parts.find((part) => part.key === 'trust')!.raw)

// 回归：来源解释必须按 sourceId 精确对应，不能按可信度数值分档。
// 曾经用 trust >= 0.7 兜底，导致通用探索被说成「从你感兴趣的项目延伸出来的」。
check('通用探索的来源标记为 trust:discovery',
  discovery.reasonCodes.includes('trust:discovery'), true)
check('通用探索的解释不声称与用户兴趣有关',
  explainReasonCodes(discovery.reasonCodes).includes('这来自通用探索，不是根据你的收藏推出来的。'), true)
check('相似项目搜索的来源标记为 trust:related',
  scoreCandidate(makeCandidate({ sourceId: 'github-similar' }), profile, now).reasonCodes.includes('trust:related'), true)
check('自己收藏的来源标记为 trust:self-curated',
  scoreCandidate(makeCandidate({ sourceId: 'github-stars' }), profile, now).reasonCodes.includes('trust:self-curated'), true)

const viewed = scoreCandidate(makeCandidate({ sourceItemId: 'github-1' }), profile, now)
const unviewed = scoreCandidate(makeCandidate({ sourceItemId: 'github-2' }), profile, now)
checkTrue('看过的项目新颖度更低',
  unviewed.parts.find((part) => part.key === 'novelty')!.raw > viewed.parts.find((part) => part.key === 'novelty')!.raw)

console.log('\n— 硬规则：跳过降权但不隐藏，不再推荐也不永久删除 —')
const sameTool = { sourceItemId: 'github-9' }
const baseProfile = buildInterestProfile([makeEvent({ event: 'like', tags: ['开源工具'] })])
const skippedProfile = buildInterestProfile([
  makeEvent({ event: 'like', tags: ['开源工具'] }),
  makeEvent({ event: 'skip', toolId: 'github-9' }),
])
const baseScore = scoreCandidate(makeCandidate(sameTool), baseProfile, now)
const skippedScore = scoreCandidate(makeCandidate(sameTool), skippedProfile, now)
checkTrue('跳过过的项目分数被拉低', skippedScore.total < baseScore.total)
checkTrue('跳过过的项目带上降权标记', skippedScore.reasonCodes.includes('penalty:skipped'))
check('跳过后仍然会返回卡片（不隐藏）', Boolean(skippedScore.canonicalUrl), true)

const dismissedProfile = buildInterestProfile([makeEvent({ event: 'dismiss', toolId: 'github-9' })])
const dismissedScore = scoreCandidate(makeCandidate(sameTool), dismissedProfile, now)
checkTrue('标记不再推荐的项目被重罚', dismissedScore.reasonCodes.includes('penalty:dismissed'))
checkTrue('不再推荐的项目也仍然可返回', Boolean(dismissedScore.canonicalUrl))

console.log('\n— 推荐理由：必须是中文人话，不能出现术语 —')
const noProfileScore = scoreCandidate(makeCandidate(), emptyProfile, now)
checkTrue('没有画像时说明还没有信号',
  noProfileScore.reason.includes('还没有足够的偏好信号'))
checkTrue('有匹配时说出具体方向', liked.reason.includes('文件工具'))
for (const item of [scored, liked, unknown, noProfileScore, dismissedScore]) {
  const banned = ['分数', '权重', '模型', 'embedding', 'ranking']
  checkTrue(`理由不含术语（${item.reason.slice(0, 12)}…）`, banned.every((word) => !item.reason.includes(word)))
}

console.log('\n— 多样性重排：连续 3 张不能同来源或同标签 —')
const crowded = Array.from({ length: 9 }, (_, index) => makeCandidate({
  canonicalUrl: `https://github.com/owner/repo-${index}`,
  sourceItemId: `github-${index}`,
  tags: ['同一个标签'],
  sourceId: 'github-discovery',
}))
const diversified = diversify(crowded.map((entry) => scoreCandidate(entry, profile, now)))
check('重排不丢卡片', diversified.length, crowded.length)

const mixed = [
  ...Array.from({ length: 6 }, (_, index) => makeCandidate({
    canonicalUrl: `https://github.com/a/a-${index}`, sourceItemId: `a-${index}`, tags: ['标签A'], sourceId: 'github-discovery',
  })),
  ...Array.from({ length: 6 }, (_, index) => makeCandidate({
    canonicalUrl: `https://github.com/b/b-${index}`, sourceItemId: `b-${index}`, tags: ['标签B'], sourceId: 'github-stars',
  })),
]
const mixedRanked = diversify(mixed.map((entry) => scoreCandidate(entry, profile, now)))
let maxSourceRun = 1
let maxTagRun = 1
let sourceRun = 1
let tagRun = 1
for (let index = 1; index < mixedRanked.length; index += 1) {
  sourceRun = mixedRanked[index].candidate.sourceId === mixedRanked[index - 1].candidate.sourceId ? sourceRun + 1 : 1
  tagRun = mixedRanked[index].tags[0] === mixedRanked[index - 1].tags[0] ? tagRun + 1 : 1
  maxSourceRun = Math.max(maxSourceRun, sourceRun)
  maxTagRun = Math.max(maxTagRun, tagRun)
}
checkTrue('同来源连续不超过 2 张', maxSourceRun <= 2)
checkTrue('同标签连续不超过 2 张', maxTagRun <= 2)

console.log('\n— 排序接口 —')
const entries = [
  makeCandidate({ canonicalUrl: 'https://github.com/x/1', sourceItemId: 'x1', tags: ['文件工具'] }),
  makeCandidate({ canonicalUrl: 'https://github.com/x/2', sourceItemId: 'x2', tags: ['没见过的标签'] }),
]
const ranked = rankCandidates(entries, profile, { limit: 1, now })
check('limit 生效', ranked.length, 1)
checkTrue('返回结构包含理由和分项', Boolean(ranked[0].reason) && ranked[0].parts.length === 6)

console.log('\n— 画像摘要 —')
const summaryEmpty = summarizeProfile(emptyProfile)
check('空画像时明确说还不够', summaryEmpty.hasProfile, false)
checkTrue('空画像的说明是中文人话', summaryEmpty.headline.includes('还没有足够的偏好信号'))
const summary = summarizeProfile(profile)
check('有画像时列出方向', summary.lines[0].label, '你在意的方向')
checkTrue('摘要里出现具体标签', summary.lines[0].detail.includes('文件工具'))

console.log(`\n${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
