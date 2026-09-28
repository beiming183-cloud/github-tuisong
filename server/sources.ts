export type SourceDescriptor = {
  id: string
  label: string
  kind: 'github' | 'rss' | 'telegram' | 'product-hunt' | 'hacker-news' | 'manual'
  status: 'ready' | 'needs_config' | 'coming_soon'
  description: string
}

export const sourceRegistry: SourceDescriptor[] = [
  { id: 'github-stars', label: '我的 GitHub Star', kind: 'github', status: 'ready', description: '读取你的收藏，建立第一份兴趣画像。' },
  { id: 'github-discovery', label: 'GitHub 新项目', kind: 'github', status: 'ready', description: '按活跃度和 Star 变化发现值得看的开源项目。' },
  { id: 'rss', label: 'RSS / 网站', kind: 'rss', status: 'ready', description: '以后可以接入工具目录、博客和公开网站。' },
  { id: 'hacker-news', label: 'Hacker News', kind: 'hacker-news', status: 'coming_soon', description: '保留为探索来源，默认不混入推荐流。' },
  { id: 'product-hunt', label: 'Product Hunt', kind: 'product-hunt', status: 'needs_config', description: '需要单独配置来源 API，之后再接入。' },
  { id: 'telegram', label: '纸飞机频道 / 资源群', kind: 'telegram', status: 'needs_config', description: '配置 Telegram API 后可扫码连接；等你提供频道后接入消息。' },
  { id: 'manual', label: '我丢一个链接', kind: 'manual', status: 'ready', description: '手动提交一个项目，让 OpenRadar 帮你分析。' },
]
