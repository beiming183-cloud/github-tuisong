/**
 * 连接器与候选池的本地自检。
 *
 * 特点：不联网、不读 .env、不接触任何密钥，可以随时运行。
 * 运行：npm run check
 *
 * 新增来源连接器时，请在这里补上 canonicalUrl 归一化和去重的用例，
 * 因为跨来源去重一旦出错，用户就会看到重复卡片。
 */
import { canonicalizeUrl, clearPool, poolStats, upsertCandidates } from './candidates.js'
import { candidateToTool, repoToCandidate, repoToTool, type GitHubRepo } from './connectors/github.js'

let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) console.log(`      期望: ${JSON.stringify(expected)}\n      实际: ${JSON.stringify(actual)}`)
}

console.log('\n— canonicalizeUrl：同一项目的不同写法必须归一成同一个键 —')
check('github 深链接折叠到 owner/repo',
  canonicalizeUrl('https://github.com/Owner/Repo/tree/main'), 'https://github.com/owner/repo')
check('去掉 www. 和 .git 后缀',
  canonicalizeUrl('https://www.github.com/owner/repo.git'), 'https://github.com/owner/repo')
check('去掉末尾斜杠',
  canonicalizeUrl('https://github.com/owner/repo/'), 'https://github.com/owner/repo')
check('owner/repo 大小写不敏感',
  canonicalizeUrl('https://github.com/Owner/Repo'), 'https://github.com/owner/repo')
check('去掉 utm 等跟踪参数，保留业务参数',
  canonicalizeUrl('https://example.com/post?utm_source=x&id=1&fbclid=y'), 'https://example.com/post?id=1')
check('去掉锚点',
  canonicalizeUrl('https://example.com/a#section'), 'https://example.com/a')
check('非 github 域名保留路径大小写',
  canonicalizeUrl('HTTPS://Example.COM/Path/'), 'https://example.com/Path')
check('无法解析的字符串退化为小写原文，不抛错',
  canonicalizeUrl('  Not A Url  '), 'not a url')

console.log('\n— 候选池：同批和跨批都必须去重 —')
clearPool()

const repo: GitHubRepo = {
  id: 12345,
  name: 'Example',
  full_name: 'owner/example',
  html_url: 'https://github.com/owner/example',
  description: '一个用来测试的仓库',
  stargazers_count: 4321,
  language: 'TypeScript',
  topics: ['cli'],
  pushed_at: new Date().toISOString(),
  owner: { login: 'owner' },
  archived: false,
  fork: false,
}

const first = upsertCandidates([repoToCandidate(repo), repoToCandidate(repo)])
check('同一批里重复出现只算一次新增', [first.addedCount, first.duplicateCount], [1, 1])

const second = upsertCandidates([repoToCandidate(repo, 'github-stars', '我的 GitHub Star')])
check('跨批重复不再算新增', [second.addedCount, second.duplicateCount], [0, 1])
check('同一候选记录到多个来源', poolStats().bySource, { 'github-discovery': 1, 'github-stars': 1 })
check('多来源候选被计入 multiSource', poolStats().multiSource, 1)

const third = upsertCandidates([repoToCandidate({ ...repo, id: 999, html_url: 'https://github.com/owner/example/issues/1' })])
check('带子路径的同一项目也被去重', [third.addedCount, third.poolSize], [0, 1])

console.log('\n— 候选 → 卡片：往返不能丢字段 —')
const candidate = repoToCandidate(repo)
const tool = candidateToTool(candidate)
check('卡片名称与 Star 保留',
  [tool?.name, tool?.repository?.stars, tool?.source], ['Example', 4321, 'https://github.com/owner/example'])
check('卡片语言与标签保留',
  [tool?.repository?.language, (tool?.tags?.length ?? 0) > 0], ['TypeScript', true])
check('直接渲染与往返渲染结果一致（sourceId 是候选独有的来源标记）',
  { ...repoToTool(repo), sourceId: 'github-discovery' }, { ...tool })
check('往返渲染带上来源 id，供前端上报行为用', tool?.sourceId, 'github-discovery')
check('评分用的标签和卡片显示的标签完全一致',
  tool?.tags, repoToTool(repo).tags)
check('缺少 GitHub metadata 的候选不会生成卡片',
  candidateToTool({ canonicalUrl: 'https://example.com/x', sourceKind: 'rss', sourceId: 'rss', sourceLabel: 'RSS' }), undefined)

clearPool()

console.log(`\n${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
