import crypto from 'node:crypto'
import { getAiCache, setAiCache } from './store.js'

export type AiToolInput = {
  id: string
  name: string
  eyebrow: string
  summary: string
  tags: string[]
  source: string
  repository?: {
    fullName: string
    stars: number
    language: string | null
    topics: string[]
  }
}

export type AiToolPatch = {
  id: string
  title: string
  summary: string
  tags: string[]
  fit: string
  difficulty: string
  value: string
}

const apiKey = process.env.DEEPSEEK_API_KEY
const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '')
const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'

export const deepSeekConfig = {
  configured: Boolean(apiKey),
  model,
  baseUrl,
}

function parseJson(content: string) {
  const cleaned = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as AiToolPatch[]
  const objectStart = cleaned.indexOf('{')
  const objectEnd = cleaned.lastIndexOf('}')
  if (objectStart >= 0 && objectEnd > objectStart) {
    const parsed = JSON.parse(cleaned.slice(objectStart, objectEnd + 1)) as { tools?: AiToolPatch[] }
    return parsed.tools ?? []
  }
  return []
}

/**
 * 缓存键。
 *
 * ⚠️ 这里的版本号必须跟着 **system prompt 一起改**。
 * 缓存键只由输入内容算出来，不含 prompt；也就是说改了 prompt 却不改版本号，
 * 老结果会一直被复用，新 prompt 等于没生效。
 * v2 → v3：加入了「不得从仓库名或 owner 名推断功能与组织」的约束。
 */
const PROMPT_VERSION = 'v3'

/** 当前 prompt 版本。分析队列用它判断已有结果是否过期。 */
export const promptVersion = PROMPT_VERSION

function cacheKey(tool: AiToolInput) {
  return `tool-card:${PROMPT_VERSION}:` + crypto.createHash('sha256').update(JSON.stringify(tool)).digest('hex')
}

function validPatch(value: unknown): value is AiToolPatch {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<AiToolPatch>
  return typeof item.id === 'string' && typeof item.title === 'string' && typeof item.summary === 'string'
}

export async function enrichTools(tools: AiToolInput[]) {
  if (!apiKey || tools.length === 0) return []

  const cached: AiToolPatch[] = []
  const pending: AiToolInput[] = []
  for (const tool of tools) {
    const value = getAiCache(cacheKey(tool))
    if (validPatch(value)) cached.push(value)
    else pending.push(tool)
  }
  if (pending.length === 0) return cached

  const system = `你是 OpenRadar 的中文工具编辑。你的任务不是写新闻，而是把开源项目解释成一个普通人能快速判断的中文工具卡片。
只输出 JSON 对象，不要 Markdown，不要解释过程。格式必须是 {"tools":[...]}。每个项目必须保留原 id，并返回：
{"tools":[{"id":"原id","title":"一句场景化中文标题","summary":"一句直白的中文说明","tags":["三个中文标签"],"fit":"很适合试试/值得认识/探索性推荐/口碑项目","difficulty":"上手低/上手中/需要折腾","value":"日常价值高/改装价值高/探索价值高/扩展价值高"}]}
标题要像宝藏工具频道，不要翻译项目名。

【最重要的一条】只能依据下面给出的 description 和 metadata 写卡片，绝对不要凭仓库名、owner 名或组织名去推测它的功能：
- owner 名只是账号名，不代表任何公司、组织或质量背书。不要写「腾讯出的」「某公司开源」这类来源描述，除非 description 里明确写了。
- description 为空或明显不足时，不要编造功能。标题写成「仓库名 + 暂时看不出用途」这类如实说法，摘要第一句必须是「仓库没有提供说明，需要打开链接确认」，tags 只给「信息有限」加两个中性词，difficulty 给「需要折腾」，value 给「探索价值高」，fit 给「探索性推荐」。
- 不要添加原文里没有的具体数字、量级词（例如「千亿级」「毫秒级」）、平台支持或功能承诺。
- 如果 description 是课程作业、题目集、资源列表、索引或基础设施仓库，如实标注它是哪一类，不要包装成可以直接使用的工具。`
  // 字段名要让模型能分清「事实」和「要它补的东西」。
  // 以前叫 existing_summary，模型容易当成「已经写好的摘要」去润色；
  // 现在直接把 description 摊开，并显式告诉它描述是否缺失。
  const user = JSON.stringify(pending.map((tool) => {
    const description = (tool.summary ?? '').trim()
    return {
      id: tool.id,
      name: tool.name,
      repo: tool.repository?.fullName ?? null,
      description: description || null,
      description_missing: description.length === 0,
      language: tool.repository?.language ?? null,
      stars: tool.repository?.stars ?? null,
      topics: tool.repository?.topics ?? [],
      source: tool.source,
    }
  }))

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'OpenRadar-Personal' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: `请为下面这些项目生成中文卡片 JSON：\n${user}` }],
      temperature: 0.35,
      max_tokens: Math.min(5000, Math.max(1200, pending.length * 500)),
      response_format: { type: 'json_object' },
      stream: false,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw Object.assign(new Error(`DeepSeek 请求失败（${response.status}）`), { status: 502, detail })
  }
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content ?? ''
  const fresh = parseJson(content).filter(validPatch).map((item) => ({
    ...item,
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 3).map(String) : [],
  }))
  for (const item of fresh) setAiCache(cacheKey(pending.find((tool) => tool.id === item.id) ?? { id: item.id, name: item.id, eyebrow: '', summary: '', tags: [], source: '' }), item)
  return [...cached, ...fresh]
}
