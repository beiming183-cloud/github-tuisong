import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Compass,
  ExternalLink,
  GitBranch,
  Heart,
  Link as LinkIcon,
  Radar,
  Send,
  Search,
  Wand2,
  X,
} from 'lucide-react'
import './App.css'
import { ConnectDialog, LinkDialog } from './components/Dialogs'
import { CompareDialog, DetailDialog } from './components/ResearchDialogs'
import { TelegramDialog } from './components/TelegramDialog'
import { sampleTools } from './data/sampleTools'
import { api } from './lib/api'
import type { GitHubConfig, Tab, TelegramStatus, Tool } from './types'

function readList(key: string, fallback: string[] = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : fallback
  } catch {
    return fallback
  }
}

function App() {
  const [tab, setTab] = useState<Tab>('recommend')
  const [query, setQuery] = useState('')
  const [tools, setTools] = useState<Tool[]>(sampleTools)
  const [saved, setSaved] = useState<string[]>(() => readList('openradar_saved', ['localsend']))
  const [liked, setLiked] = useState<string[]>(() => readList('openradar_liked'))
  const [starred, setStarred] = useState<string[]>(() => readList('openradar_starred'))
  const [compare, setCompare] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [config, setConfig] = useState<GitHubConfig>({ oauthConfigured: false, connected: false, user: null })
  const [aiConfigured, setAiConfigured] = useState(false)
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus>({ configured: false, connected: false, user: null })
  const [telegramOpen, setTelegramOpen] = useState(false)
  const [dialog, setDialog] = useState<'github' | 'link' | null>(null)
  const [detailTool, setDetailTool] = useState<Tool | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [interestTags, setInterestTags] = useState(['能马上用', 'AI 工具', '自动化', '小而实用'])

  useEffect(() => { localStorage.setItem('openradar_saved', JSON.stringify(saved)) }, [saved])
  useEffect(() => { localStorage.setItem('openradar_liked', JSON.stringify(liked)) }, [liked])
  useEffect(() => { localStorage.setItem('openradar_starred', JSON.stringify(starred)) }, [starred])

  useEffect(() => {
    void (async () => {
      try {
        const [nextConfig, nextAiConfig, nextTelegramStatus] = await Promise.all([api.githubConfig(), api.aiConfig(), api.telegramConfig()])
        setConfig(nextConfig)
        setAiConfigured(nextAiConfig.configured)
        setTelegramStatus(nextTelegramStatus)
        const githubStatus = new URLSearchParams(window.location.search).get('github')
        if (githubStatus === 'connected') setNotice('GitHub 已连接，正在把你的 Star 带进来。')
        if (githubStatus && githubStatus !== 'connected') setNotice('GitHub 连接没有完成，可以先用公开用户名导入。')
        if (githubStatus) window.history.replaceState({}, '', window.location.pathname)
        if (nextConfig.connected) await loadMyStars(false)
      } catch {
        // API 未启动时仍保留完整演示流。
      }
    })()
  }, [])

  const visibleTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return tools.filter((tool) => {
      const searchable = [tool.name, tool.title, tool.summary, tool.repository?.fullName ?? '', ...tool.tags].join(' ').toLowerCase()
      const matchesQuery = normalizedQuery.length === 0 || searchable.includes(normalizedQuery)
      const matchesTab = tab === 'recommend' || (tab === 'explore' ? tool.explore : saved.includes(tool.id))
      return matchesQuery && matchesTab
    })
  }, [query, saved, tab, tools])

  const mergeTools = (incoming: Tool[]) => {
    setTools((current) => {
      const bySource = new Map<string, Tool>()
      for (const tool of [...incoming, ...current]) bySource.set(tool.source, tool)
      return [...bySource.values()]
    })
    const discovered = [...new Set(incoming.flatMap((tool) => tool.tags))].slice(0, 4)
    if (discovered.length >= 2) setInterestTags(discovered)
  }

  const applyAiPatches = (patches: Array<Pick<Tool, 'id' | 'title' | 'summary' | 'why' | 'tags' | 'fit' | 'difficulty' | 'value'>>) => {
    if (patches.length === 0) return
    const byId = new Map(patches.map((patch) => [patch.id, patch]))
    setTools((current) => current.map((tool) => {
      const patch = byId.get(tool.id)
      return patch ? { ...tool, ...patch } : tool
    }))
  }

  const enrichWithDeepSeek = async (incoming: Tool[]) => {
    try {
      const result = await api.enrich(incoming.slice(0, 8))
      applyAiPatches(result.patches)
      if (result.configured && result.patches.length > 0) setNotice(`DeepSeek 已补充 ${result.patches.length} 张中文卡片。`)
    } catch {
      // AI 分析失败时保留规则生成的中文结果，不阻断浏览。
    }
  }

  async function loadMyStars(showNotice = true) {
    setBusy(true)
    try {
      const result = await api.myStars()
      mergeTools(result.tools)
      void enrichWithDeepSeek(result.tools)
      setStarred((current) => [...new Set([...current, ...result.tools.map((tool) => tool.id)])])
      setTab('recommend')
      if (showNotice) setNotice(`已同步 ${result.tools.length} 个 Star，推荐会慢慢变得更像你。`)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : '读取 GitHub Star 失败。')
    } finally { setBusy(false) }
  }

  const importUsername = async (username: string) => {
    setBusy(true)
    setDialogError('')
    try {
      const result = await api.publicStars(username)
      mergeTools(result.tools)
      void enrichWithDeepSeek(result.tools)
      setStarred((current) => [...new Set([...current, ...result.tools.map((tool) => tool.id)])])
      setTab('recommend')
      setDialog(null)
      setNotice(`已导入 ${result.tools.length} 个公开 Star。以后连接 GitHub 后，可以继续同步。`)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : '读取公开 Star 失败。')
    } finally { setBusy(false) }
  }

  const importLink = async (url: string) => {
    setBusy(true)
    setDialogError('')
    try {
      const result = await api.importRepository(url)
      mergeTools([result.tool])
      void enrichWithDeepSeek([result.tool])
      setTab('recommend')
      setQuery('')
      setDialog(null)
      setNotice(`已把 ${result.tool.name} 放进发现流。`)
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : '项目分析失败。')
    } finally { setBusy(false) }
  }

  const handleFindSimilar = async (tool: Tool) => {
    setTab('explore')
    setQuery('')
    if (!tool.repository) {
      setNotice(`先围绕「${tool.name}」看看探索内容。`)
      return
    }
    setBusy(true)
    setNotice(`正在围绕「${tool.name}」找相似项目。`)
    try {
      const result = await api.similar(tool.repository.owner, tool.repository.name)
      mergeTools(result.tools)
      void enrichWithDeepSeek(result.tools)
      setNotice(result.tools.length ? `找到 ${result.tools.length} 个相关项目，可以继续往下刷。` : '暂时没有找到足够相近的项目。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '找相似项目失败。')
    } finally { setBusy(false) }
  }

  const openExplore = async () => {
    setTab('explore')
    setQuery('')
    setBusy(true)
    setNotice('正在扫描 GitHub 最近活跃的新项目。')
    try {
      const result = await api.discoverGitHub()
      mergeTools(result.tools)
      void enrichWithDeepSeek(result.tools)
      const added = result.pool?.added ?? result.tools.length
      const duplicates = result.pool?.duplicates ?? 0
      if (result.tools.length === 0) {
        setNotice('这次没有拿到项目，过一会儿再试，或者换个探索方向。')
      } else if (duplicates > 0) {
        setNotice(`找到 ${result.tools.length} 个项目，其中 ${added} 个是第一次看到，${duplicates} 个之前已经出现过。`)
      } else {
        setNotice(`发现 ${result.tools.length} 个近期活跃项目，都是新的，可以继续往下刷。`)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '暂时无法读取 GitHub 新项目。')
    } finally { setBusy(false) }
  }

  const handleStar = async (tool: Tool) => {
    const active = !starred.includes(tool.id)
    if (config.connected && tool.repository) {
      try { await api.setStar(tool.repository.owner, tool.repository.name, active) } catch (error) {
        setNotice(error instanceof Error ? error.message : 'GitHub Star 同步失败。')
        return
      }
    } else if (active && !config.connected) setNotice('现在先记在本地；连接 GitHub 后，这个动作会同步到账号。')
    toggleList(starred, setStarred, tool.id)
  }

  const toggleList = (list: string[], setList: (next: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id])
  }

  const toggleCompare = (id: string) => {
    setCompare((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      if (current.length === 3) { setNotice('比较台最多放 3 个项目，先移除一个再加入。'); return current }
      setNotice('已加入比较台，可以继续挑一个同类项目。')
      return [...current, id]
    })
  }

  const openDialog = (next: 'github' | 'link') => { setDialogError(''); setDialog(next) }

  const handleLogout = async () => {
    await api.logout()
    setConfig({ oauthConfigured: config.oauthConfigured, connected: false, user: null })
    setDialog(null)
    setNotice('GitHub 已断开，之后仍可以继续浏览本地收藏。')
  }

  const handleTelegramChanged = (nextStatus: TelegramStatus) => {
    setTelegramStatus(nextStatus)
    if (nextStatus.connected) setNotice('纸飞机已连接。等你提供频道后，就可以开始收集消息。')
  }

  const compareTools = compare.map((id) => tools.find((tool) => tool.id === id)).filter((tool): tool is Tool => Boolean(tool))

  return (
    <div className="app-shell">
      <header className="masthead">
        <a className="brand" href="#top" aria-label="OpenRadar 首页"><span className="brand-mark"><Radar size={20} strokeWidth={1.8} /></span><span><strong>OpenRadar</strong><small>个人工具发现流</small></span></a>
        <nav className="main-nav" aria-label="主要导航">
          <button className={tab === 'recommend' ? 'nav-item active' : 'nav-item'} onClick={() => { setTab('recommend'); setQuery('') }}>为你推荐</button>
          <button className={tab === 'explore' ? 'nav-item active' : 'nav-item'} onClick={() => void openExplore()}>探索</button>
          <button className={tab === 'saved' ? 'nav-item active' : 'nav-item'} onClick={() => { setTab('saved'); setQuery('') }}>我的收藏 <span className="nav-count">{saved.length}</span></button>
        </nav>
        <div className="masthead-actions"><button className="quiet-button" onClick={() => openDialog('link')}><LinkIcon size={16} /> 丢一个链接</button><button className={telegramStatus.connected ? 'telegram-button connected' : 'telegram-button'} onClick={() => setTelegramOpen(true)}><Send size={16} /> {telegramStatus.connected ? '纸飞机已连' : '连接纸飞机'}</button><button className={config.connected ? 'github-button connected' : 'github-button'} onClick={() => openDialog('github')}><GitBranch size={16} /> {config.connected ? `@${config.user?.login}` : '连接 GitHub'}</button></div>
      </header>

      <main id="top">
        <section className="intro-grid"><div className="intro-copy"><p className="eyebrow"><span className="eyebrow-dot" /> 2026 年 9 月 28 日 · 为你挑的</p><h1>今天，发现一个<br /><em>值得试试</em>的东西。</h1><p className="intro-text">不必先读懂 GitHub。OpenRadar 把分散在项目、频道和工具目录里的新东西，整理成一眼能看懂的中文卡片。</p><div className="search-box"><Search size={18} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜工具、场景或标签" aria-label="搜索工具" />{query && <button className="clear-search" onClick={() => setQuery('')} aria-label="清除搜索"><X size={16} /></button>}</div></div><aside className="interest-note"><div className="note-topline"><Wand2 size={16} /> 系统正在认识你</div><p>你最近更容易被这些东西吸引：</p><div className="interest-tags">{interestTags.map((tag) => <span key={tag}>{tag}</span>)}</div><button className="text-link" onClick={() => setNotice('兴趣画像会随着喜欢、收藏和跳过逐渐变化。')}>为什么给我看这些？ <ArrowUpRight size={15} /></button></aside></section>

        <section className="section-heading"><div><p className="section-kicker">{tab === 'explore' ? '换个方向看看' : tab === 'saved' ? '以后慢慢研究' : '今天先从这里开始'}</p><h2>{tab === 'explore' ? '探索一些你还没见过的' : tab === 'saved' ? '你留下来的宝藏' : '为你推荐'}</h2></div><div className="feed-meta"><span className="live-mark" /> {busy ? '正在整理中' : aiConfigured ? 'DeepSeek 中文分析已开启' : '持续更新中'}</div></section>

        {visibleTools.length > 0 ? <section className="feed-layout" aria-label="工具推荐列表"><FeatureCard tool={visibleTools[0]} saved={saved.includes(visibleTools[0].id)} liked={liked.includes(visibleTools[0].id)} starred={starred.includes(visibleTools[0].id)} compared={compare.includes(visibleTools[0].id)} onSave={() => toggleList(saved, setSaved, visibleTools[0].id)} onLike={() => toggleList(liked, setLiked, visibleTools[0].id)} onStar={() => void handleStar(visibleTools[0])} onCompare={() => toggleCompare(visibleTools[0].id)} onSimilar={() => void handleFindSimilar(visibleTools[0])} onOpen={() => setDetailTool(visibleTools[0])} /><div className="side-feed">{visibleTools.slice(1).map((tool) => <ToolCard key={tool.id} tool={tool} saved={saved.includes(tool.id)} liked={liked.includes(tool.id)} starred={starred.includes(tool.id)} compared={compare.includes(tool.id)} onSave={() => toggleList(saved, setSaved, tool.id)} onLike={() => toggleList(liked, setLiked, tool.id)} onStar={() => void handleStar(tool)} onCompare={() => toggleCompare(tool.id)} onSimilar={() => void handleFindSimilar(tool)} onOpen={() => setDetailTool(tool)} />)}</div></section> : <div className="empty-state"><Compass size={28} /><h3>还没找到匹配的工具</h3><p>换个关键词，或者先回到推荐流，让系统继续替你发现。</p><button className="primary-button" onClick={() => { setQuery(''); setTab('recommend') }}>回到推荐流</button></div>}

        <section className="explore-prompt"><div className="prompt-icon"><Compass size={22} /></div><div><p className="section-kicker">不确定自己喜欢什么，也没关系</p><h3>继续往下刷，兴趣会慢慢长出来。</h3><p>前面是更像你的，后面会混进一些相邻方向。遇到喜欢的就留下，系统会记住。</p></div><button className="quiet-button" onClick={() => void openExplore()}>去探索 <ArrowUpRight size={16} /></button></section>
      </main>

      {compare.length > 0 && <div className="compare-dock" role="status"><div><strong>比较台</strong><span>已选 {compare.length}/3 个项目</span></div><div className="compare-actions"><button className="quiet-button" onClick={() => setCompare([])}>清空</button><button className="primary-button" onClick={() => setCompareOpen(true)}>开始比较 <ArrowUpRight size={15} /></button></div></div>}
      {notice && <button className="toast" onClick={() => setNotice('')} aria-label="关闭提示"><Check size={15} /> {notice}</button>}
      <footer className="footer"><span>OpenRadar Personal · 先把新东西看懂，再决定要不要用。</span><span>V0.3 研究与比较</span></footer>
      {dialog === 'github' && <ConnectDialog config={config} busy={busy} error={dialogError} onClose={() => setDialog(null)} onImportUsername={importUsername} onLoadMine={() => loadMyStars(true)} onLogout={handleLogout} />}
      {dialog === 'link' && <LinkDialog busy={busy} error={dialogError} onClose={() => setDialog(null)} onImport={importLink} />}
      {telegramOpen && <TelegramDialog status={telegramStatus} onClose={() => setTelegramOpen(false)} onChanged={handleTelegramChanged} />}
      {detailTool && <DetailDialog tool={detailTool} onClose={() => setDetailTool(null)} onSimilar={() => { setDetailTool(null); void handleFindSimilar(detailTool) }} onCompare={() => toggleCompare(detailTool.id)} compared={compare.includes(detailTool.id)} starred={starred.includes(detailTool.id)} onStar={() => void handleStar(detailTool)} busy={busy} />}
      {compareOpen && <CompareDialog tools={compareTools} onClose={() => setCompareOpen(false)} onRemove={(id) => setCompare((current) => current.filter((item) => item !== id))} />}
    </div>
  )
}

