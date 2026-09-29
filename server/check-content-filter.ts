/**
 * 内容过滤的本地自检。
 *
 * 过滤规则一旦误伤，正经工具会被静默踢出推荐流，而且没有任何报错。
 * 所以正例（该挡的）和反例（不该挡的）都要有用例，尤其是代理类**软件**。
 *
 * 运行：npm run check
 */
import { isFreeResourceRepo, looksLikePromotion } from './contentFilter.js'

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) console.log(`      期望: ${JSON.stringify(expected)}\n      实际: ${JSON.stringify(actual)}`)
}

console.log('\n— 该挡的：免费节点/代理订阅列表 —')
// 这两条是真实数据里漏过去的，描述照抄
check('Free-servers（描述写满免费节点订阅）',
  isFreeResourceRepo({ name: 'Free-servers', description: '🚀 免费订阅地址，🚀 免费节点，🚀 6小时更新一次，共享节点，完全免费，免费clash订阅地址' }), true)
check('openproxylist（仓库名含 proxylist）',
  isFreeResourceRepo({ name: 'openproxylist', description: '收集 HTTPS、SOCKS4/5 和 V2Ray 代理，每小时自动更新' }), true)
check('免费机场订阅合集',
  isFreeResourceRepo({ name: 'free-airport', description: '免费机场订阅合集，每天更新' }), true)
check('free proxy list（英文）',
  isFreeResourceRepo({ name: 'proxy-list', description: 'A free proxy list updated hourly' }), true)
check('节点池',
  isFreeResourceRepo({ name: 'node-pool', description: '公共节点池，定时更新可用节点' }), true)

console.log('\n— 不该挡的：代理/网络类正经工具 —')
const legit = [
  { name: 'clash-verge-rev', description: 'A modern GUI client based on Clash for Windows/macOS/Linux' },
  { name: 'sing-box', description: 'The universal proxy platform' },
  { name: 'mitmproxy', description: 'An interactive TLS-capable intercepting HTTP proxy for penetration testers' },
  { name: 'tailscale', description: 'The easiest, most secure way to use WireGuard and 2FA' },
  { name: 'frp', description: 'A fast reverse proxy to help you expose a local server behind a NAT' },
  { name: 'localsend', description: 'An open-source cross-platform alternative to AirDrop' },
  { name: 'PowerToys', description: 'Windows system utilities to maximize productivity' },
  { name: 'yt-dlp', description: 'A feature-rich command-line audio/video downloader' },
  { name: 'graphite', description: 'Community-built comprehensive 2D content creation application for graphic design' },
]
for (const repo of legit) {
  check(`不误伤 ${repo.name}`, isFreeResourceRepo(repo), false)
}

console.log('\n— 频道消息层面的原有行为不能变 —')
check('机场类消息仍被挡', looksLikePromotion('大家试试这个机场，节点很稳'), true)
check('带推广语境的节点仍被挡', looksLikePromotion('分享几个免费节点，速度不错'), true)
check('优惠码消息仍被挡', looksLikePromotion('新用户注册送，限时优惠，优惠码 ABC'), true)
check('普通项目分享不受影响',
  looksLikePromotion('今天发现一个不错的开源工具，用 Rust 写的，可以整理本地文件，推荐试试'), false)
check('技术语境里的「节点」不该被误伤',
  looksLikePromotion('这是一个节点式的 2D 图形编辑器，把矢量绘图和图像处理串成节点流程'), false)
check('区块链节点不该被误伤',
  looksLikePromotion('这个项目让你可以运行一个去中心化的验证节点，参与网络共识'), false)

console.log(`\n${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
