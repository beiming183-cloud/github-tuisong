# OpenRadar Personal

面向个人的中文「新工具发现与研究助手」。它不是 GitHub 热榜，也不是新闻聚合站，而是把分散在项目、频道和工具目录里的新东西，整理成一眼能看懂的中文卡片，并通过你的真实行为慢慢理解你喜欢什么。

当前状态：V0.5 —— 推荐流、GitHub 接入、统一候选池与去重、行为事件与可解释兴趣评分都已可用；候选池仍是内存态，Telegram 频道抓取仍受外部条件阻塞。

## AI 协同开发交接

完整的项目背景、当前状态、接口、环境变量、安全边界、Telegram 暂停原因和多 AI 协作规则见 [`docs/AI-交接手册.md`](./docs/AI-交接手册.md)。后续代理开始工作前应先阅读这份手册。

## 当前已实现

- 频道编辑流风格的中文推荐页
- 为你推荐 / 探索 / 我的收藏三种浏览状态
- 场景化中文工具卡片与真实项目预览图
- 喜欢、收藏、GitHub Star、跳过、找相似、加入比较
- 搜索过滤、项目详情与横向比较抽屉
- 统一候选 `Candidate` 与来源连接器接口（`server/connectors/`，GitHub 是参考实现）
- 候选池与跨来源去重：canonical URL 归一化，同一项目的不同写法合并成一条
- 行为事件记录：view / like / save / star / compare / similar / skip / dismiss
- 第一版可解释兴趣评分：兴趣 / 价值 / 新颖 / 活跃 / 来源 / 探索 六个维度，卡片上给出中文推荐理由
- 多样性重排：同标签和同来源不会连续堆在一起
- 「我的兴趣」画像弹窗：看得到系统现在怎么看你，没有行为时它会直说还不够
- GitHub 公开用户名导入 Star、项目链接分析、相似项目搜索
- 可选 GitHub OAuth：读取自己的 Star，并同步一键 Star
- 可选 DeepSeek 中文分析：把英文项目资料改写成场景化中文卡片
- Telegram 个人账号 QR 登录基础链路（频道抓取将在提供频道后接入）

## 本地运行

```bash
npm install
npm run dev
```

这会同时启动前端（`http://127.0.0.1:5173`）和本地 API（`http://127.0.0.1:8787`）。只想启动前端可以运行 `npm run dev:web`，只想启动 API 可以运行 `npm run dev:api`。

> `vite.config.ts` 里显式设置了 `server.host: '127.0.0.1'`，不要删。Vite 默认只监听 `localhost`，在 Windows + 较新 Node 上会解析到 `::1`（仅 IPv6），导致 `127.0.0.1:5173` 打不开、GitHub OAuth 回调也会失败。

## 校验命令

```bash
npm run build   # 服务端类型检查 + 客户端构建 + 生产构建
npm run lint    # oxlint
npm run check   # 离线自检：候选池归一化/去重 + 兴趣画像与评分，不联网
npm run smoke   # 接口冒烟测试，需要一个已经跑起来的 API
```

`npm run smoke` 会真实抓取 GitHub 并真的写入行为事件，所以跑之前要把 API 的数据目录指到临时位置，否则测试数据会混进你自己的兴趣画像：

```powershell
$env:PORT='8799'; $env:OPENRADAR_DATA_DIR="$env:TEMP\openradar-smoke-data"; npm run start
# 另开一个终端
npm run smoke -- http://127.0.0.1:8799
```

## 推荐是怎么算的

不训练模型，只做可解释的行为评分。当前公式（权重合计 1.00）：

```text
总分 = 兴趣匹配 × 0.35 + 实用价值 × 0.20 + 新颖度 × 0.15
     + 最近活跃 × 0.10 + 来源可信度 × 0.10 + 探索奖励 × 0.10
```

事件权重：`star +5`、`save +4`、`like +3`、`compare / similar / open_source +2`、`view +1`、`skip -2`、`dismiss -4`。

两条硬规则：跳过过的项目降权但不隐藏，标记「不再推荐」的项目重罚但也仍然返回；连续不超过 2 张同标签或同来源的卡片。

细节和已知缺口见交接手册第 13 节。**分数不是事实**，所以界面上展示的是中文推荐理由，而不是分数本身。

## 数据与隐私

- `.env`、整个 `data/` 目录都在 `.gitignore` 里，不会被提交。
- `data/events.json` 记录你看过和跳过了什么，它只存在你自己的机器上，不会上传。
- GitHub 会话令牌用本地密钥（`data/session-secret`）以 AES-256-GCM 加密后保存。
- DeepSeek 只在服务端调用，浏览器不会接触 API Key；没有配置 Key 时全部功能仍可用规则结果。

## GitHub OAuth（可选）

复制 `.env.example` 为 `.env`，填写 GitHub OAuth App 的 Client ID 和 Client Secret。没有配置 OAuth 时，仍然可以在页面中输入公开 GitHub 用户名读取 Star。

连接成功后，会话令牌会使用本地密钥加密保存在 `data/sessions.json`，重启 API 不会立即掉线。

## DeepSeek 中文分析（可选）

在 `.env` 中填写 `DEEPSEEK_API_KEY`，默认使用 `deepseek-chat` 和 `https://api.deepseek.com`。页面导入 GitHub Star、丢入 GitHub 链接或找相似项目后，会先显示本地规则结果，再异步用 DeepSeek 补充中文标题、摘要、适合度和标签；没有 API Key 时仍可正常使用规则结果。

服务端接口：

- `GET /api/ai/config`：检查 DeepSeek 是否已配置；
- `POST /api/ai/enrich`：传入 `{ "tools": [...] }`，返回中文卡片补丁。

## Telegram 连接（外部阻塞中）

Telegram 桌面端的登录状态不能直接被网页读取。需要在 [my.telegram.org](https://my.telegram.org) 的 API development tools 创建个人 API，填写 `TELEGRAM_API_ID` 和 `TELEGRAM_API_HASH` 后，页面会用 QR 码让已登录的 Telegram 客户端确认一次。会话会加密保存到 `data/telegram-session.json`。

当前这个创建应用的页面只返回 `ERROR`，属于 Telegram 官方侧的问题，不是本项目代码问题。二维码登录的代码已经写好，等凭证可用后即可继续接入频道消息。
