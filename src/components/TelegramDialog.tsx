import { useEffect, useState } from 'react'
import { LoaderCircle, Send, ShieldCheck, X } from 'lucide-react'
import { api } from '../lib/api'
import type { TelegramStatus } from '../types'

type TelegramDialogProps = {
  status: TelegramStatus
  onClose: () => void
  onChanged: (status: TelegramStatus) => void
}

type LoginState = {
  id: string
  status: 'waiting' | 'connected' | 'error'
  qrUrl?: string
  expiresAt?: number
  user?: TelegramStatus['user']
  error?: string
}

export function TelegramDialog({ status, onClose, onChanged }: TelegramDialogProps) {
  const [login, setLogin] = useState<LoginState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [publicChannels, setPublicChannels] = useState('')
  const [publicBusy, setPublicBusy] = useState(false)
  const [publicMessage, setPublicMessage] = useState('')

  useEffect(() => {
    if (!login || login.status !== 'waiting') return
    const timer = window.setInterval(() => {
      void api.telegramLoginStatus(login.id).then((next) => {
        setLogin(next)
        if (next.status === 'connected' && next.user) onChanged({ configured: true, connected: true, user: next.user })
      }).catch(() => undefined)
    }, 1800)
    return () => window.clearInterval(timer)
  }, [login, onChanged])

  useEffect(() => {
    void api.telegramPublicStatus().then((next) => {
      setPublicChannels(next.channels.map((item) => `https://t.me/${item.username}`).join('\n'))
    }).catch(() => undefined)
  }, [])

  const start = async () => {
    setBusy(true)
    setError('')
    try {
      setLogin(await api.telegramLoginStart())
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '无法生成 Telegram 登录二维码。')
    } finally { setBusy(false) }
  }

  const logout = async () => {
    setBusy(true)
    try {
      await api.telegramLogout()
      onChanged({ configured: status.configured, connected: false, user: null })
      setLogin(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '断开 Telegram 失败。')
    } finally { setBusy(false) }
  }

  const savePublicChannels = async () => {
    const channels = publicChannels.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
    setPublicBusy(true)
    setPublicMessage('')
    try {
      await api.telegramPublicChannels(channels)
      setPublicMessage(`已保存 ${channels.length} 个公开频道。现在不会自动回看历史消息。`)
    } catch (nextError) {
      setPublicMessage(nextError instanceof Error ? nextError.message : '公开频道保存失败。')
    } finally { setPublicBusy(false) }
  }

  const syncPublicChannels = async () => {
    setPublicBusy(true)
    setPublicMessage('')
    try {
      const result = await api.telegramPublicSync(undefined, 10)
      setPublicMessage(`已读取 ${result.messagesRead} 条新增消息，发现 ${result.pool.added} 个新项目。`)
    } catch (nextError) {
      setPublicMessage(nextError instanceof Error ? nextError.message : '公开频道读取失败。')
    } finally { setPublicBusy(false) }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="dialog-card telegram-dialog" role="dialog" aria-modal="true" aria-labelledby="telegram-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        <div className="dialog-icon telegram-icon"><Send size={21} /></div>
        <p className="section-kicker">来源接入</p>
        <h2 id="telegram-title">连接你的纸飞机</h2>
        <p className="dialog-copy">连接后，OpenRadar 才能在你指定频道时读取公开消息。不会直接读取 Telegram 桌面端的本地文件。</p>

        <div className="telegram-public-section">
          <p className="section-kicker">现在就能用 · 不需要 API</p>
          <strong>添加公开频道</strong>
          <p className="dialog-copy">每行一个频道链接。先保存来源，不会自动回看历史；真正读取需要你单独点击，系统会按消息 ID 记住进度。</p>
          <textarea className="plain-input telegram-channel-input" value={publicChannels} onChange={(event) => setPublicChannels(event.target.value)} placeholder="https://t.me/GithubCOTV\nhttps://t.me/xiaoshuwu" rows={4} aria-label="公开频道链接" />
          <div className="telegram-public-actions"><button className="secondary-action" onClick={() => void savePublicChannels()} disabled={publicBusy}>只保存频道</button><button className="primary-button" onClick={() => void syncPublicChannels()} disabled={publicBusy}>{publicBusy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} 手动读取（每频道最多 10 条）</button></div>
          {publicMessage && <p className="dialog-hint">{publicMessage}</p>}
        </div>

        {!status.configured ? <div className="telegram-setup"><div className="privacy-note"><ShieldCheck size={16} /><span>还没有配置 Telegram API。请在 <a href="https://my.telegram.org" target="_blank" rel="noreferrer">my.telegram.org</a> → API development tools 创建应用，然后把 API ID 和 API Hash 填入本地 `.env`。</span></div><p>配置完成后重启 OpenRadar，再回来生成二维码。</p></div> : status.connected && status.user ? <div className="connected-account telegram-account"><div className="telegram-avatar"><Send size={18} /></div><div><strong>{status.user.name}</strong><span>{status.user.username ? `@${status.user.username} · ` : ''}已连接</span></div></div> : login?.status === 'waiting' && login.qrUrl ? <div className="telegram-qr-flow"><img src={login.qrUrl} alt="Telegram 登录二维码" /><strong>用已登录的 Telegram 扫描</strong><span>在 Telegram 的“设置 → 设备 → 连接桌面设备”中确认。</span>{login.expiresAt && <small>二维码会自动刷新</small>}</div> : <button className="primary-button wide" onClick={() => void start()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} 生成登录二维码</button>}

        {status.connected && status.user && <button className="text-button" onClick={() => void logout()} disabled={busy}>{busy && <LoaderCircle className="spin" size={14} />} 断开纸飞机连接</button>}
        {(error || login?.error) && <p className="dialog-error" role="alert">{error || login?.error}</p>}
        <div className="privacy-note"><ShieldCheck size={16} /><span>登录会话只在本机加密保存。你之后提供频道后，我们再决定读取哪些内容。</span></div>
      </section>
    </div>
  )
}
