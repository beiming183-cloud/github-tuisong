# OpenRadar Personal 多 AI 协同开发交接手册

> 文档版本：V0.2
>
> 编写时间：2026-09-28
>
> 当前项目状态：V0.4 前端原型 + GitHub 接入 + 统一候选池与连接器骨架 + DeepSeek 可选接入 + Telegram QR 登录骨架
>
> 项目目录：`D:\Codex\Projects\openradar-personal`
>
> 适用对象：后续接手本项目的 Codex、Claude、Cursor、ChatGPT 或其他 AI 开发代理，以及负责最终整合的主代理。

---

## 0. 给下一位 AI 的最短说明

OpenRadar Personal 不是一个 GitHub 热榜，也不是新闻聚合站。

它是一个面向个人的中文“新工具发现与研究助手”：从 GitHub、Telegram 资源频道、RSS、工具目录等来源找到新出现的、小而有用的项目，用直白的中文和视觉化卡片解释它们，按照用户的喜欢、收藏、跳过、查看详情、Star 等行为逐渐理解用户兴趣，并支持从一个项目继续找到相关项目、进行横向比较，最终形成一个可以不断刷、不断探索、但不杂乱的私人宝藏工具流。

当前最重要的用户感受是：

> “我不想先学会 GitHub，也不想看一堆新闻；我只想舒服地刷到一些可能真的有用、看得懂、值得试试的东西。”

当前主页面已经可以运行，但它仍然是一个单用户本地原型。真实的长期推荐、多个来源的统一抓取、Telegram 频道读取、持久化兴趣画像和正式部署都还没有完成。

---

## 1. 用户真正想做什么

### 1.1 用户背景

- 用户对“大而广”的新闻、技术资讯和 GitHub 原始界面兴趣不大。
- 用户喜欢偶然刷到的“小工具”“宝藏项目”“好用的 Skill”“MCP”“插件”“自动化工具”以及可以立即尝试的东西。
- 用户可以通过收藏、点赞、点 Star 或频道转发判断“这个东西看起来值得试”，但不希望自己阅读英文 README、搜索复杂仓库结构、理解 GitHub 术语。
- 用户目前不确定自己究竟长期喜欢哪个方向，因此系统不能一开始就要求用户填写几十个关键词，也不能把推荐范围锁死在 AI、Skill 或 GitHub 其中一个类别。
- 用户希望能够一直刷：前面是更像自己的，后面混入少量相邻方向，帮助兴趣慢慢长出来。

### 1.2 产品目标

1. **把复杂来源翻译成直白的中文工具卡片。**
2. **让用户不用理解 GitHub，也能判断一个项目是否值得试。**
3. **允许从一个项目继续发现相似、替代、互补项目。**
4. **提供真正有用的横向对比，而不是把 GitHub 字段搬成表格。**
5. **通过用户行为逐步形成个人兴趣画像。**
6. **来源可以逐渐变多，但界面不应该变杂。**
7. **AI 是分析和编排助手，不是推荐项目本身必须带 AI。**
8. **先做个人工具，再考虑分享、部署、多用户和自动推送。**

### 1.3 明确的非目标

- 不做泛科技新闻门户。
- 不做所有 GitHub Trending 的全量镜像。
- 不把项目名、语言、Issue、Commit 数等技术字段整页堆给用户。
- 不强迫用户一次性选择固定兴趣分类。
- 不在没有授权时读取用户全部 Telegram 聊天内容。
- 不使用共享的第三方 API Key 或硬编码的私人凭证。
- 不因为 DeepSeek 暂时不可用就让主流程无法使用。
- 不为了“看起来功能很多”而同时接入十几个不稳定来源。

---

## 2. 用户已经确认的产品方向

### 2.1 界面方向

用户选择了“频道编辑流”方向：

- 像一个高质量资源分享频道的精选页面，而不是后台管理系统。
- 一张卡片先讲“它能解决什么问题”，再给名称、来源和操作。
- 纯中文优先，英文只作为项目原名、技术名或来源标识。
- 视觉上有编辑感、留白、图片和明确层级。
- 可以连续向下刷，但每张卡片信息密度要受控。
- 颜色使用温暖纸张底色、珊瑚色、青绿色和深墨色；不要默认使用冷冰冰的纯 SaaS 蓝紫渐变。
- 项目图片优先使用真实 GitHub Open Graph 图；图片加载失败必须有有意义的文字/图标后备。

### 2.2 推荐方向

推荐流应当满足：

- “为你推荐”：根据已知行为排序。
- “探索”：扩大范围，允许出现用户还不熟悉的方向。
- “我的收藏”：只看用户留下的项目。
- 支持搜索工具名、场景或标签。
- 支持用户不断刷，不要求一次只给 3 个结果。
- 推荐理由必须可解释，例如“你最近收藏了本地运行和文件整理工具，所以先给你看这个”。
- 新颖度、实用性、与兴趣的相似度、项目活跃度要平衡，不要只按 Star 数排序。

### 2.3 研究方向

用户找到一个项目后，希望系统继续帮助他：

- 判断它到底是什么。
- 解释适合什么场景。
- 找到其他相关项目。
- 横向比较 2～3 个项目。
- 说明“如果想少折腾，先选哪个；如果想改装，选哪个”。

---

## 3. 当前完成情况总览

### 3.1 已完成

- [x] React + Vite 中文推荐流页面。
- [x] “为你推荐 / 探索 / 我的收藏”三种浏览状态。
- [x] 频道编辑流风格的 Hero、兴趣提示、搜索框和工具卡片。
- [x] Czkawka、LocalSend、Flowise、PowerToys 离线演示数据。
- [x] 工具卡片：喜欢、收藏、GitHub Star、加入比较、看详情、找相似、打开项目。
- [x] `localStorage` 保存喜欢、收藏、Star 状态。
- [x] 项目详情弹窗。
- [x] 2～3 个项目的横向比较弹窗。
- [x] GitHub 公开用户名读取 Star。
- [x] GitHub OAuth 登录，读取自己的 Star。
- [x] GitHub OAuth 会话加密保存、刷新 Token 支持、退出登录。
- [x] 手动输入 GitHub 项目链接并分析。
- [x] GitHub 相似项目搜索。
- [x] GitHub 探索接口，默认搜索最近 180 天有更新且 Star 大于 500 的项目。
- [x] GitHub 一键 Star / 取消 Star。
- [x] 服务端可选 DeepSeek 中文分析；没有 Key 时使用本地规则结果。
- [x] 统一来源登记表 `/api/sources`。
- [x] Telegram 个人账号 QR 登录基础骨架。
- [x] Telegram 会话本地加密保存和断开连接接口。
- [x] 移动端样式、焦点状态和基本键盘可访问性。
- [x] 统一候选 `Candidate` 与来源连接器接口 `SourceConnector`。
- [x] GitHub 连接器 `server/connectors/github.ts`；探索路由改为调用连接器，不再直接写抓取逻辑。
- [x] 候选池 `server/candidates.ts`：canonical URL 归一化 + 同批与跨批去重。
- [x] `GET /api/candidates` 查看候选池状态；`/api/sources` 附带连接器自检结果。
- [x] 卡片由候选反向渲染（`candidateToTool`），不再直接依赖原始 API 响应。
- [x] `npm run check` 自检：16 项 canonicalUrl / 去重 / 卡片往返用例。
- [x] Git 仓库与远端 `git@github.com:beiming183-cloud/github-tuisong.git`。
- [x] `npm run build` 通过。
- [x] `npm run lint` 通过。

