/**
 * 分析队列的本地自检。
 *
 * 不联网、不读 .env、不需要 DeepSeek Key —— 分析器是注入的假函数。
 * 这一点很重要：队列的价值在于「有界、可续跑、不重复、不乱记状态」，
 * 这些性质与模型本身无关，必须在没有 Key 的情况下也能验证。
 *
 * 运行：npm run check
 */
import { analysisBacklog, analysisStateOf, candidateToAiInput, clampBatchSize, runAnalysisBatch, selectAnalysisBatch } from './analysis.js'
import { applyAiPatches, clearPool, findInPool, listPool, mergeStatus, upsertCandidates } from './candidates.js'
import type { Candidate } from './connectors/types.js'

// 候选池默认就是内存态（持久化必须由服务启动时显式开启），
// 所以这里不需要、也**不应该**调用 enableCandidatePersistence，
// 否则会在当前工作目录下建出一个 openradar.sqlite。
clearPool()

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

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  const repoId = overrides.metadata && typeof (overrides.metadata as { repoId?: number }).repoId === 'number'
    ? (overrides.metadata as { repoId: number }).repoId
    : Math.floor(Math.random() * 1_000_000)
  return {
    canonicalUrl: `https://github.com/owner/repo-${repoId}`,
    sourceItemId: `github-${repoId}`,
    title: `repo-${repoId}`,
    description: '一个用来测试的仓库',
    tags: ['开源工具'],
    sourceKind: 'github',
    sourceId: 'github-discovery',
    sourceLabel: 'GitHub 项目',
    metadata: { repoId, owner: 'owner', name: `repo-${repoId}`, fullName: `owner/repo-${repoId}`, stars: 1200, language: 'TypeScript', topics: [], updatedAt: new Date().toISOString() },
    ...overrides,
  }
}

console.log('\n— 状态合并：终态不能被重新同步降级 —')
check('ready 不能把 analyzed 降级', mergeStatus('analyzed', 'ready'), 'analyzed')
check('ready 不能把 dismissed 降级', mergeStatus('dismissed', 'ready'), 'dismissed')
check('pending 可以前进到 ready', mergeStatus('pending', 'ready'), 'ready')
check('没有状态时接受新状态', mergeStatus(undefined, 'ready'), 'ready')
check('新状态为空时保留原状态', mergeStatus('analyzed', undefined), 'analyzed')

// 这是实际会发生的路径：连接器每次抓到同一个仓库都会带 status: 'ready'。
clearPool()
upsertCandidates([makeCandidate({ sourceItemId: 'github-777', metadata: { repoId: 777, owner: 'o', name: 'r', fullName: 'o/r', stars: 10, language: null, topics: [], updatedAt: new Date().toISOString() } })])
applyAiPatches([{ id: 'github-777', title: 'AI 标题', summary: 'AI 摘要', tags: ['AI'], fit: '值得认识', difficulty: '上手低', value: '日常价值高' }])
check('分析后状态是 analyzed', findInPool('https://github.com/owner/repo-777')?.candidate.status, 'analyzed')
upsertCandidates([makeCandidate({ sourceItemId: 'github-777', metadata: { repoId: 777, owner: 'o', name: 'r', fullName: 'o/r', stars: 10, language: null, topics: [], updatedAt: new Date().toISOString() } })])
check('重新同步后仍然是 analyzed（回归：以前会被降级成 ready）',
  findInPool('https://github.com/owner/repo-777')?.candidate.status, 'analyzed')

console.log('\n— applyAiPatches 的匹配：Telegram 候选以前完全写不回去 —')
clearPool()
// Telegram 候选的 sourceItemId 与卡片 id 不一致，这正是以前的 bug。
upsertCandidates([{
  ...makeCandidate({ metadata: { repoId: 888, owner: 'o', name: 'r2', fullName: 'o/r2', stars: 5, language: null, topics: [], updatedAt: new Date().toISOString() } }),
  canonicalUrl: 'https://github.com/owner/repo-888',
  sourceItemId: 'telegram-code_stars-42-888',
  sourceKind: 'telegram',
  sourceId: 'telegram-public:code_stars',
}])
check('按 sourceItemId 能写回', applyAiPatches([{ id: 'telegram-code_stars-42-888', title: 'T', summary: 'S' } as never]), 1)
checkTrue('写回后带上 analyzedAt', Boolean(findInPool('https://github.com/owner/repo-888')?.candidate.metadata?.analyzedAt))

clearPool()
upsertCandidates([{ ...makeCandidate({ metadata: { repoId: 889, owner: 'o', name: 'r3', fullName: 'o/r3', stars: 5, language: null, topics: [], updatedAt: new Date().toISOString() } }), canonicalUrl: 'https://github.com/owner/repo-889', sourceItemId: 'telegram-x-1-889' }])
check('按卡片 id（github-<repoId>）也能写回（前端只回传 Tool id）', applyAiPatches([{ id: 'github-889', title: 'T', summary: 'S' } as never]), 1)

console.log('\n— 批次大小必须有界 —')
check('默认批次', clampBatchSize(undefined), 6)
check('超过上限被压到 8', clampBatchSize(999), 8)
check('0 或负数回落到默认', [clampBatchSize(0), clampBatchSize(-3)], [6, 6])

