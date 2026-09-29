/**
 * 来源连接器的统一接口。
 *
 * 设计约定（见交接手册第 12 节）：
 * - 连接器只负责“找到东西”，不要在这里写 UI 文案和推荐排序。
 * - 任何来源都必须先转换成 Candidate，再进入去重、评分和 AI 解释。
 * - 字段名一旦被连接器使用，就属于接口契约，修改前要先记录到交接手册。
 */

/** 与 src/types.ts 中 Tool['sourceKind'] 保持同步。 */
export type SourceKind = 'github' | 'rss' | 'telegram' | 'product-hunt' | 'hacker-news' | 'manual'

/**
 * 统一候选。跨来源去重只依赖 canonicalUrl。
 */
export type Candidate = {
  /** 归一化后的唯一地址，由 server/candidates.ts 的 canonicalizeUrl 生成。 */
  canonicalUrl: string
  /** 来源内部的稳定 ID，例如 github-12345，用于回查原始记录。 */
  sourceItemId?: string
  title?: string
  description?: string
  /**
   * 来源侧归好的中文标签（例如「文件工具」「本地运行」）。
   * 推荐评分用它做兴趣匹配；卡片渲染也复用同一批标签，
   * 避免“评分用的标签”和“用户看到的标签”不一致。
   */
  tags?: string[]
  sourceKind: SourceKind
  /** 对应 server/sources.ts 里的来源 id，例如 github-discovery。 */
  sourceId: string
  sourceLabel: string
  /** 来源侧的发布时间或最近更新时间，ISO 字符串。 */
  sourcePublishedAt?: string
  /** 原文片段，供 AI 解释使用；不要塞入用户私人数据。 */
  rawText?: string
  /** 来源专属字段。GitHub 的约定结构见 connectors/github.ts。 */
  metadata?: Record<string, unknown>
  /** 处理状态；历史候选没有该字段时按 ready 兼容。 */
  status?: 'raw' | 'staged' | 'analyzed' | 'ready' | 'filtered' | 'dismissed' | 'failed' | 'pending'
}

/**
 * 调用连接器时传入的鉴权信息。
 * 由 server/index.ts 从本地加密会话解析后注入，连接器自身不读 Cookie、不读 .env。
 */
export type ConnectorAuth = {
  token?: string
}

export type FetchCandidatesInput = {
  /** 上一批返回的游标；没有游标表示从头开始。 */
  cursor?: string
  /** 本批最多返回多少条，连接器需要自己做上限保护。 */
  limit: number
  /** 可选的自定义查询词，来源不支持时忽略。 */
  query?: string
  auth?: ConnectorAuth
}

export type FetchCandidatesResult = {
  candidates: Candidate[]
  nextCursor?: string
}

export type ConnectorConfigStatus = {
  ready: boolean
  /** 面向用户的中文说明，例如“需要先在 .env 填写 API Key”。 */
  message?: string
}

export interface SourceConnector {
  id: string
  label: string
  kind: SourceKind
  checkConfig(): Promise<ConnectorConfigStatus>
  fetchCandidates(input: FetchCandidatesInput): Promise<FetchCandidatesResult>
}

/**
 * 推荐卡片。与 src/types.ts 的 Tool 结构保持一致，
 * 但服务端不能直接引用 src/（两套 tsconfig 分开编译），因此在此镜像一份。
 * 改动时两个文件必须同时改。
 */
export type ToolCard = {
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
  /** 来源 id，前端上报行为事件时带上，用于统计来源偏好。 */
  sourceId?: string
  repository?: {
    owner: string
    name: string
    fullName: string
    stars: number
    language: string | null
    updatedAt: string
    topics: string[]
  }
  sourceKind?: SourceKind
}