type CardProps = { tool: Tool; saved: boolean; liked: boolean; starred: boolean; compared: boolean; onSave: () => void; onLike: () => void; onStar: () => void; onCompare: () => void; onSimilar: () => void; onOpen: () => void }

function ToolImage({ tool, large = false }: { tool: Tool; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <div className={`tool-image fallback ${tool.accent} ${large ? 'large' : ''}`}><Radar size={large ? 34 : 24} /><span>{tool.name}</span></div>
  return <div className={`tool-image ${large ? 'large' : ''}`}><img src={tool.image} alt={`${tool.name} 项目预览`} onError={() => setFailed(true)} /><span className="image-source">{tool.sourceLabel}</span></div>
}

function FeatureCard({ tool, ...props }: CardProps) {
  return <article className="feature-card"><ToolImage tool={tool} large /><div className="feature-content"><div className="card-topline"><span>{tool.eyebrow}</span><span className="match-label">{tool.fit}</span></div><h3><button className="card-title-button" onClick={props.onOpen}>{tool.title}</button></h3><p className="card-summary">{tool.summary}</p><div className="why-block"><span>为什么给你看</span><p>{tool.why}</p></div><div className="tag-row">{tool.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><CardActions tool={tool} {...props} /></div></article>
}

function ToolCard({ tool, ...props }: CardProps) {
  return <article className="tool-card"><ToolImage tool={tool} /><div className="tool-card-content"><div className="card-topline"><span>{tool.eyebrow}</span><span className="match-label">{tool.fit}</span></div><h3><button className="card-title-button" onClick={props.onOpen}>{tool.title}</button></h3><p className="card-summary">{tool.summary}</p><div className="card-facts"><span>{tool.difficulty}</span><span>{tool.value}</span></div><div className="tag-row">{tool.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><CardActions tool={tool} compact {...props} /></div></article>
}

function CardActions({ tool, saved, liked, starred, compared, onSave, onLike, onStar, onCompare, onSimilar, onOpen, compact = false }: CardProps & { compact?: boolean }) {
  return <div className="card-actions"><button className={liked ? 'icon-button selected' : 'icon-button'} onClick={onLike} aria-label={liked ? '取消喜欢' : '喜欢'} aria-pressed={liked}><Heart size={17} fill={liked ? 'currentColor' : 'none'} /></button><button className={saved ? 'icon-button selected' : 'icon-button'} onClick={onSave} aria-label={saved ? '取消收藏' : '收藏'} aria-pressed={saved}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button><button className={starred ? 'icon-button selected' : 'icon-button'} onClick={onStar} aria-label={starred ? '取消 GitHub Star' : 'GitHub Star'} aria-pressed={starred}><GitBranch size={17} /></button>{!compact && <button className={compared ? 'secondary-action selected' : 'secondary-action'} onClick={onCompare}>{compared ? <Check size={15} /> : <span>＋</span>} 比较</button>}<button className="secondary-action" onClick={onOpen}>看详情</button><button className="secondary-action" onClick={onSimilar}>找相似 <ArrowUpRight size={15} /></button><a className="open-link" href={tool.source} target="_blank" rel="noreferrer" aria-label={`打开 ${tool.name}`}><ExternalLink size={16} /></a></div>
}

export default App
