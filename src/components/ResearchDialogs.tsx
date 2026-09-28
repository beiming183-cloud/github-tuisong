import { useMemo } from 'react'
import { ArrowUpRight, Check, ExternalLink, GitBranch, LoaderCircle, Radar, X } from 'lucide-react'
import type { Tool } from '../types'

type DetailDialogProps = {
  tool: Tool
  onClose: () => void
  onSimilar: () => void
  onCompare: () => void
  compared: boolean
  starred: boolean
  onStar: () => void
  busy: boolean
}

export function DetailDialog({ tool, onClose, onSimilar, onCompare, compared, starred, onStar, busy }: DetailDialogProps) {
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="dialog-card detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        <div className={`detail-visual ${tool.accent}`}><Radar size={28} /><span>{tool.name}</span><small>{tool.sourceLabel}</small></div>
        <div className="detail-heading"><div><p className="section-kicker">{tool.eyebrow}</p><h2 id="detail-title">{tool.title}</h2></div><span className="match-label">{tool.fit}</span></div>
        <p className="detail-summary">{tool.summary}</p>
        <div className="why-block"><span>为什么给你看</span><p>{tool.why}</p></div>
        <div className="detail-grid">
          <div><span>上手难度</span><strong>{tool.difficulty}</strong></div>
          <div><span>使用价值</span><strong>{tool.value}</strong></div>
          <div><span>项目状态</span><strong>{tool.repository ? 'GitHub 开源' : '已收录'}</strong></div>
          <div><span>适合继续做什么</span><strong>{tool.tags[0] ?? '先试试看'}</strong></div>
        </div>
        <div className="tag-row detail-tags">{tool.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        <div className="detail-actions">
          <button className={starred ? 'secondary-action selected' : 'secondary-action'} onClick={onStar} disabled={busy}>{starred ? <Check size={15} /> : <GitBranch size={15} />} {starred ? '已 Star' : 'GitHub Star'}</button>
          <button className={compared ? 'secondary-action selected' : 'secondary-action'} onClick={onCompare}>{compared ? <Check size={15} /> : null} {compared ? '已加入比较' : '加入比较'}</button>
          <button className="secondary-action" onClick={onSimilar} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <ArrowUpRight size={15} />} 找相似</button>
          <a className="primary-button" href={tool.source} target="_blank" rel="noreferrer">打开项目 <ExternalLink size={15} /></a>
        </div>
      </section>
    </div>
  )
}

type CompareDialogProps = {
  tools: Tool[]
  onClose: () => void
  onRemove: (id: string) => void
}

export function CompareDialog({ tools, onClose, onRemove }: CompareDialogProps) {
  const recommended = useMemo(() => tools.find((tool) => tool.difficulty === '上手低') ?? tools[0], [tools])
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="dialog-card compare-dialog" role="dialog" aria-modal="true" aria-labelledby="compare-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        <p className="section-kicker">横向看一眼，再决定</p>
        <h2 id="compare-title">这几个项目，哪个更适合你？</h2>
        <p className="dialog-copy">比较只保留真正影响选择的内容，不把 GitHub 的技术字段整面搬过来。</p>
        {tools.length < 2 ? <div className="compare-empty"><Radar size={25} /><p>再加入一个项目，才能开始比较。</p><span>可以回到推荐流继续挑一个相近的工具。</span></div> : <div className="compare-table-wrap"><table className="compare-table"><thead><tr><th>比较项</th>{tools.map((tool) => <th key={tool.id}><strong>{tool.name}</strong><button onClick={() => onRemove(tool.id)} aria-label={`移除 ${tool.name}`}>移除</button></th>)}</tr></thead><tbody><tr><th>一句话理解</th>{tools.map((tool) => <td key={tool.id}>{tool.summary}</td>)}</tr><tr><th>适合场景</th>{tools.map((tool) => <td key={tool.id}><span className="compare-highlight">{tool.tags[0] ?? '开源工具'}</span></td>)}</tr><tr><th>上手难度</th>{tools.map((tool) => <td key={tool.id}>{tool.difficulty}</td>)}</tr><tr><th>价值判断</th>{tools.map((tool) => <td key={tool.id}>{tool.value}</td>)}</tr><tr><th>项目属性</th>{tools.map((tool) => <td key={tool.id}>{tool.eyebrow}</td>)}</tr></tbody></table></div>}
        {tools.length >= 2 && recommended && <div className="compare-conclusion"><Check size={16} /><span>如果你想先选一个不费劲的，建议从 <strong>{recommended.name}</strong> 开始；如果你更在意改装空间，再看看其他项目。</span></div>}
      </section>
    </div>
  )
}

