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
  why: string
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

export async function enrichTools(tools: AiToolInput[]) {
  if (!apiKey || tools.length === 0) return []

  const system = `你是 OpenRadar 的中文工具编辑。你的任务不是写新闻，而是把开源项目解释成一个普通人能快速判断的中文工具卡片。
只输出 JSON 对象，不要 Markdown，不要解释过程。格式必须是 {"tools":[...]}。每个项目必须保留原 id，并返回：
{"tools":[{"id":"原id","title":"一句场景化中文标题","summary":"一句直白的中文说明","why":"为什么可能适合这个用户","tags":["三个中文标签"],"fit":"很适合试试/值得认识/探索性推荐/口碑项目","difficulty":"上手低/上手中/需要折腾","value":"日常价值高/改装价值高/探索价值高/扩展价值高"}]}
标题要像宝藏工具频道，不要翻译项目名；不要夸大，不要凭空捏造功能。`
  const user = JSON.stringify(tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    source: tool.source,
    existing_summary: tool.summary,
    existing_tags: tool.tags,
    metadata: tool.repository ?? { language: tool.eyebrow },
  })))

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'OpenRadar-Personal' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: `请为下面这些项目生成中文卡片 JSON：\n${user}` }],
      temperature: 0.35,
      max_tokens: Math.min(5000, Math.max(1200, tools.length * 500)),
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
  return parseJson(content).filter((item) => item && typeof item.id === 'string').map((item) => ({
    ...item,
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 3).map(String) : [],
  }))
}
