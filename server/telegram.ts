import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import { resolveDataDir } from './store.js'

type TelegramUser = {
  id: string
  username: string | null
  name: string
}

type LoginState = {
  id: string
  status: 'waiting' | 'connected' | 'error'
  qrUrl?: string
  expiresAt?: number
  user?: TelegramUser
  error?: string
  client?: TelegramClient
}

const apiId = Number(process.env.TELEGRAM_API_ID ?? 0)
const apiHash = process.env.TELEGRAM_API_HASH ?? ''
const dataDir = resolveDataDir()
const sessionFile = path.join(dataDir, 'telegram-session.json')

let activeClient: TelegramClient | undefined
let activeUser: TelegramUser | undefined
let activeLogin: LoginState | undefined

function getKey() {
  fs.mkdirSync(dataDir, { recursive: true })
  const configuredSecret = process.env.SESSION_SECRET
  const secretFile = process.env.SESSION_SECRET_FILE ?? path.join(dataDir, 'session-secret')
  if (!configuredSecret && !fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 })
  return crypto.createHash('sha256').update(configuredSecret ?? fs.readFileSync(secretFile, 'utf8').trim()).digest()
}

function encryptSession(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const payload = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return JSON.stringify({ iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex'), payload: payload.toString('base64') })
}

function decryptSession(value: string) {
  try {
    const saved = JSON.parse(value) as { iv: string; authTag: string; payload: string }
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(saved.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(saved.authTag, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(saved.payload, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return ''
  }
}

function readSavedSession() {
  if (!fs.existsSync(sessionFile)) return ''
  return decryptSession(fs.readFileSync(sessionFile, 'utf8'))
}

function saveSession(session: string) {
  fs.mkdirSync(dataDir, { recursive: true })
  const temporary = `${sessionFile}.tmp`
  fs.writeFileSync(temporary, encryptSession(session), { mode: 0o600 })
  fs.renameSync(temporary, sessionFile)
}

function removeSavedSession() {
  if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile)
}

function userToJson(user: any): TelegramUser {
  return {
    id: String(user?.id ?? ''),
    username: user?.username ?? null,
    name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Telegram 用户',
  }
}

function isConfigured() {
  return apiId > 0 && apiHash.length > 0
}

async function buildClient(session: string) {
  if (!isConfigured()) throw new Error('请先配置 TELEGRAM_API_ID 和 TELEGRAM_API_HASH。')
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5, deviceModel: 'OpenRadar Personal' })
  await client.connect()
  return client
}

export async function telegramStatus() {
  if (!isConfigured()) return { configured: false, connected: false, user: null, loggingIn: false }
  if (!activeClient) {
    const saved = readSavedSession()
    if (saved) {
      try {
        const client = await buildClient(saved)
        if (await client.isUserAuthorized()) {
          activeClient = client
          activeUser = userToJson(await client.getMe())
        } else await client.disconnect()
      } catch {
        activeClient = undefined
        activeUser = undefined
      }
    }
  }
  return { configured: true, connected: Boolean(activeClient && activeUser), user: activeUser ?? null, loggingIn: activeLogin?.status === 'waiting' }
}

export async function startTelegramLogin() {
  const current = await telegramStatus()
  if (!current.configured) throw Object.assign(new Error('请先配置 Telegram API ID 和 API Hash。'), { status: 503 })
  if (current.connected) return { status: 'connected' as const, user: activeUser }
  if (activeLogin?.status === 'waiting') return publicLoginState(activeLogin)

  const login: LoginState = { id: crypto.randomBytes(16).toString('hex'), status: 'waiting' }
  activeLogin = login
  const client = await buildClient('')
  login.client = client
  void client.signInUserWithQrCode({ apiId, apiHash }, {
    qrCode: async ({ token, expires }) => {
      const loginUrl = `tg://login?token=${token.toString('base64url')}`
      login.qrUrl = await QRCode.toDataURL(loginUrl, { margin: 1, width: 280, color: { dark: '#1e2825', light: '#fffdf8' } })
      login.expiresAt = expires * 1000
    },
    onError: async (error) => {
      login.status = 'error'
      login.error = error.message || 'Telegram 登录失败。'
      await client.disconnect()
      return true
    },
  }).then(async (user) => {
    activeClient = client
    activeUser = userToJson(user)
    login.user = activeUser
    login.status = 'connected'
    saveSession((client.session as StringSession).save())
    login.client = undefined
  }).catch((error: Error) => {
    login.status = 'error'
    login.error = error.message || 'Telegram 登录失败。'
    login.client = undefined
  })

  return publicLoginState(login)
}

export async function telegramLoginStatus(id: string) {
  if (!activeLogin || activeLogin.id !== id) throw Object.assign(new Error('登录二维码已失效，请重新生成。'), { status: 404 })
  return publicLoginState(activeLogin)
}

export async function disconnectTelegram() {
  if (activeClient) await activeClient.disconnect()
  activeClient = undefined
  activeUser = undefined
  activeLogin = undefined
  removeSavedSession()
}

function publicLoginState(login: LoginState) {
  return { id: login.id, status: login.status, qrUrl: login.qrUrl, expiresAt: login.expiresAt, user: login.user, error: login.error }
}
