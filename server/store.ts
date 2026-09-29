/**
 * OpenRadar 的单用户 SQLite 存储层。
 *
 * 只在这里接触 node:sqlite，其他模块通过小型函数读写数据。这样既能
 * 保留 OPENRADAR_DATA_DIR 的测试隔离，也能让旧版 JSON 在首次启动时迁移。
 */
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Candidate } from './connectors/types.js'
import type { UserEvent } from './events.js'

export type StoredCandidate = {
  candidate: Candidate
  canonicalUrl: string
  firstSeenAt: string
  lastSeenAt: string
  seenCount: number
  sourceIds: string[]
}

export type StoredEvent = UserEvent

export type StoreStaged = {
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
  status: string
  reason?: string
  firstSeenAt: string
  updatedAt: string
}

const projectDir = path.resolve(import.meta.dirname, '..')

/**
 * 唯一的运行时数据目录。**所有模块都必须用它**，不要各自 `path.join(projectDir, 'data')`。
 *
 * 为什么单独抽出来：以前 index.ts / staging.ts / telegram.ts / telegram-public.ts
 * 各写了一份硬编码路径，只有本文件认 `OPENRADAR_DATA_DIR`。
 * 结果是「用 OPENRADAR_DATA_DIR 隔离跑测试」的时候，候选池、GitHub 会话和
 * Telegram 状态仍然读写用户的真实数据 —— 隔离看起来生效了，实际上没有。
 */
export function resolveDataDir() {
  return process.env.OPENRADAR_DATA_DIR
    ? path.resolve(process.env.OPENRADAR_DATA_DIR)
    : path.join(projectDir, 'data')
}

const dataDir = resolveDataDir()
const defaultFile = path.join(dataDir, 'openradar.sqlite')

let database: DatabaseSync | undefined
let databaseFile = defaultFile
let legacyMigrationChecked = new Set<string>()