### 3.2 已有但不完整

- [ ] `interestTags` 当前是静态标签，不是真正的行为画像。
- [ ] 推荐排序仍然主要依赖初始顺序和来源返回顺序；候选池已有数据，但还没有参与排序。
- [ ] 候选池只在内存里，API 进程重启即清空，尚未写入 SQLite。
- [ ] 去重目前是 URL 级，还没有做标题、描述、标签的语义合并。
- [ ] GitHub 的分类目前是关键词启发式，不是成熟的相关度模型。
- [ ] DeepSeek 只负责补中文卡片字段，没有缓存、成本统计、版本化和人工纠错。
- [x] `rss` 曾在来源登记表中虚标为 ready，已改为 coming_soon 并写明“目前还没有抓取代码”。
- [ ] Telegram 可以生成登录二维码的代码，但当前没有配置 Telegram API ID/API Hash，也没有频道消息抓取。
- [ ] 推荐流没有真正的数据库，刷新或换浏览器后行为画像不会跨设备同步。
- [ ] 暂无定时任务、后台抓取队列或自动推送。

### 3.3 尚未开始

- [ ] Telegram 频道/资源群配置页面。
- [ ] Telegram 公开频道消息读取、链接抽取、去重和卡片生成。
- [ ] RSS、Hacker News、Product Hunt 等来源连接器（接口已就绪，见第 12 节）。
- [ ] 内容规范化（标题、描述、标签的语义合并），现在只做了 URL 级去重。
- [ ] 无限滚动或分页式“继续刷”。
- [ ] 真实的喜欢/收藏/跳过事件记录和推荐重排。
- [ ] SQLite 或其他轻量持久化存储。
- [ ] 推荐解释、用户画像查看和可编辑偏好。
- [ ] Docker、云部署、自动化运行和通知推送。
- [ ] 图片、频道截图、帖子媒体的稳健提取。

---

## 4. 项目技术结构

### 4.1 当前运行架构

```text
浏览器（React + Vite，5173）
        │
        │ /api 由 Vite 代理
        ▼
本地 Express API（8787）
        ├── GitHub REST API
        ├── DeepSeek Chat Completions（可选）
        ├── GramJS / Telegram MTProto（配置后可用）
        └── 本地加密文件 data/
```

### 4.2 目录说明

```text
openradar-personal/
├── .env                         # 本地私密配置，不提交
├── .env.example                 # 环境变量模板
├── .gitignore                   # 保护密钥、会话和构建目录
├── .gitattributes               # 统一 LF 行尾，二进制文件不做文本转换
├── .oxlintrc.json               # oxlint 规则配置
├── index.html
├── package.json
├── package-lock.json
├── README.md
├── vite.config.ts               # Vite + /api 代理到 8787
├── tsconfig*.json
├── public/
├── src/
│   ├── main.tsx                 # React 入口
│   ├── App.tsx                  # 主页面、状态和主要交互
│   ├── App.css                  # 页面与组件样式
│   ├── index.css                # 全局基础样式
│   ├── types.ts                 # Tool、Source、GitHub、Telegram 类型
│   ├── data/
│   │   └── sampleTools.ts       # 离线演示工具卡片
│   ├── lib/
│   │   └── api.ts               # 浏览器端 API 封装
│   └── components/
│       ├── Dialogs.tsx          # GitHub 连接、丢链接弹窗
│       ├── ResearchDialogs.tsx  # 详情和横向比较
│       └── TelegramDialog.tsx   # Telegram 配置与二维码登录
├── server/
│   ├── index.ts                 # Express 服务、路由、会话；抓取逻辑已外移
│   ├── ai.ts                    # DeepSeek 配置和中文卡片补全
│   ├── telegram.ts              # GramJS QR 登录和加密会话
│   ├── sources.ts               # 来源登记表（用户可见状态）
│   ├── candidates.ts            # 候选池：canonicalUrl 归一化与跨来源去重
│   ├── check-connectors.ts      # npm run check 的本地自检用例
│   └── connectors/
│       ├── types.ts             # Candidate / SourceConnector / ToolCard 接口
│       ├── github.ts            # GitHub 连接器（第一个参考实现）
│       └── index.ts             # 连接器注册表与自检汇总
├── data/                        # 运行时私密数据，不提交
│   ├── session-secret
│   ├── sessions.json
│   └── telegram-session.json
├── docs/
│   └── AI-交接手册.md            # 本文档
└── dist/                        # 构建产物，不提交
```

### 4.3 Git 仓库与协作基线

仓库已经建好。远端是 `git@github.com:beiming183-cloud/github-tuisong.git`，主分支 `main`，已配置 upstream。

```text
本地仓库：D:\Codex\Projects\openradar-personal
远端    ：git@github.com:beiming183-cloud/github-tuisong.git（SSH）
分支    ：main（从初始快照 fc5fa76 开始）
提交身份：beiming / beiming183@gmail.com
```

已逐条验证的安全边界：

- `.env`、`data/session-secret`、`data/sessions.json`、`data/telegram-session.json`、`node_modules`、`dist`、`.playwright-cli` 均被 `.gitignore` 忽略（用 `git check-ignore -v` 核对过）。
- 初始提交做过内容级密钥扫描：把 `.env` 里的非空配置值逐个比对全部暂存文件，命中的只有 `127.0.0.1` 本地地址。**新增文件后要重复这件事**，不要只看文件名。
- `.gitattributes` 锁定 `* text=auto eol=lf`，避免不同工具产生整文件换行差异。

每个子任务的流程：

```text
第一步：git pull --ff-only，确认基线干净
第二步：每个子任务使用独立分支或至少独立提交
第三步：提交前运行 npm run build、npm run lint、npm run check
第四步：主代理逐个审阅并合并
```

仍然不要让多个 AI 同时重写同一个大文件；尤其不要让两个代理同时修改 `src/App.tsx` 或 `server/index.ts`。

---

## 5. 本地运行和验证

### 5.1 安装依赖

在 PowerShell 中：

```powershell
Set-Location D:\Codex\Projects\openradar-personal
npm install
```

### 5.2 启动开发环境

同时启动前端和 API：

```powershell
npm run dev
```

只启动前端：

