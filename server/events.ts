/**
 * 用户行为事件。
 *
 * 事件是推荐系统的唯一原始输入：兴趣画像、评分、推荐理由都从这里推导，
 * 不要在别的地方直接猜测用户偏好。
 *
 * 存储：`data/events.json`，已被 `.gitignore` 整目录忽略，写入用「临时文件 + rename」
 * 原子替换并设置 0o600。当前是单用户本地工具，只有一个进程写，所以不做文件锁；
 * 以后换 SQLite 时这里是唯一的对接点。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SourceKind } from './connectors/types.js'

export type UserEventName =
  | 'view'
  | 'open_source'
  | 'like'
  | 'save'
  | 'star'
  | 'compare'
  | 'similar'
  | 'skip'
  | 'dismiss'

export const USER_EVENT_NAMES: UserEventName[] = [
  'view', 'open_source', 'like', 'save', 'star', 'compare', 'similar', 'skip', 'dismiss',
]

/**
 * 事件权重。对照交接手册 13.2。
 *
 * 手册原表没有给 `similar` 权重，这里按与 `open_source`、`compare` 同级的
 * “主动研究行为”给 +2，属于有意的补充，已记入手册决策记录。
 *
 * 权重只是起点，不是永久规则；调整时请同步更新手册和 check-recommend.ts。
 */
export const EVENT_WEIGHTS: Record<UserEventName, number> = {
  star: 5,
  save: 4,
  like: 3,
  open_source: 2,
  similar: 2,
  compare: 2,
  view: 1,
  skip: -2,
  dismiss: -4,
}

export type UserEvent = {
  id: string
  toolId: string
  event: UserEventName
  sourceKind?: SourceKind
  /** 来源 id，例如 github-discovery，用于统计来源偏好。 */
  sourceId?: string
  tags?: string[]
  occurredAt: string
}

export type UserEventInput = {
  toolId: string
  event: UserEventName
  sourceKind?: SourceKind
  sourceId?: string
  tags?: string[]
  occurredAt?: string
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(currentDir, '..')
/**
 * 事件文件的位置。
 *
 * 支持 `OPENRADAR_DATA_DIR` 覆盖，目的是让 `npm run smoke` 能把测试行为事件
 * 写进临时目录，而不是污染本机真实画像。
 * 注意：只有本文件认这个变量（会话密钥和 Telegram 会话不认），
 * 所以它只用于隔离行为事件，不是通用的数据目录开关。
 */
const dataDir = process.env.OPENRADAR_DATA_DIR
  ? path.resolve(process.env.OPENRADAR_DATA_DIR)
  : path.join(projectDir, 'data')
const eventsFile = path.join(dataDir, 'events.json')

/** 单次请求最多接受多少条事件，避免前端异常时写爆文件。 */
export const MAX_EVENTS_PER_REQUEST = 50
/** 文件里保留多少条最新事件。 */
export const MAX_STORED_EVENTS = 5000

let events: UserEvent[] = []

function isEventName(value: unknown): value is UserEventName {
  return typeof value === 'string' && (USER_EVENT_NAMES as string[]).includes(value)
}

function loadEvents() {
  fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(eventsFile)) return
  try {
    const parsed = JSON.parse(fs.readFileSync(eventsFile, 'utf8')) as unknown
    if (!Array.isArray(parsed)) return
    events = parsed.filter((item): item is UserEvent => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Partial<UserEvent>
      return typeof candidate.toolId === 'string' && isEventName(candidate.event) && typeof candidate.occurredAt === 'string'
    })
  } catch {
    console.warn('OpenRadar 无法读取已有行为事件，将从空画像开始。')
    events = []
  }
}

function persistEvents() {
  fs.mkdirSync(dataDir, { recursive: true })
  const temporary = `${eventsFile}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(events), { mode: 0o600 })
  fs.renameSync(temporary, eventsFile)
}

loadEvents()

/**
 * 记录一批事件。非法条目直接丢弃而不是整批失败，
 * 因为丢一条埋点不应该影响用户正在做的事。
 */
export function recordEvents(inputs: UserEventInput[]): { stored: UserEvent[]; rejected: number } {
  const stored: UserEvent[] = []
  let rejected = 0

  for (const input of inputs.slice(0, MAX_EVENTS_PER_REQUEST)) {
    if (!input || typeof input.toolId !== 'string' || !input.toolId.trim() || !isEventName(input.event)) {
      rejected += 1
      continue
    }
    stored.push({
      id: crypto.randomUUID(),
      toolId: input.toolId.trim(),
      event: input.event,
      sourceKind: input.sourceKind,
      sourceId: typeof input.sourceId === 'string' ? input.sourceId : undefined,
      tags: Array.isArray(input.tags) ? input.tags.filter((tag) => typeof tag === 'string').slice(0, 8) : undefined,
      occurredAt: typeof input.occurredAt === 'string' && input.occurredAt ? input.occurredAt : new Date().toISOString(),
    })
  }

  if (stored.length > 0) {
    events = [...events, ...stored]
    if (events.length > MAX_STORED_EVENTS) events = events.slice(events.length - MAX_STORED_EVENTS)
    persistEvents()
  }

  return { stored, rejected }
}

export function listEvents(limit = MAX_STORED_EVENTS): UserEvent[] {
  return events.slice(-Math.max(limit, 0))
}

export function eventCount() {
  return events.length
}

export type EventStats = {
  total: number
  byEvent: Record<string, number>
  /** 最早的 / 最新的事件时间，没有事件时为 null。 */
  firstAt: string | null
  lastAt: string | null
}

export function eventStats(): EventStats {
  const byEvent: Record<string, number> = {}
  for (const item of events) byEvent[item.event] = (byEvent[item.event] ?? 0) + 1
  return {
    total: events.length,
    byEvent,
    firstAt: events.length > 0 ? events[0].occurredAt : null,
    lastAt: events.length > 0 ? events[events.length - 1].occurredAt : null,
  }
}

/**
 * 清空事件。只用于本地自检和测试；
 * 以后如果做成产品功能，应该是「重置兴趣画像」并提示用户不可恢复。
 */
export function clearEvents() {
  events = []
  if (fs.existsSync(eventsFile)) fs.rmSync(eventsFile)
}
