#!/usr/bin/env node

/**
 * OpenRadar Personal - Telegram public channel web reader
 *
 * This script intentionally reads only Telegram's public web preview:
 *   https://t.me/s/<channel_username>
 * It does not log in, read browser cookies, or access private channels.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_LIMIT = 20
const DEFAULT_PAGES = 5
const DEFAULT_DELAY_MS = 800
const USER_AGENT = 'OpenRadar-Personal-TelegramWebReader/0.1 (public-channel-reader)'

function printHelp() {
  console.log(`
OpenRadar Telegram 公开频道读取器

用途：读取公开 Telegram 频道的网页预览，输出后续可以交给 OpenRadar 分析的 JSON。
限制：只支持公开频道；不登录、不读取 Cookie、不读取私有群组或私有频道。

用法：
  npm run telegram:read -- <频道链接或用户名> [选项]

示例：
  npm run telegram:read -- @telegram --limit 20
  npm run telegram:read -- https://t.me/s/telegram --limit 50
  npm run telegram:read -- telegram --limit 20 --stdout

选项：
  --limit <数字>       最多读取多少条消息，默认 ${DEFAULT_LIMIT}
  --pages <数字>       最多请求多少页，默认 ${DEFAULT_PAGES}
  --delay <毫秒>       分页请求之间的等待时间，默认 ${DEFAULT_DELAY_MS}
  --out <文件>         输出 JSON 文件；默认 data/telegram-web/<频道>.json
  --stdout             同时把完整 JSON 输出到终端
  --help               显示帮助
`)
}

function positiveInteger(value, flag) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) throw new Error(`${flag} 必须是大于 0 的整数。`)
  return number
}

function nonNegativeInteger(value, flag) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) throw new Error(`${flag} 必须是大于或等于 0 的整数。`)
  return number
}

function parseArgs(argv) {
  const options = { channel: '', limit: DEFAULT_LIMIT, pages: DEFAULT_PAGES, delay: DEFAULT_DELAY_MS, out: '', stdout: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') return { ...options, help: true }
    if (arg === '--stdout') {
      options.stdout = true
      continue
    }
    if (arg === '--limit' || arg === '--pages' || arg === '--delay' || arg === '--out') {
      const value = argv[index + 1]
      if (!value) throw new Error(`${arg} 后面需要一个值。`)
      index += 1
      if (arg === '--out') options.out = value
      else if (arg === '--limit') options.limit = positiveInteger(value, '--limit')
      else if (arg === '--pages') options.pages = positiveInteger(value, '--pages')
      else options.delay = nonNegativeInteger(value, '--delay')
      continue
    }
    if (arg.startsWith('-')) throw new Error(`不认识的选项：${arg}`)
    if (!options.channel) options.channel = arg
    else throw new Error('只能指定一个频道。')
  }
  return options
}

function normalizeChannel(input) {
  const raw = String(input ?? '').trim()
  if (!raw) throw new Error('请提供公开频道用户名或链接，例如 @telegram。')
  let candidate = raw
  if (/^https?:\/\//i.test(candidate)) {
    let url
    try { url = new URL(candidate) } catch { throw new Error('频道链接格式不正确。') }
    if (!['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'].includes(url.hostname.toLowerCase())) {
      throw new Error('当前只支持 t.me 或 telegram.me 的公开频道链接。')
    }
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] === 's') parts.shift()
    candidate = parts[0] ?? ''
  }
  candidate = candidate.replace(/^@/, '').replace(/\/$/, '')
  if (candidate === 's' || candidate.startsWith('joinchat') || candidate.startsWith('+') || candidate.startsWith('c/')) {
    throw new Error('这个链接看起来是私有邀请链接，公开网页读取器暂时不能读取。')
  }
  if (!/^[A-Za-z0-9_]{1,64}$/.test(candidate)) {
    throw new Error('没有识别到公开频道用户名。请使用 @频道名 或 https://t.me/频道名。')
  }
  return candidate
}

function decodeHtml(value) {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function htmlToText(value) {
  return decodeHtml(value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function htmlAttribute(block, name) {
  const expression = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i')
  return decodeHtml(block.match(expression)?.[1] ?? '')
}

function extractLinks(block, text) {
  const links = []
  for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = decodeHtml(match[1]).trim()
    if (/^https?:\/\//i.test(href) && !links.includes(href)) links.push(href)
  }
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/gi)) {
    const href = match[0].replace(/[),.;!?]+$/, '')
    if (!links.includes(href)) links.push(href)
  }
  return links
}

function extractImage(block) {
  const match = block.match(/(?:background-image:\s*url|<img[^>]+src)\s*\(?["']?([^"')\s]+)["']?\)?/i)
  return match ? decodeHtml(match[1]) : null
}

function extractChannelMeta(html, username) {
  const name = htmlToText(html.match(/class="tgme_channel_info_header_title[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
  const description = htmlToText(html.match(/class="tgme_channel_info_description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
  const subscribersText = htmlToText(html.match(/class="tgme_channel_info_counter[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '')
  return { username, name: name || `@${username}`, description: description || null, subscribersText: subscribersText || null, url: `https://t.me/${username}` }
}

function extractMessages(html, username) {
  const starts = [...html.matchAll(/data-post=["']([^"']+)["']/gi)]
  const messages = []
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index].index ?? 0
    const end = starts[index + 1]?.index ?? html.length
    const block = html.slice(Math.max(0, start - 500), end)
    const post = decodeHtml(starts[index][1])
    const parts = post.split('/')
    const postUsername = parts[0] || username
    const id = Number(parts.at(-1))
    if (!Number.isInteger(id)) continue

    const textHtml = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ''
    const text = htmlToText(textHtml)
    const date = htmlAttribute(block.match(/<time\b[^>]*datetime=["'][^"']+["'][^>]*>/i)?.[0] ?? '', 'datetime') || null
    const dateLink = htmlAttribute(block.match(/<a\b[^>]*class=["'][^"']*tgme_widget_message_date[^"']*["'][^>]*>/i)?.[0] ?? '', 'href') || `https://t.me/${postUsername}/${id}`
    const viewsText = htmlToText(block.match(/class="tgme_widget_message_views[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '')
    const author = htmlToText(block.match(/class="tgme_widget_message_from_author[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '') || null
    const forwardedFrom = htmlToText(block.match(/class="tgme_widget_message_forwarded_from[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '') || null

    messages.push({ id, url: dateLink, channel: postUsername, text, publishedAt: date, viewsText: viewsText || null, author, forwardedFrom, image: extractImage(block), links: extractLinks(block, text) })
  }
  return messages
}

async function fetchPreview(username, before) {
  const url = new URL(`https://t.me/s/${username}`)
  if (before) url.searchParams.set('before', String(before))
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`Telegram 网页返回 ${response.status}，暂时无法读取 @${username}。`)
  const html = await response.text()
  if (!html.includes('tgme_widget_message')) throw new Error(`没有找到 @${username} 的公开网页预览。它可能是私有频道、用户名不正确，或 Telegram 暂时限制了访问。`)
  return { html, url: url.toString() }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function readChannel(username, options) {
  const messages = []
  const seen = new Set()
  let before = 0
  let lastOldest = 0
  let firstPageHtml = ''
  let pagesFetched = 0

  while (messages.length < options.limit && pagesFetched < options.pages) {
    const page = await fetchPreview(username, before)
    if (!firstPageHtml) firstPageHtml = page.html
    const pageMessages = extractMessages(page.html, username)
    if (pageMessages.length === 0) break
    for (const message of pageMessages) {
      if (seen.has(message.id)) continue
      seen.add(message.id)
      messages.push(message)
      if (messages.length >= options.limit) break
    }
    pagesFetched += 1
    const oldest = Math.min(...pageMessages.map((message) => message.id))
    if (!oldest || oldest === lastOldest) break
    lastOldest = oldest
    before = oldest
    if (messages.length < options.limit && pagesFetched < options.pages) await sleep(options.delay)
  }

  messages.sort((left, right) => right.id - left.id)
  return { schemaVersion: 1, source: 'telegram-web-preview', fetchedAt: new Date().toISOString(), channel: extractChannelMeta(firstPageHtml, username), pagesFetched, messages: messages.slice(0, options.limit) }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  const username = normalizeChannel(options.channel)
  const result = await readChannel(username, options)
  const outputPath = options.out || path.resolve('data', 'telegram-web', `${username}.json`)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.error(`已读取 @${username}：${result.messages.length} 条消息，${result.pagesFetched} 页。`)
  console.error(`JSON 已保存到：${outputPath}`)
  if (options.stdout) console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(`读取失败：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})