```powershell
npm run dev:web
```

只启动 API：

```powershell
npm run dev:api
```

默认地址：

- 前端：`http://127.0.0.1:5173/`
- API：`http://127.0.0.1:8787/`
- 健康检查：`http://127.0.0.1:8787/api/health`

### 5.3 构建和静态检查

每次重要修改后运行：

```powershell
npm run build
npm run lint
```

`npm run build` 包含服务端 TypeScript 检查、客户端 TypeScript 构建和 Vite 生产构建。

`npm run check` 运行 `server/check-connectors.ts` 的本地自检，覆盖 canonicalUrl 归一化、候选池同批与跨批去重、候选到卡片的往返渲染。它不联网、不读 `.env`、不接触密钥，改动连接器或去重逻辑后必须运行。

### 5.4 手动验证清单

- [ ] 页面可以打开，没有白屏。
- [ ] 推荐页能显示 4 张初始卡片。
- [ ] 搜索工具名、场景和标签能过滤结果。
- [ ] 喜欢、收藏、Star 状态能切换，刷新后本地状态保留。
- [ ] 点击“看详情”能打开详情弹窗。
- [ ] 加入至少两个项目后，比较台能打开横向比较。
- [ ] “探索”能请求 `/api/discover/github` 并追加 GitHub 项目。
- [ ] 输入 GitHub 链接能分析并加入推荐流。
- [ ] GitHub 登录状态能正确显示；未登录时 Star 操作给出中文提示。
- [ ] DeepSeek 没有 Key 时，页面仍能使用本地中文规则结果。
- [ ] 探索成功后，提示里出现“其中 N 个是第一次看到”，是中文而不是技术错误原文。
- [ ] 再点一次探索，提示里出现“N 个之前已经出现过”。
- [ ] Telegram 未配置时，弹窗清楚说明下一步，不显示错误二维码。
- [ ] 图片加载失败时有项目名称和图标后备。
- [ ] 移动端宽度下按钮和比较台不溢出。
- [ ] 浏览器 Console 没有应用错误。

### 5.5 当前已知验证结果

最近一次（统一候选池与连接器落地后）在本机实测：

- `npm run build`：通过。
- `npm run lint`：通过（0 warning / 0 error，18 个文件）。
- `npm run check`：16 项用例全部通过。
- `/api/health`：`{"ok":true,"service":"openradar-api"}`。
- `/api/sources`：返回 7 条来源描述，并附带 `connectors` 自检结果（`github-discovery: ready`）。
- `/api/candidates`：空池时返回 `{"stats":{"size":0,...},"items":[]}`。
- `/api/discover/github`：返回 24 个项目，`pool.size=24, added=24, duplicates=0`；同参数再请求一次为 `added=0, duplicates=24`；换成 `q=stars:>20000` 为 `added=20, duplicates=4`。
- 手动丢链接：`https://github.com/qarmin/czkawka/tree/master` 与 `https://www.github.com/Qarmin/Czkawka.git` 归一化为同一条候选，第二次为 `added=0, duplicates=1`。
- Telegram 当前 `/api/telegram/config`：`configured: false`，因为尚未成功获得 API ID/API Hash。
- DeepSeek 当前未配置 Key，规则结果可用。

**尚未完成**：浏览器手动验证。本轮改动只做了接口级冒烟测试，还没有在浏览器里点过“探索”，下一位接手时请补上。

---

## 6. 环境变量和密钥规则

### 6.1 `.env` 配置项

`.env.example` 是模板；真正的 `.env` 只保留在本机。

```env
# GitHub OAuth，可选，但启用后可以读取自己的 Star 并一键同步 Star
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://127.0.0.1:8787/api/auth/github/callback

# 本地服务
APP_URL=http://127.0.0.1:5173
PORT=8787

# 会话加密密钥；为空时自动生成 data/session-secret
SESSION_SECRET=

# DeepSeek，可选
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Telegram 用户 API；需要从 my.telegram.org 获得
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
```

### 6.2 当前配置状态（不要写出真实值）

- GitHub OAuth：当前 `.env` 已配置，用户之前已经成功连接过 GitHub。
- DeepSeek：当前没有配置 API Key，默认模型为 `deepseek-chat`。
- Telegram：当前没有配置 `TELEGRAM_API_ID` 和 `TELEGRAM_API_HASH`。
- `SESSION_SECRET`：如果为空，服务端会在 `data/session-secret` 自动生成本地密钥。

### 6.3 密钥和会话安全规则

- 不要在聊天、Issue、截图、日志或交接文本中写出真实的 API Key、API Hash、OAuth Secret、Session String。
- 不要读取 `.env` 后把完整内容输出给用户或其他代理。
- 不要提交以下文件：
  - `.env`
  - `data/session-secret`
  - `data/sessions.json`
  - `data/telegram-session.json`
  - 它们的 `.tmp` 文件
- 修改 `.env` 后必须重启 API 服务，因为 `server/ai.ts` 和 `server/telegram.ts` 在模块加载时读取环境变量。
- 不能为了测试把真实凭证写进源代码、README 或截图。

### 6.4 DeepSeek 的官方参考

