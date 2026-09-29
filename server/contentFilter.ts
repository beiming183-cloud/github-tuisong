/**
 * 内容过滤：把推广、代理订阅、免费资源列表这类内容挡在推荐流之外。
 *
 * 为什么单独抽一个模块：
 * 过滤原先只做在 **Telegram 消息文本** 上（`isLikelyAdvertisement`）。
 * 但一个频道可能只是丢了个 GitHub 链接、正文没提节点，而仓库本身的描述
 * 写满了「免费节点 / 免费订阅 / 每小时更新代理列表」——这种就漏过去了，
 * 还拿到了一张很漂亮的中文卡片。所以过滤必须同时作用在消息和仓库两个层面。
 *
 * 刻意只挡「免费资源列表」这一类，不挡代理**软件**本身：
 * clash-verge-rev 这种正经开源客户端仍然是有用的工具，属于产品该收的内容；
 * 而「收集全网免费节点」的仓库不是工具，只是不断刷新的资源列表。
 */

/**
 * 消息文本层面的推广特征。
 *
 * 「节点」被单独拆出来是有原因的：它在技术语境里太常见了
 * （节点式编辑器、区块链节点、Kubernetes 节点），裸匹配会把正经技术分享
 * 也挡掉。所以只有当它和「免费/订阅/池/稳定/解锁」这类推广词相邻时才算数。
 */
const MESSAGE_PATTERNS = [
  /机场|梯子|翻墙|加速器|vpn|v\s*p\s*n|代理订阅|科学上网/iu,
  /节点[^。，,；]{0,6}(免费|订阅|池|分享|稳定|解锁|高速|可用|上车)/iu,
  /(免费|稳定|高速|解锁)[^。，,；]{0,6}节点/iu,
  /优惠码|折扣码|注册码|注册送|注册即送|限时优惠|年付|月付/iu,
  /广告合作|商务合作|推广|赞助|推广链接|点击购买|立即购买/iu,
]

/**
 * 仓库层面的特征：免费节点/代理/订阅的**收集列表**。
 * 只匹配「免费 + 资源列表」语义，不匹配单纯的代理工具。
 */
const REPO_PATTERNS = [
  /免费\s*(节点|代理|订阅|机场|账号|ssr?|v2ray|clash|trojan)/iu,
  /(节点|代理|订阅|机场)\s*(列表|合集|汇总|分享|池|仓库)/iu,
  /(每小时|每天|每日|定时)[^。，,；]{0,8}(更新|分享)/iu,
  /free\s+(proxy|node|nodes|ss|ssr|v2ray|clash|trojan|subscription)/i,
  /(proxy|node|v2ray|clash|ssr?)\s*(list|pool|collection|subscription)s?\b/i,
  /public\s+(proxy|node)s?\b/i,
]

/** 命中几条才算推广；单条命中且文本很短时也算。 */
export function looksLikePromotion(text: string) {
  const normalized = text.toLowerCase()
  const hits = MESSAGE_PATTERNS.reduce((count, pattern) => count + (pattern.test(normalized) ? 1 : 0), 0)
  return hits >= 1 && (normalized.length < 1200 || hits >= 2)
}

export function looksLikeFreeResourceList(text: string) {
  return REPO_PATTERNS.some((pattern) => pattern.test(text))
}

export type RepoLike = {
  name?: string | null
  description?: string | null
  topics?: string[]
}

/**
 * 判断一个 GitHub 仓库是不是「免费代理/节点订阅列表」这类噪音。
 * 只看仓库自身的信息（名称、描述、topics），不看频道正文。
 */
export function isFreeResourceRepo(repo: RepoLike) {
  const haystack = [repo.name ?? '', repo.description ?? '', ...(repo.topics ?? [])].join(' ')
  return looksLikeFreeResourceList(haystack)
}

export function promotionReason(repo: RepoLike) {
  const haystack = [repo.name ?? '', repo.description ?? ''].join(' ')
  const match = REPO_PATTERNS.find((pattern) => pattern.test(haystack))
  return match ? `疑似免费节点/代理订阅列表（命中 ${String(match)}）` : '疑似推广或资源列表内容'
}
