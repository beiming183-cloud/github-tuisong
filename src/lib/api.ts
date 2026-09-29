import type { GitHubConfig, ProfileSummary, SourceDescriptor, TelegramStatus, Tool, UserEventName } from '../types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(data?.error ?? '请求没有成功，请稍后再试。')
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  githubConfig: () => request<GitHubConfig>('/api/github/config'),
  sources: () => request<{ sources: SourceDescriptor[] }>('/api/sources'),
  telegramConfig: () => request<TelegramStatus>('/api/telegram/config'),
  telegramLoginStart: () => request<{ id: string; status: 'waiting' | 'connected' | 'error'; qrUrl?: string; expiresAt?: number; user?: TelegramStatus['user']; error?: string }>('/api/telegram/login/start', { method: 'POST' }),
  telegramLoginStatus: (id: string) => request<{ id: string; status: 'waiting' | 'connected' | 'error'; qrUrl?: string; expiresAt?: number; user?: TelegramStatus['user']; error?: string }>(`/api/telegram/login/${encodeURIComponent(id)}`),
  telegramLogout: () => request<void>('/api/telegram/logout', { method: 'POST' }),
  telegramPublicStatus: () => request<{
    configured: boolean
    channels: Array<{ username: string; url: string; lastMessageId: number | null; lastFetchedAt: string | null; lastCandidateCount: number; lastError: string | null }>
    lastSyncAt: string | null
    lastSyncOk: boolean | null
    lastError: string | null
  }>('/api/telegram/public/status'),
  telegramPublicChannels: (channels: string[]) => request<{ channels: string[] }>('/api/telegram/public/channels', {
    method: 'PUT',
    body: JSON.stringify({ channels }),
  }),
  telegramPublicSync: (channels?: string[], limit = 40) => request<{
    messagesRead: number
    channelResults: Array<{ username: string; messagesRead: number; candidates: number; lastMessageId: number | null; error?: string }>
    candidates: Tool[]
    pool: { size: number; added: number; duplicates: number }
  }>('/api/telegram/public/sync', {
    method: 'POST',
    body: JSON.stringify({ channels, limit }),
  }),
  aiConfig: () => request<{ provider: string; configured: boolean; model: string }>('/api/ai/config'),
  publicStars: (username: string) => request<{ username: string; tools: Tool[] }>(`/api/github/stars?username=${encodeURIComponent(username)}`),
  myStars: () => request<{ username: string; tools: Tool[] }>('/api/github/me/stars'),
  backfillGitHub: (limit = 20) => request<{ attempted: number; updated: number; failed: number; remaining: number }>('/api/github/backfill', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  }),
  importRepository: (url: string) => request<{ tool: Tool }>('/api/github/repository', {
    method: 'POST',
    body: JSON.stringify({ url }),
  }),
  similar: (owner: string, repo: string) => request<{ source: string; tools: Tool[] }>(`/api/github/similar?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`),
  discoverGitHub: (query = '') => request<{ source: string; query: string; tools: Tool[]; pool?: { size: number; added: number; duplicates: number } }>(`/api/discover/github${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  enrich: (tools: Tool[]) => request<{ configured: boolean; model?: string; patches: Array<Pick<Tool, 'id' | 'title' | 'summary' | 'tags' | 'fit' | 'difficulty' | 'value'>> }>('/api/ai/enrich', {
    method: 'POST',
    body: JSON.stringify({ tools }),
  }),
  setStar: (owner: string, repo: string, active: boolean) => request<void>(`/api/github/star/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { method: active ? 'PUT' : 'DELETE' }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  /** 上报用户行为。调用方必须吞掉异常：埋点失败不能打断用户正在做的事。 */
  recordEvents: (events: Array<{ toolId: string; event: UserEventName; sourceKind?: Tool['sourceKind']; sourceId?: string; tags?: string[] }>) =>
    request<{ stored: number; rejected: number }>('/api/events', { method: 'POST', body: JSON.stringify({ events }) }),
  profile: () => request<ProfileSummary>('/api/profile'),
  feed: (cursor = '', limit = 20) => request<{
    source: string
    hasProfile: boolean
    considered: number
    pending: number
    items: Tool[]
    nextCursor: string | null
    hasMore: boolean
  }>('/api/feed?limit=' + limit + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')),
  related: (projectId: string) => request<{ source: string; tools: Tool[] }>('/api/projects/' + encodeURIComponent(projectId) + '/related'),
  feedback: (tool: Tool, event: UserEventName) => request<{ stored: number }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({ projectId: tool.id, event, sourceKind: tool.sourceKind, sourceId: tool.sourceId, tags: tool.tags }),
  }),
  recommend: (limit = 12) => request<{ source: string; hasProfile: boolean; updatedAt: string | null; considered: number; tools: Tool[] }>(`/api/recommend?limit=${limit}`),
}