- API 文档：[https://api-docs.deepseek.com/api/create-chat-completion/](https://api-docs.deepseek.com/api/create-chat-completion/)
- JSON 模式：[https://api-docs.deepseek.com/guides/json_mode/](https://api-docs.deepseek.com/guides/json_mode/)

---

## 7. 前端现状和状态模型

### 7.1 `src/App.tsx` 的核心状态

当前主组件保存：

- `tab`：`recommend | explore | saved`
- `query`：搜索词
- `tools`：当前所有卡片，初始值来自 `sampleTools`
- `saved`：收藏项目 ID
- `liked`：喜欢项目 ID
- `starred`：GitHub Star 项目 ID
- `compare`：比较台项目 ID，最多 3 个
- `notice`：右下角/页面提示
- `config`：GitHub 状态
- `aiConfigured`：DeepSeek 是否配置
- `telegramStatus`：Telegram 配置和连接状态
- `telegramOpen`：Telegram 弹窗是否打开
- `dialog`：GitHub 连接或手动链接弹窗
- `detailTool`：当前详情项目
- `compareOpen`：比较弹窗是否打开
- `busy`：共享的加载状态
- `interestTags`：目前是静态兴趣标签

### 7.2 localStorage 键

```text
openradar_saved
openradar_liked
openradar_starred
```

当前只保存项目 ID 数组，不保存行为时间、来源、权重和用户画像。后续做推荐系统时，应保留兼容旧数组的迁移逻辑，不要直接破坏已有用户数据。

### 7.3 `Tool` 数据结构

```ts
type Tool = {
  id: string
  name: string
  eyebrow: string
  title: string
  summary: string
  why: string
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
}
```

任何新来源都应该尽量先转换成这个结构，避免组件分别理解 GitHub、Telegram、RSS 的字段。

### 7.4 当前卡片行为

- 主卡片显示大图、场景化标题、摘要、“为什么给你看”、标签和操作。
- 侧边卡片显示图片、标题、摘要、难度、价值、标签和操作。
- 详情弹窗显示场景、摘要、推荐理由、上手难度、使用价值、项目属性、标签和操作。
- 比较弹窗当前比较：一句话理解、适合场景、上手难度、价值判断、项目属性。
- 当前比较结论只是优先选择“上手低”的项目，不是 AI 结论。

### 7.5 前端扩展注意事项

- 不要把所有新字段直接塞进卡片；先判断用户是否真的需要。
- 任何新的操作都要有中文反馈。
- 加载、空结果、错误、未配置和已连接状态都必须有可理解的文案。
- 不要用技术错误原文直接展示给用户。
- 不要让单个外部来源失败导致主页面白屏。
- `busy` 目前是全局共享状态；以后如果同时加载探索和 AI，建议拆成 `loadingSource`、`loadingAi`、`loadingAction`。

---

## 8. 服务端 API 现状

所有服务端路由都在 `server/index.ts` 注册，前端通过 `src/lib/api.ts` 调用。

### 8.1 基础和来源

#### `GET /api/health`

返回：

```json
{ "ok": true, "service": "openradar-api" }
```

#### `GET /api/sources`

返回 `{ sources, connectors }`。`sources` 是用户可见的来源登记表，`connectors` 是连接器自检结果，用来对账“登记为可用但实际没有代码”的情况。目前包括：

| id | 来源 | 当前状态 | 说明 |
|---|---|---|---|
| `github-stars` | 我的 GitHub Star | ready | 已实现 |
| `github-discovery` | GitHub 新项目 | ready | 已实现 |
| `rss` | RSS / 网站 | coming_soon | 接口已就绪但没有抓取代码，已从虚标的 ready 改正 |
| `hacker-news` | Hacker News | coming_soon | 尚未实现 |
| `product-hunt` | Product Hunt | needs_config | 需要 API 配置 |
| `telegram` | 纸飞机频道 / 资源群 | needs_config | QR 连接骨架，频道抓取未实现 |
| `manual` | 我丢一个链接 | ready | GitHub 链接已实现 |

#### `GET /api/candidates?limit=<1-100>`

查看候选池状态，只返回地址和计数，不返回任何凭证：

```json
{
  "stats": { "size": 44, "bySource": { "github-discovery": 44 }, "multiSource": 0 },
  "items": [
    {
      "canonicalUrl": "https://github.com/owner/repo",
      "title": "repo",
      "sourceKind": "github",
      "sourceIds": ["github-discovery", "github-stars"],
      "seenCount": 3,
      "firstSeenAt": "2026-09-28T00:00:00.000Z",
      "lastSeenAt": "2026-09-28T00:00:00.000Z"
    }
  ]
}
```

### 8.2 AI

#### `GET /api/ai/config`

返回：

```json
{
  "provider": "deepseek",
  "configured": false,
  "model": "deepseek-chat"
}
```

#### `POST /api/ai/enrich`

请求体：

```json
{
  "tools": [
    {
      "id": "github-123",
      "name": "Example",
      "eyebrow": "TypeScript · 1000 Star",
      "summary": "原始说明",
      "tags": ["AI 工具"],
      "source": "https://github.com/owner/repo",
      "repository": {
        "fullName": "owner/repo",
        "stars": 1000,
        "language": "TypeScript",
        "topics": ["ai"]
      }
    }
  ]
}
```

服务端最多处理 8 个项目。DeepSeek 返回以下补丁字段：

```text
id, title, summary, why, tags, fit, difficulty, value
```

没有 Key 时返回 `configured: false, patches: []`，前端继续使用本地规则结果。

### 8.3 GitHub

#### `GET /api/github/config`

返回：

```json
{
  "oauthConfigured": true,
  "connected": true,
  "user": {
    "login": "...",
    "name": "...",
    "avatar_url": "..."
  }
}
```

#### `GET /api/github/stars?username=<username>`

- 不需要 OAuth。
- 读取公开用户的最近 30 个 Star。
- 过滤 archived 和 fork。
- 用 `repoToTool` 转换为中文卡片。

#### `GET /api/github/me/stars`

- 需要 GitHub OAuth 会话。
- 读取当前用户最近 30 个 Star。
- 未连接返回 401。

#### `POST /api/github/repository`

请求体：

```json
{ "url": "https://github.com/owner/repo" }
```

只接受 `github.com` 或 `www.github.com` 的仓库链接。

#### `GET /api/github/similar?owner=<owner>&repo=<repo>`

- 先读取源仓库。
- 优先使用第一个 topic 和编程语言构建搜索条件。
- 默认要求 `stars:>100`。
- 最多返回 8 个非 archived、非 fork 项目。

#### `GET /api/discover/github?q=<可选查询>`

- 路由现在只负责鉴权、限流和把结果送进候选池；抓取逻辑在 `server/connectors/github.ts`。
- 没有 `q` 时默认：`stars:>500 pushed:>180天前`。
- 按 updated 排序，最多 24 个。
- 过滤 archived 和 fork。
- 返回 `{ source, query, tools, pool: { size, added, duplicates } }`。
- 卡片由候选反向渲染（`candidateToTool`），不是直接使用原始 API 对象。这条是后续接入非 GitHub 来源的前提。

#### `PUT /api/github/star/:owner/:repo`

- 需要 OAuth。
- 调用 GitHub `/user/starred/:owner/:repo`。

#### `DELETE /api/github/star/:owner/:repo`

- 需要 OAuth。
- 取消当前用户的 Star。

#### `GET /api/auth/github/start`

- OAuth 已配置时开始授权。
- Scope：`read:user public_repo offline_access`。
- 使用 `openradar_oauth_state` Cookie 防 CSRF。

#### `GET /api/auth/github/callback`

- 校验 code、state 和有效期。
- 保存访问 Token、刷新 Token、用户信息和过期时间。
- 将会话 ID 写入 `openradar_session` Cookie。
- 最后重定向到 `APP_URL/?github=connected`。

#### `POST /api/auth/logout`

- 删除本地服务端会话。
- 清理 Cookie。

### 8.4 Telegram

#### `GET /api/telegram/config`

返回：

```json
{
  "configured": false,
  "connected": false,
  "user": null,
  "loggingIn": false
}
```

#### `POST /api/telegram/login/start`

- 要求配置 `TELEGRAM_API_ID` 和 `TELEGRAM_API_HASH`。
- 创建 GramJS 客户端。
- 使用 QR Login 生成 `tg://login?token=...`。
- 生成二维码 Data URL 返回前端。
- 登录完成后把 GramJS StringSession 加密写入 `data/telegram-session.json`。

#### `GET /api/telegram/login/:id`

- 前端每约 1.8 秒轮询。
- 状态：`waiting | connected | error`。
- 二维码过期后需要重新生成。

#### `POST /api/telegram/logout`

- 断开活动客户端。
- 清除内存状态和加密会话文件。

### 8.5 API 错误约定

服务端错误处理中会返回：

```json
{ "error": "面向用户的中文错误信息" }
```

新增接口时保持这个格式。外部 API 的英文错误只写到服务端日志或映射成中文，不要原样暴露给用户。

---

## 9. GitHub 集成细节

### 9.1 GitHub 会话

- 会话 ID 放在 `openradar_session` Cookie。
- 会话数据由 `AES-256-GCM` 加密后保存到 `data/sessions.json`。
- `SESSION_SECRET` 有值时使用它；为空时使用/创建 `data/session-secret`。
- 会话默认保留 30 天。
- GitHub OAuth 的 access token 支持使用 refresh token 刷新。

### 9.2 GitHub 卡片生成

`repoToTool` 的当前流程：

1. 读取项目名、描述、语言、topics。
2. 用关键词分类到以下场景之一：
   - AI 工具与自动化
   - 文件整理与传输
   - 桌面效率
   - 本地与隐私
   - 浏览器增强
   - 开发与连接
   - 开源新工具（兜底）
3. 生成中文标题、摘要、理由、标签和价值。
4. 根据最近更新时间判断“值得现在看看 / 口碑项目 / 探索性推荐”。
5. 使用 GitHub Open Graph URL 作为图片。

### 9.3 后续改进建议

- 先把 GitHub 搜索结果统一成 `Candidate`，再进入评分和 AI 层。
- 不要只用 Star 数；加入近期 Star 增长、最近提交、Issue 活跃、README 语言、安装复杂度等信号。
- 过滤明显的框架底层库、课程仓库、重复 fork 和无实际可用性的模板。
- 给每个推荐保留 `reasonCodes`，方便解释“为什么出现”。
- 对同一项目做 24 小时或 7 天缓存，避免重复访问 GitHub API。
- 处理 GitHub API 速率限制，页面要显示“暂时没拿到更多结果”，而不是白屏。

---

## 10. DeepSeek 集成细节

### 10.1 设计原则

- DeepSeek 只在服务端调用，浏览器永远不接触 API Key。
- 先用规则快速出卡片，再异步用 DeepSeek 改写中文字段。
- DeepSeek 失败时保留规则结果，不能让用户等待到空白。
- AI 生成的是“理解辅助”，不能凭空发明项目功能。
- Prompt 要强调：不是写新闻，而是把项目解释成普通人能快速判断的中文工具卡片。

### 10.2 当前 Prompt 约束

DeepSeek 必须返回 JSON 对象：

```json
{
  "tools": [
    {
      "id": "原 id",
      "title": "一句场景化中文标题",
      "summary": "一句直白的中文说明",
      "why": "为什么可能适合这个用户",
      "tags": ["三个中文标签"],
      "fit": "很适合试试",
      "difficulty": "上手低",
      "value": "日常价值高"
    }
  ]
}
```

### 10.3 后续必须补的能力

- Prompt 版本号。
- 输入项目字段和输出字段校验。
- 空字段、非法 JSON、重复 ID 的容错。
- 项目卡片缓存。
- 单次调用 token 和费用记录。
- 失败重试次数上限。
- 用户反馈修正：用户点“不像我”后不要直接把 AI 文案当事实。
- 允许用户选择“直白 / 技术 / 简短”解释风格。

---

## 11. Telegram 当前状态、暂停原因和恢复方案

### 11.1 已实现的代码

`server/telegram.ts` 已实现：

- GramJS `TelegramClient`。
- Telegram API ID/API Hash 环境变量读取。
- 本地 AES-256-GCM 加密 StringSession。
- QR 登录开始、状态轮询、断开连接。
- Windows 下使用 `fileURLToPath(import.meta.url)` 处理路径。
- 连接成功后读取当前用户基本信息。

`src/components/TelegramDialog.tsx` 已实现：

- 未配置时显示去 `my.telegram.org` 的说明。
- 已配置时显示“生成登录二维码”。
- 显示二维码、过期提示和 Telegram 扫码路径。
- 显示已连接账号。
- 支持断开连接。

### 11.2 当前为什么暂停

用户在 `my.telegram.org` 创建应用时遇到了只显示 `ERROR` 的问题，尚未获得 `api_id` 和 `api_hash`。这不是 OpenRadar 代码层的连接错误，而是 Telegram 官方创建应用页面的外部阻塞。

Telegram 官方文档说明需要在 API development tools 获得 API ID 和 API Hash，而且一个手机号目前只能绑定一个 API ID：

- [Telegram 创建应用官方说明](https://core.telegram.org/api/obtaining_api_id)
- [Telegram QR Login 官方说明](https://core.telegram.org/api/qr-login)
- [Telegram 官方问题记录：创建应用只返回 ERROR](https://bugs.telegram.org/c/61030)

当前不要：

- 把桌面端登录文件直接复制给网页。
- 使用网上公开的共享 API ID/API Hash。
- 把个人 Telegram Session String 发给任何聊天。
- 在没有明确频道范围和用户授权时读取全部聊天。

### 11.3 恢复步骤

1. 用户在 `my.telegram.org` 成功获得 API ID/API Hash。
2. 写入本地 `.env`：

   ```env
   TELEGRAM_API_ID=数字
   TELEGRAM_API_HASH=字符串
   ```

3. 重启 API 服务。
4. 打开页面，点击“连接纸飞机”。
5. 生成二维码。
6. 在已登录的 Telegram 桌面端选择“设置 → 设备 → 连接桌面设备”扫码。
7. 确认页面显示已连接账号。
8. 让用户提供要接入的频道链接或用户名，再实现频道接入。

### 11.4 Telegram 频道接入的下一步设计

建议不要一上来抓全量频道。先设计一个“我的来源”配置：

```text
来源名称
频道链接或用户名
启用 / 暂停
是否只读取新消息
是否允许媒体图片作为卡片图片
关键词排除
最后抓取时间
```

建议只接入公开频道或用户明确授权的群组，第一版只读取文本和公开链接：

1. 解析频道用户名/链接。
2. 使用 GramJS 获取最近 N 条消息。
3. 提取 GitHub、工具官网、Product Hunt 等 URL。
4. 用 canonical URL 去重。
5. 记录原始来源频道、消息 ID、发布时间。
6. 将链接转换为统一 `Candidate`。
7. 调用 GitHub/网页元数据抓取。
8. 用 DeepSeek 生成中文卡片。
9. 放入候选池，而不是直接覆盖推荐流。

建议的数据字段：

```ts
type SourceMessage = {
  sourceId: string
  channelId: string
  channelTitle: string
  messageId: string
  messageUrl?: string
  text: string
  publishedAt: string
  extractedUrls: string[]
}
```

---

## 12. 来源连接器的统一接口（已落地）

GitHub 是第一个参考实现，接口已经真实存在于 `server/connectors/types.ts`，不再是“未来建议”。后续来源不要继续把逻辑堆到 `server/index.ts`，照着 `github.ts` 的形状写：

```text
server/connectors/
├── types.ts            # 已存在：Candidate / SourceConnector / ToolCard
├── index.ts            # 已存在：连接器注册表与自检汇总
├── github.ts           # 已存在：参考实现
├── telegram.ts         # 待建
├── rss.ts              # 待建
├── hackerNews.ts       # 待建
└── productHunt.ts      # 待建
```

实际接口：

```ts
export type Candidate = {
  canonicalUrl: string          // 归一化后作为唯一去重键
  sourceItemId?: string         // 来源内稳定 ID，例如 github-12345
  title?: string
  description?: string
  sourceKind: SourceKind
  sourceId: string              // 对应 server/sources.ts 里的来源 id
  sourceLabel: string
  sourcePublishedAt?: string
  rawText?: string
  metadata?: Record<string, unknown>   // 来源专属字段，GitHub 的约定见 github.ts
}

export interface SourceConnector {
  id: string
  label: string
  kind: SourceKind
  checkConfig(): Promise<{ ready: boolean; message?: string }>
  fetchCandidates(input: {
    cursor?: string
    limit: number
    query?: string
    auth?: { token?: string }
  }): Promise<{ candidates: Candidate[]; nextCursor?: string }>
}
```

与最初设计稿的两处不同，都是有意为之：

1. `fetchCandidates` 增加了 `auth`。连接器不读 Cookie、不读 `.env`，鉴权 Token 由 `server/index.ts` 从加密会话解析后注入。好处是连接器可以被自检脚本直接调用，不需要登录态。
2. `Candidate` 增加了 `sourceItemId`。去重靠 `canonicalUrl`，但回查原始记录需要一个来源内的稳定 ID。

**URL 归一化不由连接器负责**：连接器返回原始 `canonicalUrl`，由 `server/candidates.ts` 的 `canonicalizeUrl` 统一归一化。这样所有来源共享同一套去重规则，而不是各写一份。新增连接器时不要自己归一化 URL。

推荐流水线（✅ 已实现，⬜ 未实现）：

```text
✅ 来源连接器            server/connectors/*
✅ 原始候选 Candidate     connector.fetchCandidates()
✅ URL 规范化            server/candidates.ts: canonicalizeUrl
✅ 跨来源去重            server/candidates.ts: upsertCandidates
✅ 规则过滤              isUsableRepo（archived / fork）
✅ 推荐卡片              connectors/github.ts: candidateToTool
⬜ 基础元数据抓取        非 GitHub 来源的网页元数据
⬜ AI 中文解释           现有 DeepSeek 补全还没有接进候选池
⬜ 兴趣匹配评分          需要先有行为事件
⬜ 多样性重排            需要先有评分
⬜ 持久化                候选池现在在内存里，重启即清空
```

注意：连接器只负责“找到东西”，不要在连接器里写 UI 文案和推荐排序。

改动连接器或去重逻辑后必须运行 `npm run check`；`server/check-connectors.ts` 里已经有 canonicalUrl 和去重的回归用例，新增来源时请补用例。

---

## 13. 推荐系统后续设计

### 13.1 现阶段不急着上复杂模型

用户目前还不确定自己喜欢什么，最适合先做“可解释的行为评分”，再积累数据。不要一开始训练模型，也不要把用户锁死在标签上。

### 13.2 建议记录的行为

```ts
type UserEvent = {
  id: string
  toolId: string
  event: 'view' | 'open_source' | 'like' | 'save' | 'star' | 'compare' | 'similar' | 'skip' | 'dismiss'
  sourceKind?: Tool['sourceKind']
  tags?: string[]
  occurredAt: string
}
```

初始权重可以是：

```text
star       +5
save       +4
like       +3
compare    +2
view       +1
open_source+2
skip       -2
dismiss    -4
```

权重只是起点，不要当作永久规则。后续应根据用户实际行为调整。

### 13.3 候选排序公式（第一版）

可以先使用：

```text
总分 = 兴趣匹配 × 0.35
     + 实用价值 × 0.20
     + 新颖度 × 0.15
     + 最近活跃 × 0.10
     + 来源可信度 × 0.10
     + 探索奖励 × 0.10
```

还要加入两个硬规则：

- 连续 3 张卡片不能是同一个来源或同一个标签。
- 已经明确跳过的项目和重复项目降权，但不能永久隐藏，除非用户选择“不再推荐”。

### 13.4 兴趣画像不要只存标签

建议存：

- 主题偏好：AI、桌面工具、自动化、文件、浏览器、隐私等。
- 使用方式偏好：能马上用、愿意折腾、愿意自部署、喜欢可视化。
- 形态偏好：桌面软件、网页、浏览器插件、CLI、Skill、MCP、库。
- 来源偏好：GitHub、Telegram、RSS、某个具体频道。
- 解释风格偏好：简短、直白、技术细节多。
- 负向信号：太复杂、太像新闻、需要注册、只适合开发者等。

---

## 14. 横向比较的后续设计

当前比较弹窗已经能展示基础表格，但以后要更贴近用户选择：

建议比较维度：

- 它到底解决什么问题。
- 最适合的使用场景。
- Windows / macOS / Web / 手机支持情况。
- 是否需要账号或云服务。
- 是否本地运行。
- 上手难度。
- 初次安装成本。
- 是否适合小白直接使用。
- 是否适合二次改装。
- 社区活跃度和最近更新。
- 开源协议和是否可以商用。
- 主要优点。
- 主要限制。
- 最适合谁。

最终结论要用自然中文，例如：

```text
如果你想今天就用，选 LocalSend。
如果你想自己改造，选 Flowise。
如果你最在意隐私，选本地运行的方案。
```

比较结论可以由规则先出，DeepSeek 再补解释，但必须保留事实来源。

---

## 15. 多 AI 协同开发方法

### 15.1 总原则

多 AI 不是把所有代理同时丢进同一份代码里，而是把工作拆成边界清晰、可以独立验证的任务，最后由一个主代理整合。

### 15.2 建议角色

#### A. 产品和信息架构代理

负责：

- 明确用户场景。
- 设计来源、候选、工具卡片和事件数据结构。
- 写验收标准。
- 维护本交接手册和决策记录。

不负责：

- 大范围重写 UI。
- 随意新增来源。
- 修改密钥和会话。

#### B. 来源和后端代理

负责：

- GitHub、Telegram、RSS、Hacker News、Product Hunt 连接器。
- 外部 API 速率限制、缓存、重试和错误映射。
- Candidate 规范化和去重。
- 数据持久化。

不负责：

- 修改视觉规范。
- 直接把外部字段塞到 React 卡片。

#### C. 前端和交互代理

负责：

- 推荐流、筛选、详情、比较、来源管理页面。
- 加载、空态、错误、未配置和移动端适配。
- 连接器结果的中文呈现。

不负责：

- 把 API Key 放进前端。
- 在浏览器直接调用 Telegram 或 DeepSeek 私密接口。

#### D. AI 分析代理

负责：

- DeepSeek Prompt、结构化输出、字段校验。
- 项目摘要、推荐理由、相似度解释、比较结论。
- 成本、缓存、失败降级和提示词版本。

不负责：

- 直接决定所有排序。
- 编造项目功能。

#### E. QA 和集成代理

负责：

- 运行 build、lint、API 冒烟测试。
- 浏览器手动检查。
- 检查响应式布局和 Console 错误。
- 审查是否泄露密钥。

#### F. 主整合代理

负责：

- 维护唯一的主实现方向。
- 处理冲突和合并。
- 在合并前检查任务是否符合用户真实目标。
- 对用户汇报当前可用性和阻塞点。

### 15.3 文件所有权建议

同一时间不要让多个代理修改同一个文件。建议分工：

| 文件/目录 | 默认负责人 |
|---|---|
| `src/App.tsx` | 前端主代理 |
| `src/App.css` | 前端/视觉代理 |
| `src/components/` | 前端代理，可按组件拆分 |
| `src/types.ts` | 产品/后端共同审阅，主代理合并 |
| `src/lib/api.ts` | 前端 + 后端接口代理 |
| `server/index.ts` | 后端主代理 |
| `server/connectors/` | 来源代理 |
| `server/ai.ts` | AI 代理 |
| `server/telegram.ts` | Telegram 专项代理 |
| `server/sources.ts` | 产品/来源代理 |
| `docs/` | 产品代理/主整合代理 |

### 15.4 每个子代理必须收到的上下文

给子代理任务时至少包含：

```text
项目目标：OpenRadar Personal 是个人中文新工具发现与研究助手，不是新闻站。
当前目录：D:\Codex\Projects\openradar-personal
相关文件：明确列出，不要让代理盲目扫描整个项目。
任务范围：只做什么。
不做什么：明确禁止越界。
现有接口：列出请求和响应结构。
验收标准：可以怎样验证完成。
安全限制：不要读取/打印/修改真实密钥。
完成后报告：改了哪些文件、运行了什么检查、还有什么风险。
```

### 15.5 子代理任务模板

```text
你是 OpenRadar Personal 的 [角色]。

背景：这是一个个人中文工具发现与研究助手。用户不喜欢杂乱的 GitHub 和泛新闻，希望像宝藏工具频道一样刷到能看懂、可能有用的项目。

本次任务：
- [任务 1]
- [任务 2]

允许修改：
- [文件列表]

禁止修改：
- [文件列表]
- 不要改环境变量和密钥。

现有接口/类型：
- [接口说明]

验收条件：
- [条件 1]
- [条件 2]

完成后请报告：
1. 修改了哪些文件；
2. 采用了什么方案；
3. 运行了哪些检查及结果；
4. 未完成或需要主代理注意的地方。
```

### 15.6 主代理合并流程

```text
1. 先读本交接手册和相关源文件。
2. 让子代理只负责一个边界明确的任务。
3. 子代理完成后，先看 diff，再运行 build/lint。
4. 检查是否改变了用户体验、API 契约或安全边界。
5. 运行 API 冒烟测试。
6. 用浏览器检查关键流程。
7. 更新本手册的“当前完成情况”和“决策记录”。
8. 再把下一个任务交给其他代理。
```

### 15.7 并行开发的冲突规避

- 后端代理只新增 `server/connectors/*` 时，可以和前端代理并行。
- 修改 `src/types.ts` 前必须通知使用该类型的代理。
- 修改 `server/index.ts` 路由前必须先记录接口契约。
- 不要同时让两个代理重写 `App.tsx`。
- 不要让一个代理为了方便顺手改掉另一个代理负责的 CSS 或 Prompt。
- 每个代理都必须使用 `apply_patch` 进行可审阅修改。
- 不要使用 `git reset --hard`、覆盖整个目录或删除未知文件。

---

## 16. 建议的后续开发优先级

### P0：先把推荐系统从“演示”变成“可持续使用”

1. [x] 建立 `Candidate` 和统一来源连接器接口。（2026-09-28 完成）
2. [x] 把 GitHub 结果纳入候选池，而不是直接覆盖 `tools`。（2026-09-28 完成，池在内存里）
3. [ ] 增加 `view / like / save / skip / compare` 行为事件。
4. [ ] 做第一版可解释的兴趣评分。
5. [ ] 让候选池真正参与去重与推荐多样性（现在的去重只影响统计和提示，不影响排序）。
6. [ ] 让“继续刷”能够加载下一批结果，并把候选池从内存换成 SQLite。

### P1：把信息源做成真正可扩展的系统

1. RSS 通用连接器。
2. Telegram 频道连接器（在 API 凭证可用后）。
3. Hacker News 连接器。
4. Product Hunt 配置页和 API 适配。
5. 来源启用/暂停和来源权重。

### P1：提升研究能力

1. 相关项目图谱。
2. 替代项目和互补项目分类。
3. 事实字段与 AI 解释分离。
4. 真实的优缺点对比。
5. 记录“我已经试过 / 我暂时不想看 / 以后提醒我”。

### P2：持久化和自动化

1. SQLite 保存用户、来源、候选、事件和 AI 缓存。
2. 定时抓取任务。
3. 本地或 Telegram 推送摘要。
4. 导出收藏和兴趣画像。
5. 本地部署或低成本云部署。

### P3：产品化

1. 多用户账号。
2. 权限和隐私设置。
3. 可靠的队列和监控。
4. 频道运营者分享入口。
5. 移动端或 PWA。

---

## 17. 已知风险和技术债

### 17.1 GitHub

- 搜索 API 和用户 Star API 有速率限制。
- Star 接口必须保护 OAuth 会话。
- GitHub 的 Open Graph 图片可能加载慢或变化，应有图片失败后备。
- GitHub description 可能为空、包含 Markdown 或误导性描述。
- 仓库名称、topics 和语言不足以判断真实用途，必须保留“可能”“建议先看”等谨慎语气。

### 17.2 DeepSeek

- 外部网络失败不能阻塞页面。
- 返回 JSON 可能不完整或混入 Markdown。
- Prompt 不能把用户私人数据和不需要的仓库内容发送出去。
- 需要控制批量大小、重试次数和费用。
- AI 输出不能替代事实校验。

### 17.3 Telegram

- API ID/API Hash 未配置时，任何连接调用都应返回清楚的配置提示。
- QR token 会过期；前端必须允许重新生成。
- Telegram 登录是用户 API 会话，不是 Bot API Token。
- StringSession 是高度敏感凭证，必须加密并保护文件权限。
- 频道读取范围必须由用户明确指定。
- 不要默认读取私聊、私人群组或全部历史消息。
- 要考虑 Telegram API 条款、速率限制和账号安全。

### 17.4 本地状态

- `localStorage` 只适合单浏览器演示，不适合长期同步。
- 服务端会话依赖本地 `session-secret`；如果删除密钥，已有加密会话无法解密。
- `.env` 变更必须重启进程。
- 当前没有数据库迁移机制。

### 17.5 UI

- 不要把“信息来源变多”直接表现成更多栏目和按钮。
- 新来源最好先进入统一推荐流，并在卡片上显示来源标签。
- 空态和错误态要继续像产品，而不是像开发日志。
- 移动端要优先保证刷卡片和打开详情，不要优先堆设置。

---

## 18. 用户沟通口径

后续 AI 和用户沟通时应遵循：

- 先说结果，再说技术细节。
- 使用“项目、工具、频道、来源、推荐理由”等用户能理解的词。
- 少说“管线、向量、embedding、ranking model”等术语，除非用户主动问。
- 不要把“GitHub API 报错”直接原样扔给用户，应告诉他现在能做什么。
- 明确区分“已经完成”“代码已准备但未配置”“受外部服务阻塞”“还没开始”。
- 不要假装 Telegram 已经连接，也不要假装 DeepSeek 已经开启。
- 用户不需要看到 API Key 或 Session String。
- 当外部服务阻塞时，继续推进不依赖该服务的部分。

推荐的状态表达：

```text
已完成：页面和 GitHub 项目发现已经可以使用。
待配置：DeepSeek/Telegram 需要你在本机填写自己的凭证。
外部阻塞：Telegram 的应用创建页面当前只返回 ERROR，不是项目代码报错。
下一步：先完善统一候选池和兴趣反馈，不必等 Telegram。
```

---

## 19. 下一位 AI 的建议起手式

接手本项目时，按以下顺序开始：

1. 先读本文，不要立即重写页面。
2. 检查 `D:\Codex\Projects\openradar-personal` 是否存在，并 `git pull --ff-only` 确认基线干净。
3. 运行 `npm install`（如果 `node_modules` 不存在）。
4. 运行 `npm run build`、`npm run lint` 和 `npm run check`，确认基线。
5. 检查 `/api/health`、`/api/sources`、`/api/candidates` 和 `/api/ai/config`。
6. 不读取或打印 `.env` 的真实值。
7. 看清用户当前优先级：个人工具发现、中文、简单、视觉化、可持续推荐。
8. 如果任务涉及新来源，先设计 Candidate 和去重字段，再写抓取代码。
9. 如果任务涉及 UI，先保持“频道编辑流”方向，不要改成后台仪表盘。
10. 完成后更新本文第 3 节、第 16 节和第 20 节。

---

## 20. 决策记录

### 2026-09-28：产品定位

确定做个人的新工具发现与研究助手，而不是广泛科技新闻站。

### 2026-09-28：信息范围

不把范围锁在 GitHub、Skill 或 MCP；先让来源逐步增加，系统通过用户行为慢慢理解偏好。

### 2026-09-28：推荐形式

允许用户一直刷；推荐结果不强行限制为少量，每批内容应有主次和解释。

### 2026-09-28：研究能力

从一个项目继续找相关项目，并提供横向比较，比较要服务于选择，不是展示技术字段。

### 2026-09-28：AI 使用方式

DeepSeek 用来分析、改写、匹配和比较；被推荐的项目不需要本身拥有 API。

### 2026-09-28：视觉方向

采用“频道编辑流”，使用中文编辑式卡片、真实项目图片、暖纸色和珊瑚/青绿色强调。

### 2026-09-28：Telegram 策略

先把个人账号 QR 登录骨架接好；由于 Telegram 创建 API 应用页面出现外部 ERROR，暂缓真实连接和频道抓取，不用这个阻塞其他开发。

### 2026-09-28：Git 协作基线

建立 Git 仓库并推送到 `git@github.com:beiming183-cloud/github-tuisong.git`（主分支 `main`，初始快照 `fc5fa76`）。行尾统一为 LF，`.playwright-cli` 调试产物加入忽略。这条是后续多 AI 协同的前提：没有回滚点就不允许并行改动。

### 2026-09-28：统一候选与连接器

采用 `Candidate` + `SourceConnector` 作为所有来源的统一出入口，GitHub 作为第一个参考实现。路由不再直接写抓取逻辑，只做鉴权、限流和入池。连接器不读 Cookie、不读 `.env`，鉴权 Token 由 `server/index.ts` 注入。卡片改为从候选反向渲染，为接入非 GitHub 来源做准备。

### 2026-09-28：候选池先做内存版

候选池只放内存，重启即清空，但 `canonicalUrl` 归一化和去重语义按最终形态实现，避免以后换 SQLite 时改变行为。现在去重只影响 `pool.size / added / duplicates` 的统计和前端提示，**还没有参与推荐排序**——不假装它已经影响推荐。

### 2026-09-28：来源状态不再虚标

`rss` 曾登记为 `ready` 但没有任何抓取代码，属于对用户虚报能力，已改为 `coming_soon` 并在描述里写明“目前还没有抓取代码”。以后新增来源必须让 `/api/sources` 的 `connectors` 自检结果与登记状态一致。

---

## 21. 完成标准（Definition of Done）

任何后续功能只有同时满足以下条件，才算完成：

- [ ] 用户可以用一句话理解它解决什么问题。
- [ ] 页面有加载、成功、空结果和失败状态。
- [ ] 失败不会让整个推荐流白屏。
- [ ] 外部数据转换为统一 `Tool` 或 `Candidate`。
- [ ] 有明确的来源标识和原始链接。
- [ ] 不会把密钥、Session 或私人数据暴露到浏览器或日志。
- [ ] 不会破坏已有 GitHub、详情、比较和本地收藏流程。
- [ ] `npm run build` 通过。
- [ ] `npm run lint` 通过。
- [ ] `npm run check` 通过（涉及连接器、去重或卡片生成时必须）。
- [ ] 至少完成一次浏览器手动验证。
- [ ] 更新本手册的当前状态或决策记录。
- [ ] 用中文向用户说明现在已完成什么、还需要什么。

---

## 22. 给主代理的最后提醒

这个项目最容易走偏的地方，是把它重新做成“更多来源、更多字段、更多按钮”的资讯后台。

真正的核心不是抓到最多项目，而是：

> 每次用户打开，都能舒服地看到几个他愿意点开的东西；点开之后，能更快理解、找到替代方案、做出选择；系统也因此越来越知道他喜欢什么。

如果一个功能会让页面更杂、更像 GitHub、更像新闻列表，即使技术上很先进，也要先问：它是否让用户更容易发现和判断一个值得试的工具？