console.log('\n— 积压统计 —')
clearPool()
upsertCandidates([makeCandidate({ status: 'ready' }), makeCandidate({ status: 'ready' }), makeCandidate({ status: 'pending' }), makeCandidate({ status: 'filtered' })])
let backlog = analysisBacklog()
check('总数为 4', backlog.total, 4)
check('需要分析 2 个', backlog.needsAnalysis, 2)
check('不适合分析 2 个（pending + filtered）', backlog.notEligible, 2)
check('选中 2 个', selectAnalysisBatch().length, 2)

console.log('\n— 没有配置 DeepSeek 时不能乱标记 —')
clearPool()
upsertCandidates([makeCandidate(), makeCandidate()])
const notConfigured = await runAnalysisBatch({ configured: false, limit: 5, dryRun: false })
check('报告 configured=false', notConfigured.configured, false)
check('没有写回任何东西', notConfigured.applied, 0)
check('两个候选仍然等待分析', analysisBacklog().needsAnalysis, 2)

console.log('\n— dryRun 不改数据 —')
const dry = await runAnalysisBatch({ configured: true, limit: 5, dryRun: true, enricher: async () => { throw new Error('dryRun 不应该调用分析器') } })
check('dryRun 列出了将要处理的 id', dry.ids.length, 2)
check('dryRun 没有写回', dry.applied, 0)
check('dryRun 之后仍然需要分析', analysisBacklog().needsAnalysis, 2)

console.log('\n— 真的跑一批：写回并标记 —')
clearPool()
const seeded = [makeCandidate(), makeCandidate(), makeCandidate()]
upsertCandidates(seeded)
const seenIds: string[] = []
const result = await runAnalysisBatch({
  configured: true,
  limit: 2,
  dryRun: false,
  enricher: async (tools) => {
    seenIds.push(...tools.map((tool) => tool.id))
    return tools.map((tool) => ({ id: tool.id, title: 'AI 标题', summary: 'AI 摘要', tags: ['AI'], fit: '值得认识', difficulty: '上手低', value: '日常价值高' }))
  },
})
check('只处理了 2 个（批次有界）', result.attempted, 2)
check('写回 2 个', result.applied, 2)
check('报出剩余 1 个', result.remaining, 1)
check('送出去的 id 用的是 sourceItemId', seenIds.length, 2)
checkTrue('送出去的 id 能在池里找到', seenIds.every((id) => listPool(100).some((entry) => entry.candidate.sourceItemId === id)))
check('处理过的候选状态是 analyzed', analysisBacklog().analyzed, 2)

console.log('\n— 幂等：再跑一次只处理剩下的那个 —')
const second = await runAnalysisBatch({
  configured: true,
  limit: 5,
  dryRun: false,
  enricher: async (tools) => tools.map((tool) => ({ id: tool.id, title: 'AI 标题', summary: 'AI 摘要', tags: ['AI'], fit: '值得认识', difficulty: '上手低', value: '日常价值高' })),
})
check('第二次只处理 1 个', second.attempted, 1)
check('剩余归零', second.remaining, 0)

console.log('\n— 分析器报错时整批留给下次重试 —')
clearPool()
upsertCandidates([makeCandidate(), makeCandidate()])
const failedRun = await runAnalysisBatch({ configured: true, limit: 5, dryRun: false, enricher: async () => { throw new Error('DeepSeek 请求失败（500）') } })
checkTrue('报告了错误', typeof failedRun.error === 'string' && failedRun.error.includes('500'))
check('没有写回', failedRun.applied, 0)
check('两个候选仍然等待分析（没有误记成已分析）', analysisBacklog().needsAnalysis, 2)

console.log('\n— 有结果但没覆盖到的项目标记为跳过，避免堵住队列 —')
clearPool()
upsertCandidates([makeCandidate(), makeCandidate(), makeCandidate()])
const partial = await runAnalysisBatch({
  configured: true,
  limit: 3,
  dryRun: false,
  // 只回答第一个，模拟模型漏答。
  enricher: async (tools) => [{ id: tools[0].id, title: 'T', summary: 'S', tags: [], fit: 'f', difficulty: 'd', value: 'v' }],
})
check('写回 1 个', partial.applied, 1)
check('跳过 2 个', partial.skipped, 2)
check('队列清空，不会反复重做同一批', analysisBacklog().needsAnalysis, 0)

console.log('\n— 送出去的输入不含频道原文 —')
clearPool()
upsertCandidates([makeCandidate({ rawText: '频道原文里可能有推广内容', tags: ['文件工具'] })])
const input = candidateToAiInput(listPool(1)[0])
check('rawText 没有被送进 AI 输入', 'rawText' in input, false)
checkTrue('但名字/标签/仓库信息在', input.name.startsWith('repo-') && input.tags.length === 1 && Boolean(input.repository))

console.log('\n— analysisStateOf 对旧数据的兼容 —')
clearPool()
upsertCandidates([makeCandidate(), { ...makeCandidate(), metadata: { repoId: 4242, owner: 'o', name: 'old', fullName: 'o/old', stars: 1, language: null, topics: [], updatedAt: new Date().toISOString(), aiPatch: { id: 'x' } } }])
const states = listPool(10).map((entry) => analysisStateOf(entry))
checkTrue('只有 aiPatch 没有 analyzedAt 的旧数据也算已分析', states.includes('analyzed'))
check('另一个仍是待分析', states.filter((state) => state === 'needsAnalysis').length, 1)

clearPool()
console.log(`\n${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
