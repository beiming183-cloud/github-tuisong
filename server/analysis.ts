/**
 * 分析队列：把候选池里还没有 AI 中文卡片的项目，分批送去分析。
 *
 * 为什么要有这个模块（交接手册 §20.5 交给下一位的下一步）：
 * 抓取是批量的，但分析必须是有界、可中断、可续跑的。直接对上千条候选
 * 调一次 DeepSeek 会同时撞上三个问题：请求体过大、失败要全部重做、
 * 没有花销上限。所以这里把「该分析什么」「这次分析多少」「分析完怎么记」
 * 拆成三个可以分别验证的步骤。
 *
 * 设计约束：
 * - 不在这里读 .env、不直接 fetch：真正的调用注入进来（默认 enrichTools），
 *   这样没有 API Key 也能完整测队列逻辑（见 check-analysis.ts）。
 * - 没有配置 DeepSeek 时**什么都不改**，只如实报告 configured=false。
 *   不能把「没分析」记成「已分析」，否则队列会在用户毫无察觉的情况下空转完。
 * - 「已分析」靠 candidate.metadata.analyzedAt 判断，而不是只看 status，
 *   因为 status 会被连接器的重新同步影响。
 */
import type { PooledCandidate } from './candidates.js'
import { applyAiPatches, listPool, markAnalysisSkipped } from './candidates.js'
import { deepSeekConfig, enrichTools, promptVersion, type AiToolInput, type AiToolPatch } from './ai.js'
import { candidateToRepo } from './connectors/github.js'

/** 单批默认值。DeepSeek 那条路径一次最多收 8 个，这里默认更保守。 */
export const DEFAULT_ANALYSIS_BATCH = 6
export const MAX_ANALYSIS_BATCH = 8

export function clampBatchSize(limit?: number) {
  const value = Math.trunc(Number(limit ?? DEFAULT_ANALYSIS_BATCH))
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_ANALYSIS_BATCH
  return Math.min(value, MAX_ANALYSIS_BATCH)
}

export type AnalysisState = 'analyzed' | 'needsAnalysis' | 'notEligible'

/** 一个候选当前处于分析的哪个阶段。 */
export function analysisStateOf(entry: PooledCandidate): AnalysisState {
  const status = entry.candidate.status
  if (status === 'pending' || status === 'raw' || status === 'staged' || status === 'filtered' || status === 'dismissed' || status === 'failed') {
    return 'notEligible'
  }
  const meta = entry.candidate.metadata
  const analyzed = Boolean(meta?.analyzedAt || meta?.aiPatch)
  if (!analyzed) return 'needsAnalysis'
  // Prompt 改版后，旧版本产出的卡片必须重算。
  // 没有这一步的话「升级 prompt」永远不会生效：候选已经被标成 analyzed，
  // 队列会认为无事可做，改了 prompt 也只是白改。
  return meta?.analysisVersion === promptVersion ? 'analyzed' : 'needsAnalysis'
}

export type AnalysisBacklog = {
  total: number
  analyzed: number
  needsAnalysis: number
  notEligible: number
  bySourceKind: Record<string, { total: number; analyzed: number; needsAnalysis: number }>
}

export function analysisBacklog(): AnalysisBacklog {
  const entries = listPool(100_000)
  const backlog: AnalysisBacklog = { total: entries.length, analyzed: 0, needsAnalysis: 0, notEligible: 0, bySourceKind: {} }
  for (const entry of entries) {
    const state = analysisStateOf(entry)
    backlog[state] += 1
    const kind = entry.candidate.sourceKind
    backlog.bySourceKind[kind] ??= { total: 0, analyzed: 0, needsAnalysis: 0 }
    backlog.bySourceKind[kind].total += 1
    if (state === 'analyzed') backlog.bySourceKind[kind].analyzed += 1
    if (state === 'needsAnalysis') backlog.bySourceKind[kind].needsAnalysis += 1
  }
  return backlog
}

/** 选出本批要分析的候选。先分析最近入池的，让用户更快看到中文卡片。 */
export function selectAnalysisBatch(limit?: number): PooledCandidate[] {
  const size = clampBatchSize(limit)
  return listPool(100_000)
    .filter((entry) => analysisStateOf(entry) === 'needsAnalysis')
    .slice(0, size)
}

