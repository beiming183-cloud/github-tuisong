/**
 * 原始来源暂存区：先保存消息，再决定是否进入推荐候选。
 * 目前使用本地 JSON，后续可以无痛迁移到 SQLite。
 */
import fs from 'node:fs'
import path from 'node:path'
import type { TelegramPublicMessage } from './connectors/telegram-public.js'
import { getStoredStaged, listStoredStaged, resolveDataDir, stagedCounts, upsertStaged } from './store.js'

const dataDir = resolveDataDir()
const stagingFile = path.join(dataDir, 'staging.json')

export type StagedStatus = 'new' | 'ready' | 'dismissed' | 'filtered'

export type StagedMessage = {
  id: string
  sourceId: string
  channel: string
  messageId: number
  messageUrl: string
  text: string
  publishedAt: string | null
  viewsText: string | null
  image: string | null
  links: string[]
  status: StagedStatus
  reason?: string
  firstSeenAt: string
  updatedAt: string
}

function readLegacyStore(): StagedMessage[] {
  try {
    const value = JSON.parse(fs.readFileSync(stagingFile, 'utf8')) as unknown
    return Array.isArray(value) ? value as StagedMessage[] : []
  } catch { return [] }
}

let legacyChecked = false
function ensureLegacyMigrated() {
  if (legacyChecked) return
  legacyChecked = true
  if (listStoredStaged(1).length > 0) return
  for (const item of readLegacyStore()) upsertStaged(item)
}

function readStore(limit = 5000, status?: StagedStatus): StagedMessage[] {
  ensureLegacyMigrated()
  return listStoredStaged(limit, status) as StagedMessage[]
}

export function stageTelegramMessages(username: string, messages: TelegramPublicMessage[], filteredIds = new Set<number>()) {
  ensureLegacyMigrated()
  const now = new Date().toISOString()
  for (const message of messages) {
    const id = `telegram-public:${username}:${message.id}`
    const existing = getStoredStaged(id) as StagedMessage | undefined
    if (existing) {
      existing.updatedAt = now
      upsertStaged(existing)
      continue
    }
    upsertStaged({
      id,
      sourceId: `telegram-public:${username}`,
      channel: username,
      messageId: message.id,
      messageUrl: message.url,
      text: message.text,
      publishedAt: message.publishedAt,
      viewsText: message.viewsText,
      image: message.image,
      links: message.links,
      status: filteredIds.has(message.id) ? 'filtered' : 'new',
      reason: filteredIds.has(message.id) ? '疑似广告或推广内容' : undefined,
      firstSeenAt: now,
      updatedAt: now,
    })
  }
}

export function listStaged(limit = 50, status?: StagedStatus) {
  return readStore(Math.max(0, limit), status)
}

export function updateStagedStatus(id: string, status: StagedStatus) {
  const item = readStore(5000).find((entry) => entry.id === id)
  if (!item) return undefined
  item.status = status
  item.updatedAt = new Date().toISOString()
  upsertStaged(item)
  return item
}

export function stagingStats() {
  ensureLegacyMigrated()
  return stagedCounts()
}
