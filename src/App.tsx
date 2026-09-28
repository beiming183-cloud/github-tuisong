import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Compass,
  ExternalLink,
  EyeOff,
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
import { ConnectDialog, LinkDialog, ProfileDialog } from './components/Dialogs'
import { CompareDialog, DetailDialog } from './components/ResearchDialogs'
import { TelegramDialog } from './components/TelegramDialog'
import { sampleTools } from './data/sampleTools'
import { api } from './lib/api'
import type { GitHubConfig, ProfileSummary, Tab, TelegramStatus, Tool, UserEventName } from './types'

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
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

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
        await loadProfile(false)
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
    // 这里不再顺手改 interestTags。兴趣标签现在只由真实行为画像决定，
    // 否则「系统正在认识你」会显示成刚刚抓到的内容，而不是用户点出来的偏好。
  }

  /**
   * 上报一个行为事件。埋点失败不能打断用户正在做的事，所以这里必须吞掉异常。
   * 只有“打开/加入”这类正向动作才上报；取消喜欢、取消收藏目前不产生事件（见手册已知问题）。
   */
  const reportEvent = (tool: Tool, event: UserEventName) => {
    void api.recordEvents([{
      toolId: tool.id,
      event,
      sourceKind: tool.sourceKind,
      sourceId: tool.sourceId,
      tags: tool.tags,
    }]).catch(() => undefined)
  }

  const loadProfile = async (open = false) => {
    try {
      const summary = await api.profile()
      setProfile(summary)
      const top = Object.entries(summary.profile.tagWeights)
        .filter(([, weight]) => weight > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([tag]) => tag)
      if (top.length >= 2) setInterestTags(top)
      if (open) setProfileOpen(true)
    } catch {
      if (open) setNotice('暂时读不到兴趣画像，稍后再试。')
    }
  }

  /** 从候选池按评分和多样性取卡片。池是内存的，重启后会返回空数组。 */
  const loadRecommendations = async (limit = 12) => {
    try {
      const result = await api.recommend(limit)
      if (result.tools.length > 0) mergeTools(result.tools)
      return result
    } catch {
      return null
    }
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
    reportEvent(tool, 'similar')
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
      // 第一步：连接器去抓新候选并放进候选池。
      const discovered = await api.discoverGitHub()
      // 第二步：从候选池按「兴趣 + 价值 + 新颖 + 活跃 + 来源 + 探索」重新排序，
      // 并做多样性重排，所以展示顺序和 GitHub 返回顺序不一样。
      const ranked = await loadRecommendations(24)
      const incoming = ranked && ranked.tools.length > 0 ? ranked.tools : discovered.tools
      mergeTools(incoming)
      void enrichWithDeepSeek(incoming)
      void loadProfile(false)

      const added = discovered.pool?.added ?? incoming.length
      const duplicates = discovered.pool?.duplicates ?? 0
      if (incoming.length === 0) {
        setNotice('这次没有拿到项目，过一会儿再试，或者换个探索方向。')
      } else if (ranked?.hasProfile) {
        setNotice(`找到 ${incoming.length} 个项目，已按你的兴趣排过序（其中 ${added} 个是第一次看到）。`)
      } else if (duplicates > 0) {
        setNotice(`找到 ${incoming.length} 个项目，其中 ${added} 个是第一次看到，${duplicates} 个之前已经出现过。`)
      } else {
        setNotice(`发现 ${incoming.length} 个近期活跃项目，都是新的，可以继续往下刷。`)
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
    if (active) reportEvent(tool, 'star')
    toggleList(starred, setStarred, tool.id)
  }

  const handleLike = (tool: Tool) => {
    if (!liked.includes(tool.id)) reportEvent(tool, 'like')
    toggleList(liked, setLiked, tool.id)
  }

  const handleSave = (tool: Tool) => {
    if (!saved.includes(tool.id)) reportEvent(tool, 'save')
    toggleList(saved, setSaved, tool.id)
  }

  const handleCompareClick = (tool: Tool) => {
    if (!compare.includes(tool.id)) reportEvent(tool, 'compare')
    toggleCompare(tool.id)
  }

  const handleOpenDetail = (tool: Tool) => {
    reportEvent(tool, 'view')
    setDetailTool(tool)
  }

  /** 跳过：从当前列表移走，让用户感觉真的翻过去了；服务端只降权，不永久隐藏。 */
  const handleSkip = (tool: Tool) => {
    reportEvent(tool, 'skip')
    setTools((current) => current.filter((item) => item.id !== tool.id))
    setNotice(`已跳过「${tool.name}」，它之后不会优先出现，需要时还能翻到。`)
  }

  /** 不再推荐：比跳过更重的负向信号，但同样不会让项目彻底消失。 */
  const handleDismiss = (tool: Tool) => {
    reportEvent(tool, 'dismiss')
    setTools((current) => current.filter((item) => item.id !== tool.id))
    setDetailTool(null)
    setNotice(`已记下：以后不再优先推荐「${tool.name}」这类项目。`)
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
        <section className="intro-grid"><div className="intro-copy"><p className="eyebrow"><span className="eyebrow-dot" /> 2026 年 9 月 28 日 · 为你挑的</p><h1>今天，发现一个<br /><em>值得试试</em>的东西。</h1><p className="intro-text">不必先读懂 GitHub。OpenRadar 把分散在项目、频道和工具目录里的新东西，整理成一眼能看懂的中文卡片。</p><div className="search-box"><Search size={18} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜工具、场景或标签" aria-label="搜索工具" />{query && <button className="clear-search" onClick={() => setQuery('')} aria-label="清除搜索"><X size={16} /></button>}</div></div><aside className="interest-note"><div className="note-topline"><Wand2 size={16} /> 系统正在认识你</div><p>你最近更容易被这些东西吸引：</p><div className="interest-tags">{interestTags.map((tag) => <span key={tag}>{tag}</span>)}</div><button className="text-link" onClick={() => void loadProfile(true)}>为什么给我看这些？ <ArrowUpRight size={15} /></button></aside></section>

        <section className="section-heading"><div><p className="section-kicker">{tab === 'explore' ? '换个方向看看' : tab === 'saved' ? '以后慢慢研究' : '今天先从这里开始'}</p><h2>{tab === 'explore' ? '探索一些你还没见过的' : tab === 'saved' ? '你留下来的宝藏' : '为你推荐'}</h2></div><div className="feed-meta"><span className="live-mark" /> {busy ? '正在整理中' : aiConfigured ? 'DeepSeek 中文分析已开启' : '持续更新中'}</div></section>

        {visibleTools.length > 0 ? <section className="feed-layout" aria-label="工具推荐列表"><FeatureCard tool={visibleTools[0]} saved={saved.includes(visibleTools[0].id)} liked={liked.includes(visibleTools[0].id)} starred={starred.includes(visibleTools[0].id)} compared={compare.includes(visibleTools[0].id)} onSave={() => handleSave(visibleTools[0])} onLike={() => handleLike(visibleTools[0])} onStar={() => void handleStar(visibleTools[0])} onCompare={() => handleCompareClick(visibleTools[0])} onSimilar={() => void handleFindSimilar(visibleTools[0])} onSkip={() => handleSkip(visibleTools[0])} onOpen={() => handleOpenDetail(visibleTools[0])} onOpenSource={() => reportEvent(visibleTools[0], 'open_source')} /><div className="side-feed">{visibleTools.slice(1).map((tool) => <ToolCard key={tool.id} tool={tool} saved={saved.includes(tool.id)} liked={liked.includes(tool.id)} starred={starred.includes(tool.id)} compared={compare.includes(tool.id)} onSave={() => handleSave(tool)} onLike={() => handleLike(tool)} onStar={() => void handleStar(tool)} onCompare={() => handleCompareClick(tool)} onSimilar={() => void handleFindSimilar(tool)} onSkip={() => handleSkip(tool)} onOpen={() => handleOpenDetail(tool)} onOpenSource={() => reportEvent(tool, 'open_source')} />)}</div></section> : <div className="empty-state"><Compass size={28} /><h3>还没找到匹配的工具</h3><p>换个关键词，或者先回到推荐流，让系统继续替你发现。</p><button className="primary-button" onClick={() => { setQuery(''); setTab('recommend') }}>回到推荐流</button></div>}

        <section className="explore-prompt"><div className="prompt-icon"><Compass size={22} /></div><div><p className="section-kicker">不确定自己喜欢什么，也没关系</p><h3>继续往下刷，兴趣会慢慢长出来。</h3><p>前面是更像你的，后面会混进一些相邻方向。遇到喜欢的就留下，系统会记住。</p></div><button className="quiet-button" onClick={() => void openExplore()}>去探索 <ArrowUpRight size={16} /></button></section>
      </main>

      {compare.length > 0 && <div className="compare-dock" role="status"><div><strong>比较台</strong><span>已选 {compare.length}/3 个项目</span></div><div className="compare-actions"><button className="quiet-button" onClick={() => setCompare([])}>清空</button><button className="primary-button" onClick={() => setCompareOpen(true)}>开始比较 <ArrowUpRight size={15} /></button></div></div>}
      {notice && <button className="toast" onClick={() => setNotice('')} aria-label="关闭提示"><Check size={15} /> {notice}</button>}
      <footer className="footer"><span>OpenRadar Personal · 先把新东西看懂，再决定要不要用。</span><span>V0.3 研究与比较</span></footer>
      {dialog === 'github' && <ConnectDialog config={config} busy={busy} error={dialogError} onClose={() => setDialog(null)} onImportUsername={importUsername} onLoadMine={() => loadMyStars(true)} onLogout={handleLogout} />}
      {dialog === 'link' && <LinkDialog busy={busy} error={dialogError} onClose={() => setDialog(null)} onImport={importLink} />}
      {telegramOpen && <TelegramDialog status={telegramStatus} onClose={() => setTelegramOpen(false)} onChanged={handleTelegramChanged} />}
      {detailTool && <DetailDialog tool={detailTool} onClose={() => setDetailTool(null)} onSimilar={() => { setDetailTool(null); void handleFindSimilar(detailTool) }} onCompare={() => handleCompareClick(detailTool)} compared={compare.includes(detailTool.id)} starred={starred.includes(detailTool.id)} onStar={() => void handleStar(detailTool)} onDismiss={() => handleDismiss(detailTool)} onOpenSource={() => reportEvent(detailTool, 'open_source')} busy={busy} />}
      {compareOpen && <CompareDialog tools={compareTools} onClose={() => setCompareOpen(false)} onRemove={(id) => setCompare((current) => current.filter((item) => item !== id))} />}
      {profileOpen && <ProfileDialog summary={profile} onClose={() => setProfileOpen(false)} />}
    </div>
  )
}

