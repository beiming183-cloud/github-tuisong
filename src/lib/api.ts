import type { GitHubConfig, SourceDescriptor, TelegramStatus, Tool } from '../types'

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
  aiConfig: () => request<{ provider: string; configured: boolean; model: string }>('/api/ai/config'),
  publicStars: (username: string) => request<{ username: string; tools: Tool[] }>(`/api/github/stars?username=${encodeURIComponent(username)}`),
  myStars: () => request<{ username: string; tools: Tool[] }>('/api/github/me/stars'),
  importRepository: (url: string) => request<{ tool: Tool }>('/api/github/repository', {
    method: 'POST',
    body: JSON.stringify({ url }),
  }),
  similar: (owner: string, repo: string) => request<{ source: string; tools: Tool[] }>(`/api/github/similar?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`),
  discoverGitHub: (query = '') => request<{ source: string; query: string; tools: Tool[] }>(`/api/discover/github${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  enrich: (tools: Tool[]) => request<{ configured: boolean; model?: string; patches: Array<Pick<Tool, 'id' | 'title' | 'summary' | 'why' | 'tags' | 'fit' | 'difficulty' | 'value'>> }>('/api/ai/enrich', {
    method: 'POST',
    body: JSON.stringify({ tools }),
  }),
  setStar: (owner: string, repo: string, active: boolean) => request<void>(`/api/github/star/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { method: active ? 'PUT' : 'DELETE' }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
}
