export type Tab = 'recommend' | 'explore' | 'saved'

export type RepositoryInfo = {
  owner: string
  name: string
  fullName: string
  stars: number
  language: string | null
  updatedAt: string
  topics: string[]
}

export type Tool = {
  id: string
  name: string
  eyebrow: string
  title: string
  summary: string
  tags: string[]
  fit: string
  difficulty: string
  value: string
  source: string
  sourceLabel: string
  image: string
  accent: 'coral' | 'teal' | 'ink'
  explore?: boolean
  repository?: RepositoryInfo
  sourceKind?: 'github' | 'rss' | 'telegram' | 'product-hunt' | 'hacker-news' | 'manual'
  /** 来源 id，例如 github-discovery，用于上报行为事件时标记来源偏好。 */
  sourceId?: string
  relatedCount?: number
}

export type UserEventName = 'view' | 'open_source' | 'like' | 'save' | 'star' | 'compare' | 'similar' | 'skip' | 'dismiss'

export type ProfileSummary = {
  hasProfile: boolean
  headline: string
  updatedAt: string | null
  lines: Array<{ label: string; detail: string }>
  eventCount: number
  profile: {
    tagWeights: Record<string, number>
    sourceKindWeights: Record<string, number>
    sourceIdWeights: Record<string, number>
    positiveCount: number
    negativeCount: number
    skippedCount: number
    dismissedCount: number
  }
}

export type SourceDescriptor = {
  id: string
  label: string
  kind: NonNullable<Tool['sourceKind']>
  status: 'ready' | 'needs_config' | 'coming_soon'
  description: string
}

export type TelegramStatus = {
  configured: boolean
  connected: boolean
  loggingIn?: boolean
  user: { id: string; username: string | null; name: string } | null
}

export type GitHubUser = {
  login: string
  name: string | null
  avatar_url: string
}

export type GitHubConfig = {
  oauthConfigured: boolean
  connected: boolean
  user: GitHubUser | null
}
