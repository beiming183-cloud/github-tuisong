# OpenRadar Personal

个人中文新工具发现与研究助手的 V0.1 前端原型。

## AI 协同开发交接

完整的项目背景、当前状态、接口、环境变量、安全边界、Telegram 暂停原因和多 AI 协作规则见 [`docs/AI-交接手册.md`](./docs/AI-交接手册.md)。后续代理开始工作前应先阅读这份手册。

## 当前已实现

- 频道编辑流风格的中文推荐页
- 为你推荐 / 探索 / 我的收藏三种浏览状态
- 场景化中文工具卡片与真实项目预览图
- 喜欢、收藏、GitHub Star、找相似、加入比较
- 搜索过滤、项目详情与横向比较抽屉
- 移动端适配与键盘焦点状态
- GitHub 公开用户名导入 Star
- GitHub 项目链接分析与相似项目搜索
- 可选 GitHub OAuth：读取自己的 Star，并同步一键 Star
- 可选 DeepSeek 中文分析：把英文项目资料改写成场景化中文卡片
- Telegram 个人账号 QR 登录基础链路（频道抓取将在提供频道后接入）

## 本地运行

```bash
npm install
npm run dev
```

这会同时启动前端（5173）和本地 API（8787）。如果只想启动前端，可以运行 `npm run dev:web`。

生产构建：

```bash
npm run build
```

## 下一步接入

当前仍保留 `src/data/sampleTools.ts` 作为离线演示数据；真实项目通过本地 API 接入。DeepSeek 只在服务端调用，浏览器不会接触 API Key。

## GitHub OAuth（可选）

复制 `.env.example` 为 `.env`，填写 GitHub OAuth App 的 Client ID 和 Client Secret。没有配置 OAuth 时，仍然可以在页面中输入公开 GitHub 用户名读取 Star。

连接成功后，会话令牌会使用本地密钥加密保存在 `data/sessions.json`，重启 API 不会立即掉线。这个文件已经加入忽略列表，不会被提交到 Git。

## DeepSeek 中文分析

在 `.env` 中填写 `DEEPSEEK_API_KEY`，默认使用 `deepseek-chat` 和 `https://api.deepseek.com`。页面导入 GitHub Star、丢入 GitHub 链接或找相似项目后，会先显示本地规则结果，再异步用 DeepSeek 补充中文标题、摘要、适合度和标签；没有 API Key 时仍可正常使用规则结果。

服务端接口：

- `GET /api/ai/config`：检查 DeepSeek 是否已配置；
- `POST /api/ai/enrich`：传入 `{ "tools": [...] }`，返回中文卡片补丁。

## Telegram 连接

Telegram 桌面端的登录状态不能直接被网页读取。需要在 [my.telegram.org](https://my.telegram.org) 的 API development tools 创建个人 API，填写 `TELEGRAM_API_ID` 和 `TELEGRAM_API_HASH` 后，页面会用 QR 码让已登录的 Telegram 客户端确认一次。会话会加密保存到 `data/telegram-session.json`；频道消息适配会在确定频道后继续接入。
