import { useState } from 'react'
import type { FormEvent } from 'react'
import { GitBranch, Link as LinkIcon, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import type { GitHubConfig } from '../types'

type ConnectDialogProps = {
  config: GitHubConfig
  busy: boolean
  error: string
  onClose: () => void
  onImportUsername: (username: string) => Promise<void>
  onLoadMine: () => Promise<void>
  onLogout: () => Promise<void>
}

export function ConnectDialog({ config, busy, error, onClose, onImportUsername, onLoadMine, onLogout }: ConnectDialogProps) {
  const [username, setUsername] = useState(config.user?.login ?? '')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (username.trim()) void onImportUsername(username.trim())
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="connect-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        <div className="dialog-icon"><GitBranch size={22} /></div>
        <p className="section-kicker">建立第一份兴趣画像</p>
        <h2 id="connect-title">把你的 GitHub 收藏带进来</h2>
        <p className="dialog-copy">OpenRadar 会读取最近收藏的公开项目，把它们变成中文卡片，并从中判断你可能喜欢的方向。</p>

        {config.connected && config.user ? (
          <div className="connected-account">
            <img src={config.user.avatar_url} alt="" />
            <div><strong>{config.user.name || config.user.login}</strong><span>@{config.user.login} · 已安全连接</span></div>
          </div>
        ) : (
          <form className="dialog-form" onSubmit={submit}>
            <label htmlFor="github-username">GitHub 用户名</label>
            <div className="input-with-prefix"><span>github.com/</span><input id="github-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="你的用户名" autoFocus /></div>
            <button className="primary-button wide" disabled={busy || !username.trim()}>
              {busy ? <LoaderCircle className="spin" size={17} /> : <GitBranch size={17} />} 读取公开 Star
            </button>
          </form>
        )}

        {error && <p className="dialog-error" role="alert">{error}</p>}

        {config.connected ? (
          <div className="dialog-actions-row">
            <button className="primary-button" disabled={busy} onClick={() => void onLoadMine()}>{busy && <LoaderCircle className="spin" size={16} />} 更新我的 Star</button>
            <button className="text-button" disabled={busy} onClick={() => void onLogout()}>断开连接</button>
          </div>
        ) : config.oauthConfigured ? (
          <>
            <div className="dialog-divider"><span>或者</span></div>
            <a className="oauth-button" href="/api/auth/github/start"><ShieldCheck size={17} /> 使用 GitHub 安全连接</a>
          </>
        ) : (
          <div className="privacy-note"><ShieldCheck size={16} /><span>不用密码也能读取公开 Star。配置 OAuth 后，才会启用一键同步 Star。</span></div>
        )}
      </section>
    </div>
  )
}

type LinkDialogProps = {
  busy: boolean
  error: string
  onClose: () => void
  onImport: (url: string) => Promise<void>
}

export function LinkDialog({ busy, error, onClose, onImport }: LinkDialogProps) {
  const [url, setUrl] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (url.trim()) void onImport(url.trim())
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="dialog-card compact-dialog" role="dialog" aria-modal="true" aria-labelledby="link-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        <div className="dialog-icon"><LinkIcon size={21} /></div>
        <p className="section-kicker">看到一个有点心动的项目？</p>
        <h2 id="link-title">把链接丢给 OpenRadar</h2>
        <p className="dialog-copy">首版支持 GitHub 项目地址。系统会读取项目信息，生成中文卡片并放进推荐流。</p>
        <form className="dialog-form" onSubmit={submit}>
          <label htmlFor="project-url">项目链接</label>
          <input className="plain-input" id="project-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/owner/project" autoFocus />
          <button className="primary-button wide" disabled={busy || !url.trim()}>{busy ? <LoaderCircle className="spin" size={17} /> : <LinkIcon size={17} />} 分析这个项目</button>
        </form>
        {error && <p className="dialog-error" role="alert">{error}</p>}
      </section>
    </div>
  )
}
