# Telegram 公开频道读取脚本

## 这是什么

`scripts/telegram-public-reader.mjs` 是 OpenRadar Personal 的第一版 Telegram 读取器。

它使用 Telegram 对公开频道提供的网页预览：

```text
https://t.me/s/<channel_username>
```

因此不需要 API ID/API Hash、手机验证码、Bot Token、Telegram Web 登录、浏览器 Cookie 或 Session。它只适合读取公开频道；私有频道、私有群组、邀请链接和需要登录后才能看到的消息不会被读取。

## 运行

在项目根目录执行：

```powershell
npm run telegram:read -- @telegram --limit 20
```

也支持以下输入：

```powershell
npm run telegram:read -- telegram --limit 20
npm run telegram:read -- https://t.me/telegram --limit 20
npm run telegram:read -- https://t.me/s/telegram --limit 50 --pages 5
```

默认会写入：

```text
data/telegram-web/telegram.json
```

如果想把完整 JSON 同时打印到终端：

```powershell
npm run telegram:read -- @telegram --limit 20 --stdout
```

自定义输出文件：

```powershell
npm run telegram:read -- @telegram --limit 50 --out work/telegram.json
```

## 参数

| 参数 | 默认值 | 说明 |
|---|---:|---|
| `--limit` | 20 | 最多返回多少条消息 |
| `--pages` | 5 | 最多请求多少页 |
| `--delay` | 800 | 分页请求之间等待多少毫秒 |
| `--out` | `data/telegram-web/<频道>.json` | 输出路径 |
| `--stdout` | 关闭 | 同时输出完整 JSON |

## 输出结构

```json
{
  "schemaVersion": 1,
  "source": "telegram-web-preview",
  "fetchedAt": "2026-09-28T00:00:00.000Z",
  "channel": {
    "username": "telegram",
    "name": "Telegram News",
    "description": "...",
    "subscribersText": "9.45M subscribers",
    "url": "https://t.me/telegram"
  },
  "pagesFetched": 1,
  "messages": [
    {
      "id": 123,
      "url": "https://t.me/telegram/123",
      "channel": "telegram",
      "text": "消息正文",
      "publishedAt": "2026-09-28T12:00:00+00:00",
      "viewsText": "12.3K",
      "author": null,
      "forwardedFrom": null,
      "image": "https://cdn...",
      "links": ["https://github.com/example/project"]
    }
  ]
}
```

## 已接入 OpenRadar 的正式路径

命令行脚本仍然只负责一次性导出 JSON；服务端正式使用 `server/connectors/telegram-public.ts`，不会让脚本直接修改前端卡片：

```text
公开网页预览 / 增量游标
    ↓
GitHub 仓库元数据
    ↓
统一 Candidate（sourceKind=telegram）
    ↓
URL 去重
    ↓
GitHub / 网页元数据补充
    ↓
DeepSeek 中文解释
    ↓
OpenRadar 推荐流
```

建议从每条消息中抽取原始频道、消息链接、发布时间、正文、GitHub/官网/Product Hunt 链接、图片地址、浏览量和转发来源。脚本也会识别正文中单独成行的 `owner/repo`，自动补成 `https://github.com/owner/repo`；这是资源频道常见的发帖方式。

## 参考的开源思路

- [`cxumol/tg-channel-api`](https://github.com/cxumol/tg-channel-api)：将公开频道网页内容转换成 JSON API。
- [`mvanhorn/last30days-skill` 的 Telegram 方案讨论](https://github.com/mvanhorn/last30days-skill/issues/990)：使用 `t.me/s/<channel>`、`before=<message_id>` 分页，以及 `.tgme_widget_message_*` 选择器。

这些项目的思路被参考，但没有直接把第三方服务当成 OpenRadar 的依赖。频道配置保存在 `data/telegram-web/channels.json`，每个频道的 `lastMessageId` 和同步结果保存在 `data/telegram-web/state.json`。首次同步必须由用户手动触发；完成一次后默认每 24 小时最多增量读取一次。用户提供的频道清单已经写入配置，但没有自动执行几百条历史读取。

公开频道目前只把 GitHub 项目转成可渲染候选。频道正文、发布时间、浏览量、图片和消息地址会写入候选 metadata，后续可以用于 DeepSeek 的中文解释和来源展示；非 GitHub 链接暂时保留在原始消息解析层，等通用网页元数据连接器完成后再加入。

服务端接口：

```text
GET  /api/telegram/public/status
PUT  /api/telegram/public/channels  { channels: string[] }
POST /api/telegram/public/sync      { channels?: string[], limit?: number, pages?: number }
```

历史回看建议：消息少的频道先取最近十几条；一般频道先取 100～200 条；消息特别密集的频道再手动提高到 500 或更多，并先放入候选暂存区，不要直接全部推到首页。

## 限制和注意事项

- 只有公开网页预览可见的频道可以读取。
- Telegram 调整网页结构后，选择器可能需要更新。
- 公开网页读取不适合高频轮询；建议控制分页数量和请求间隔。
- 不要为了读取私有内容去提取浏览器 Cookie 或 Telegram Session。
- 如果以后必须读取私有群组或完整历史，再单独评估 Telegram API/Telethon/GramJS，并保持显式授权和本地加密。
