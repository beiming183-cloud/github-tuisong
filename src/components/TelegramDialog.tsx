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

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="dialog-card telegram-dialog" role="dialog" aria-modal="true" aria-labelledby="telegram-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        <div className="dialog-icon telegram-icon"><Send size={21} /></div>
        <p className="section-kicker">来源接入</p>
        <h2 id="telegram-title">连接你的纸飞机</h2>
        <p className="dialog-copy">连接后，OpenRadar 才能在你指定频道时读取公开消息。不会直接读取 Telegram 桌面端的本地文件。</p>

        {!status.configured ? <div className="telegram-setup"><div className="privacy-note"><ShieldCheck size={16} /><span>还没有配置 Telegram API。请在 <a href="https://my.telegram.org" target="_blank" rel="noreferrer">my.telegram.org</a> → API development tools 创建应用，然后把 API ID 和 API Hash 填入本地 `.env`。</span></div><p>配置完成后重启 OpenRadar，再回来生成二维码。</p></div> : status.connected && status.user ? <div className="connected-account telegram-account"><div className="telegram-avatar"><Send size={18} /></div><div><strong>{status.user.name}</strong><span>{status.user.username ? `@${status.user.username} · ` : ''}已连接</span></div></div> : login?.status === 'waiting' && login.qrUrl ? <div className="telegram-qr-flow"><img src={login.qrUrl} alt="Telegram 登录二维码" /><strong>用已登录的 Telegram 扫描</strong><span>在 Telegram 的“设置 → 设备 → 连接桌面设备”中确认。</span>{login.expiresAt && <small>二维码会自动刷新</small>}</div> : <button className="primary-button wide" onClick={() => void start()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} 生成登录二维码</button>}

        {status.connected && status.user && <button className="text-button" onClick={() => void logout()} disabled={busy}>{busy && <LoaderCircle className="spin" size={14} />} 断开纸飞机连接</button>}
        {(error || login?.error) && <p className="dialog-error" role="alert">{error || login?.error}</p>}
        <div className="privacy-note"><ShieldCheck size={16} /><span>登录会话只在本机加密保存。你之后提供频道后，我们再决定读取哪些内容。</span></div>
      </section>
    </div>
  )
}