function db() {
  if (!database) {
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true })
    database = new DatabaseSync(databaseFile)
    database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
    database.exec(`
      CREATE TABLE IF NOT EXISTS candidate_pool (
        canonical_url TEXT PRIMARY KEY,
        candidate_json TEXT NOT NULL,
        source_ids_json TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        seen_count INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        tool_id TEXT NOT NULL,
        event TEXT NOT NULL,
        source_kind TEXT,
        source_id TEXT,
        tags_json TEXT,
        occurred_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_occurred_at_idx ON events(occurred_at);
      CREATE TABLE IF NOT EXISTS staged_messages (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS staged_status_updated_idx ON staged_messages(status, updated_at);
      CREATE TABLE IF NOT EXISTS ai_cache (
        cache_key TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    migrateLegacyJson(database)
  }
  return database
}

function migrateLegacyJson(database: DatabaseSync) {
  if (legacyMigrationChecked.has(databaseFile)) return
  legacyMigrationChecked.add(databaseFile)
  const directory = path.dirname(databaseFile)

  try {
    const value = JSON.parse(fs.readFileSync(path.join(directory, 'events.json'), 'utf8')) as unknown
    if (Array.isArray(value) && !database.prepare('SELECT 1 FROM events LIMIT 1').get()) {
      const insert = database.prepare('INSERT OR IGNORE INTO events (id, tool_id, event, source_kind, source_id, tags_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const item of value) {
        if (!item || typeof item !== 'object') continue
        const event = item as Record<string, unknown>
        if (typeof event.id !== 'string' || typeof event.toolId !== 'string' || typeof event.event !== 'string' || typeof event.occurredAt !== 'string') continue
        insert.run(event.id, event.toolId, event.event, typeof event.sourceKind === 'string' ? event.sourceKind : null, typeof event.sourceId === 'string' ? event.sourceId : null, Array.isArray(event.tags) ? JSON.stringify(event.tags) : null, event.occurredAt)
      }
    }
  } catch { /* 旧版本没有行为文件时跳过 */ }

  try {
    const value = JSON.parse(fs.readFileSync(path.join(directory, 'staging.json'), 'utf8')) as unknown
    if (Array.isArray(value) && !database.prepare('SELECT 1 FROM staged_messages LIMIT 1').get()) {
      const insert = database.prepare('INSERT OR IGNORE INTO staged_messages (id, payload_json, status, updated_at) VALUES (?, ?, ?, ?)')
      for (const item of value) {
        if (!item || typeof item !== 'object') continue
        const entry = item as Record<string, unknown>
        if (typeof entry.id !== 'string' || typeof entry.status !== 'string' || typeof entry.updatedAt !== 'string') continue
        insert.run(entry.id, JSON.stringify(item), entry.status, entry.updatedAt)
      }
    }
  } catch { /* 旧版本没有暂存文件时跳过 */ }
}

export function configureStore(file = defaultFile) {
  if (database && databaseFile === file) return
  if (database) database.close()
  databaseFile = file
  database = undefined
  db()
}

export function storePath() {
  return databaseFile
}

export function listStoredCandidates(limit = 100_000): StoredCandidate[] {
  const rows = db().prepare(`SELECT canonical_url, candidate_json, source_ids_json, first_seen_at, last_seen_at, seen_count
    FROM candidate_pool ORDER BY last_seen_at DESC LIMIT ?`).all(Math.max(0, limit))
  return rows.flatMap((row) => {
    try {
      return [{
        candidate: JSON.parse(String(row.candidate_json)) as Candidate,
        canonicalUrl: String(row.canonical_url),
        firstSeenAt: String(row.first_seen_at),
        lastSeenAt: String(row.last_seen_at),
        seenCount: Number(row.seen_count),
        sourceIds: JSON.parse(String(row.source_ids_json)) as string[],
      }]
    } catch { return [] }
  })
}

export function upsertStoredCandidate(entry: StoredCandidate) {
  db().prepare(`INSERT INTO candidate_pool
    (canonical_url, candidate_json, source_ids_json, first_seen_at, last_seen_at, seen_count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(canonical_url) DO UPDATE SET
      candidate_json = excluded.candidate_json,
      source_ids_json = excluded.source_ids_json,
      first_seen_at = excluded.first_seen_at,
      last_seen_at = excluded.last_seen_at,
      seen_count = excluded.seen_count`).run(
    entry.canonicalUrl,
    JSON.stringify(entry.candidate),
    JSON.stringify(entry.sourceIds),
    entry.firstSeenAt,
    entry.lastSeenAt,
    entry.seenCount,
  )
}

export function replaceStoredCandidates(entries: StoredCandidate[]) {
  const database = db()
  database.exec('BEGIN')
  try {
    const statement = database.prepare(`INSERT INTO candidate_pool
      (canonical_url, candidate_json, source_ids_json, first_seen_at, last_seen_at, seen_count)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(canonical_url) DO UPDATE SET
        candidate_json = excluded.candidate_json,
        source_ids_json = excluded.source_ids_json,
        first_seen_at = excluded.first_seen_at,
        last_seen_at = excluded.last_seen_at,
        seen_count = excluded.seen_count`)
    for (const entry of entries) statement.run(entry.canonicalUrl, JSON.stringify(entry.candidate), JSON.stringify(entry.sourceIds), entry.firstSeenAt, entry.lastSeenAt, entry.seenCount)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export function clearStoredCandidates() {
  db().prepare('DELETE FROM candidate_pool').run()
}

export function listStoredEvents(limit = 5000): StoredEvent[] {
  const rows = db().prepare(`SELECT id, tool_id, event, source_kind, source_id, tags_json, occurred_at
    FROM events ORDER BY occurred_at ASC LIMIT ?`).all(Math.max(0, limit))
  return rows.flatMap((row) => {
    if (typeof row.tool_id !== 'string' || typeof row.event !== 'string' || typeof row.occurred_at !== 'string') return []
    let tags: string[] | undefined
    try { tags = row.tags_json ? JSON.parse(String(row.tags_json)) as string[] : undefined } catch { tags = undefined }
    return [{
      id: String(row.id), toolId: String(row.tool_id), event: row.event as UserEvent['event'],
      sourceKind: typeof row.source_kind === 'string' ? row.source_kind as UserEvent['sourceKind'] : undefined,
      sourceId: typeof row.source_id === 'string' ? row.source_id : undefined,
      tags, occurredAt: String(row.occurred_at),
    }]
  })
}

export function insertEvents(items: UserEvent[]) {
  const statement = db().prepare(`INSERT OR IGNORE INTO events
    (id, tool_id, event, source_kind, source_id, tags_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  for (const item of items) statement.run(item.id, item.toolId, item.event, item.sourceKind ?? null, item.sourceId ?? null, item.tags ? JSON.stringify(item.tags) : null, item.occurredAt)
}

export function clearStoredEvents() {
  db().prepare('DELETE FROM events').run()
}

export function trimStoredEvents(limit = 5000) {
  db().prepare(`DELETE FROM events WHERE id NOT IN
    (SELECT id FROM events ORDER BY occurred_at DESC LIMIT ?)`).run(Math.max(0, limit))
}

export function upsertStaged(item: StoreStaged) {
  db().prepare(`INSERT INTO staged_messages (id, payload_json, status, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, status = excluded.status, updated_at = excluded.updated_at`)
    .run(item.id, JSON.stringify(item), item.status, item.updatedAt)
}

export function listStoredStaged(limit = 50, status?: string): StoreStaged[] {
  const query = status
    ? db().prepare('SELECT payload_json FROM staged_messages WHERE status = ? ORDER BY updated_at DESC LIMIT ?').all(status, Math.max(0, limit))
    : db().prepare('SELECT payload_json FROM staged_messages ORDER BY updated_at DESC LIMIT ?').all(Math.max(0, limit))
  return query.flatMap((row) => {
    try { return [JSON.parse(String(row.payload_json)) as StoreStaged] } catch { return [] }
  })
}

export function getStoredStaged(id: string) {
  const row = db().prepare('SELECT payload_json FROM staged_messages WHERE id = ?').get(id)
  if (!row) return undefined
  try { return JSON.parse(String(row.payload_json)) as StoreStaged } catch { return undefined }
}

export function stagedCounts() {
  const rows = db().prepare('SELECT status, COUNT(*) AS count FROM staged_messages GROUP BY status').all()
  return Object.fromEntries(rows.map((row) => [String(row.status), Number(row.count)]))
}

export function getAiCache(key: string) {
  const row = db().prepare('SELECT payload_json FROM ai_cache WHERE cache_key = ?').get(key)
  if (!row) return undefined
  try { return JSON.parse(String(row.payload_json)) as unknown } catch { return undefined }
}

export function setAiCache(key: string, value: unknown) {
  db().prepare(`INSERT INTO ai_cache (cache_key, payload_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`)
    .run(key, JSON.stringify(value), new Date().toISOString())
}