/**
 * 把候选转成 AI 输入。
 *
 * id 必须用 sourceItemId：applyAiPatches 按它（或卡片 id / canonicalUrl）回写。
 * 只送名字、说明、标签和仓库元数据，不把 rawText（频道原文）整段送出去——
 * 那里面可能混着推广内容和无关链接，也不该无谓地把私人频道原文发给第三方。
 */
export function candidateToAiInput(entry: PooledCandidate): AiToolInput {
  const repo = candidateToRepo(entry.candidate)
  return {
    id: entry.candidate.sourceItemId ?? entry.canonicalUrl,
    name: entry.candidate.title ?? repo?.name ?? entry.canonicalUrl,
    eyebrow: repo ? `${repo.language ?? '开源'} · ${repo.stargazers_count} Star` : entry.candidate.sourceLabel,
    summary: entry.candidate.description ?? '',
    tags: entry.candidate.tags ?? [],
    source: entry.canonicalUrl,
    repository: repo
      ? {
          fullName: repo.full_name,
          stars: repo.stargazers_count,
          language: repo.language,
          topics: repo.topics ?? [],
        }
      : undefined,
  }
}

export type AnalysisEnricher = (tools: AiToolInput[]) => Promise<AiToolPatch[]>

export type AnalysisRunOptions = {
  limit?: number
  /** 只报告会做什么，不改任何数据。 */
  dryRun?: boolean
  /** 测试注入用；默认走真实的 DeepSeek。 */
  enricher?: AnalysisEnricher
  /** 覆盖「是否已配置」的判断，仅测试用。 */
  configured?: boolean
}

export type AnalysisRunResult = {
  configured: boolean
  dryRun: boolean
  attempted: number
  /** 真正写回候选池的数量。 */
  applied: number
  /** 有 AI 结果但没能写回任何候选的数量。 */
  unmatched: number
  /** 本批标记为已分析、但没有拿到 AI 结果的数量。 */
  skipped: number
  remaining: number
  batchSizeLimit: number
  /** 本批实际送出去的项目 id，便于排查。 */
  ids: string[]
  error?: string
}

/**
 * 跑一批分析。
 *
 * 什么时候把候选标记为已分析：
 * - 拿到 patch：写回并标记 analyzed。
 * - 调用成功但某个项目没返回结果：也标记 analyzed（记 analysisSkipped），
 *   否则它会在每一批里反复出现，永远堵住队列。
 * - 调用抛错：**什么都不标记**，整批留给下次重试。
 * - 没有配置 DeepSeek：**什么都不标记**，只报告 configured=false。
 */
export async function runAnalysisBatch(options: AnalysisRunOptions = {}): Promise<AnalysisRunResult> {
  const configured = options.configured ?? deepSeekConfig.configured
  const batch = selectAnalysisBatch(options.limit)
  const ids = batch.map((entry) => entry.candidate.sourceItemId ?? entry.canonicalUrl)

  const base: AnalysisRunResult = {
    configured,
    dryRun: Boolean(options.dryRun),
    attempted: batch.length,
    applied: 0,
    unmatched: 0,
    skipped: 0,
    remaining: analysisBacklog().needsAnalysis,
    batchSizeLimit: clampBatchSize(options.limit),
    ids,
  }

  // 没配置或没有可做的，都不改数据。
  if (!configured || batch.length === 0 || options.dryRun) return base

  const enricher = options.enricher ?? enrichTools
  let patches: AiToolPatch[]
  try {
    patches = await enricher(batch.map(candidateToAiInput))
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) }
  }

  const applied = applyAiPatches(patches)

  // 没有拿到结果的项目也标记为已处理，避免它们反复占用每一批的名额。
  const answered = new Set<string>()
  for (const patch of patches) answered.add(patch.id)
  let skipped = 0
  for (const entry of batch) {
    const id = entry.candidate.sourceItemId ?? entry.canonicalUrl
    if (answered.has(id) || answered.has(entry.canonicalUrl)) continue
    markAnalysisSkipped(entry.canonicalUrl)
    skipped += 1
  }

  return {
    ...base,
    applied,
    unmatched: Math.max(0, patches.length - applied),
    skipped,
    remaining: analysisBacklog().needsAnalysis,
  }
}
