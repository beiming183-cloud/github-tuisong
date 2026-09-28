/**
 * 接口冒烟测试。需要一个已经跑起来的 API。
 *
 * 用法：
 *   npm run smoke                       # 打 http://127.0.0.1:8787
 *   npm run smoke -- http://127.0.0.1:8799
 *
 * 为什么单独放在这里而不是并进 npm run check：
 * check 是纯离线自检（不联网、不起服务），smoke 需要真实进程和真实网络。
 * 两者混在一起会让「基线是否健康」这个判断变得含糊。
 *
 * ⚠️ 这个脚本会写入行为事件。跑之前请把 API 的 OPENRADAR_DATA_DIR 指到临时目录，
 *    否则测试数据会混进你自己的真实兴趣画像。
 */
const baseUrl = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '')

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

async function getJson(path: string) {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) throw new Error(`${path} 返回 ${response.status}`)
  return response.json() as Promise<any>
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${path} 返回 ${response.status}`)
  return response.json() as Promise<any>
}

console.log(`\n冒烟目标：${baseUrl}`)

console.log('\n— 基础接口 —')
const health = await getJson('/api/health')
check('健康检查', health.ok, true)

const sources = await getJson('/api/sources')
checkTrue('来源表返回连接器自检结果', Array.isArray(sources.connectors))
check('来源表里 rss 不再虚标 ready',
  sources.sources.find((item: any) => item.id === 'rss')?.status, 'coming_soon')

console.log('\n— 候选池：抓一批真实 GitHub 候选 —')
const discovered = await getJson('/api/discover/github')
checkTrue('探索返回了候选', discovered.tools.length > 0)
checkTrue('探索结果带 pool 统计', typeof discovered.pool?.size === 'number')
checkTrue('卡片带来源 id', typeof discovered.tools[0].sourceId === 'string')

const second = await getJson('/api/discover/github')
check('同参数第二次请求全部命中已有候选', second.pool.added, 0)
checkTrue('重复数量大于 0', second.pool.duplicates > 0)

console.log('\n— 行为事件与兴趣画像 —')
// 画像按设计是累积的，所以这里比对「本次新增产生的差值」，
// 让冒烟测试可以重复运行而结果稳定。
const profileBefore = await getJson('/api/profile')
const recorded = await postJson('/api/events', {
  events: [
    { toolId: 'smoke-1', event: 'save', sourceKind: 'github', sourceId: 'github-discovery', tags: ['文件工具', '本地运行'] },
    { toolId: 'smoke-1', event: 'save', sourceKind: 'github', sourceId: 'github-discovery', tags: ['文件工具'] },
    { toolId: 'smoke-2', event: 'like', sourceKind: 'github', sourceId: 'github-discovery', tags: ['文件工具'] },
    { toolId: 'smoke-3', event: 'skip', sourceKind: 'github', sourceId: 'github-discovery', tags: ['AI 工具'] },
    { toolId: 'smoke-4', event: 'dismiss' },
  ],
})
check('5 条事件全部入库', [recorded.stored, recorded.rejected], [5, 0])

const badEvents = await postJson('/api/events', {
  events: [{ toolId: '', event: 'like' }, { toolId: 'ok', event: '不是合法事件' }],
})
check('非法事件被跳过而不是整批失败', [badEvents.stored, badEvents.rejected], [0, 2])

const profile = await getJson('/api/profile')
const delta = (pick: (summary: any) => number) => pick(profile) - pick(profileBefore)
checkTrue('画像成立', profile.hasProfile)
check('中文标签在往返过程中没有被破坏，权重正确累加',
  [
    delta((p) => p.profile.tagWeights['文件工具'] ?? 0),
    delta((p) => p.profile.tagWeights['本地运行'] ?? 0),
    delta((p) => p.profile.tagWeights['AI 工具'] ?? 0),
  ], [11, 4, -2])
check('正向动作计数', delta((p) => p.profile.positiveCount), 3)
check('负向动作计数', delta((p) => p.profile.negativeCount), 2)
checkTrue('画像摘要说明了在意的方向',
  profile.lines.some((line: any) => line.label === '你在意的方向' && line.detail.includes('文件工具')))

console.log('\n— 推荐排序与多样性 —')
const recommend = await getJson('/api/recommend?limit=12')
checkTrue('推荐返回了卡片', recommend.tools.length > 0)
checkTrue('每张卡片都带中文推荐理由',
  recommend.tools.every((tool: any) => typeof tool.why === 'string' && tool.why.length > 0))
checkTrue('每张卡片都带透明度说明',
  recommend.tools.every((tool: any) => Array.isArray(tool.reasonDetails)))
checkTrue('卡片带 0..1 的推荐分',
  recommend.tools.every((tool: any) => typeof tool.score === 'number' && tool.score >= 0 && tool.score <= 1))

const scores = recommend.tools.map((tool: any) => tool.score)

// 排序契约：第一张必须是全局最高分（多样化重排不允许把最佳选择挤下去），
// 其余位置允许为了多样性做局部交换，但交换必须是局部的而不是把顺序打乱。
check('第一张卡片是分数最高的那个',
  scores[0], Math.max(...scores))

let inversions = 0
for (let index = 1; index < scores.length; index += 1) {
  if (scores[index] > scores[index - 1]) inversions += 1
}
const pairs = Math.max(scores.length - 1, 1)
checkTrue(`顺序基本保持分数从高到低（${inversions}/${pairs} 对为多样性而交换）`, inversions / pairs <= 0.5)

// 标签多样性在任何情况下都必须成立（池子里只有一个来源时，来源多样性无法满足）。
let maxTagRun = 1
let tagRun = 1
for (let index = 1; index < recommend.tools.length; index += 1) {
  tagRun = recommend.tools[index].tags[0] === recommend.tools[index - 1].tags[0] ? tagRun + 1 : 1
  maxTagRun = Math.max(maxTagRun, tagRun)
}
checkTrue(`同标签连续不超过 2 张（实际最长 ${maxTagRun} 张）`, maxTagRun <= 2)

const distinctSources = new Set(recommend.tools.map((tool: any) => tool.sourceId)).size
let maxSourceRun = 1
let run = 1
for (let index = 1; index < recommend.tools.length; index += 1) {
  run = recommend.tools[index].sourceId === recommend.tools[index - 1].sourceId ? run + 1 : 1
  maxSourceRun = Math.max(maxSourceRun, run)
}
if (distinctSources >= 2) {
  checkTrue(`多来源时同来源连续不超过 2 张（实际最长 ${maxSourceRun} 张）`, maxSourceRun <= 2)
} else {
  console.log(`SKIP  同来源多样性：当前候选只来自 ${distinctSources} 个来源，无法满足也不该假装满足`)
}

console.log('\n— 隐私与泄漏检查 —')
const candidates = await getJson('/api/candidates?limit=5')
checkTrue('候选池只返回地址和计数', candidates.items.every((item: any) => !('rawText' in item) && !('metadata' in item)))
const profileText = JSON.stringify(profile)
checkTrue('画像响应里没有出现密钥字段',
  !profileText.includes('apiKey') && !profileText.includes('accessToken') && !profileText.includes('session'))

console.log(`\n${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