type CardProps = { tool: Tool; saved: boolean; liked: boolean; starred: boolean; compared: boolean; onSave: () => void; onLike: () => void; onStar: () => void; onCompare: () => void; onSimilar: () => void; onSkip: () => void; onOpen: () => void; onOpenSource: () => void }

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

function CardActions({ tool, saved, liked, starred, compared, onSave, onLike, onStar, onCompare, onSimilar, onSkip, onOpen, onOpenSource, compact = false }: CardProps & { compact?: boolean }) {
  return <div className="card-actions"><button className={liked ? 'icon-button selected' : 'icon-button'} onClick={onLike} aria-label={liked ? '取消喜欢' : '喜欢'} aria-pressed={liked}><Heart size={17} fill={liked ? 'currentColor' : 'none'} /></button><button className={saved ? 'icon-button selected' : 'icon-button'} onClick={onSave} aria-label={saved ? '取消收藏' : '收藏'} aria-pressed={saved}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button><button className={starred ? 'icon-button selected' : 'icon-button'} onClick={onStar} aria-label={starred ? '取消 GitHub Star' : 'GitHub Star'} aria-pressed={starred}><GitBranch size={17} /></button><button className="icon-button" onClick={onSkip} aria-label={`跳过 ${tool.name}`}><EyeOff size={17} /></button>{!compact && <button className={compared ? 'secondary-action selected' : 'secondary-action'} onClick={onCompare}>{compared ? <Check size={15} /> : <span>＋</span>} 比较</button>}<button className="secondary-action" onClick={onOpen}>看详情</button><button className="secondary-action" onClick={onSimilar}>找相似 <ArrowUpRight size={15} /></button><a className="open-link" href={tool.source} target="_blank" rel="noreferrer" onClick={onOpenSource} aria-label={`打开 ${tool.name}`}><ExternalLink size={16} /></a></div>
}

export default App
