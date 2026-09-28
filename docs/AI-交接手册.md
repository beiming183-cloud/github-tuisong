# OpenRadar Personal 多 AI 协同开发交接手册

> 文档版本：V0.3
>
> 编写时间：2026-09-28
>
> 当前项目状态：V0.5 前端原型 + GitHub 接入 + 统一候选池与连接器 + 行为事件与可解释兴趣评分 + DeepSeek 可选接入 + Telegram QR 登录骨架
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
- [x] 修复 Vite 只监听 `::1`、导致 `http://127.0.0.1:5173/` 打不开且 OAuth 回调失败的问题。
- [x] 行为事件记录 `server/events.ts`：view / like / save / star / compare / similar / skip / dismiss，写入 `data/events.json`（原子写 + 0o600）。
- [x] 兴趣画像推导 `buildInterestProfile`：标签 / 来源类型 / 入口加权计数，记录跳过与不再推荐。
- [x] 第一版可解释评分 `server/recommend.ts`：兴趣 0.35 + 价值 0.20 + 新颖 0.15 + 活跃 0.10 + 来源 0.10 + 探索 0.10。
- [x] 多样性重排：连续不超过 2 张同来源或同标签，单一来源占比软上限。
- [x] `GET /api/recommend`：候选池第一次真正参与排序，卡片带中文推荐理由与透明度说明。
- [x] `POST /api/events`、`GET /api/profile`、`GET /api/events`。
- [x] 前端上报真实行为；卡片「为什么给你看」改为评分算出的理由；详情弹窗展示「这张卡片是怎么来的」。
- [x] 「我的兴趣」画像弹窗；兴趣标签不再由抓取内容决定，只由真实行为决定。
- [x] `npm run smoke`：接口级冒烟测试（24 项，可重复运行）。
- [x] `npm run build` 通过。
- [x] `npm run lint` 通过。

### 3.2 已有但不完整

- [ ] `interestTags` 现在由真实行为画像驱动，但只在有 ≥2 个正向标签时才替换占位标签，没有画像时仍显示默认文案。
- [x] 推荐排序已经不再只依赖来源返回顺序：候选池参与评分、硬规则降权和多样性重排。
- [ ] 候选池和事件都只在内存 + 单个 JSON 文件里，API 进程重启后候选池清空（事件会保留）。
- [ ] 事件文件每来一批就整文件重写，没有按用户或按天分片；事件超过 5000 条会丢弃最早的。
- [ ] 「取消喜欢 / 取消收藏」目前不产生任何事件，负向信号只有「跳过」和「不再推荐」。
- [ ] 评分里没有使用「近期 Star 增长」「Issue 活跃度」「安装复杂度」这些信号，只有星数量级和更新时间。
- [ ] 去重目前是 URL 级，还没有做标题、描述、标签的语义合并。
- [ ] GitHub 的分类目前是关键词启发式，不是成熟的相关度模型。
- [ ] DeepSeek 只负责补中文卡片字段，没有缓存、成本统计、版本化和人工纠错。
- [x] `rss` 曾在来源登记表中虚标为 ready，已改为 coming_soon 并写明“目前还没有抓取代码”。
- [ ] Telegram 可以生成登录二维码的代码，但当前没有配置 Telegram API ID/API Hash，也没有频道消息抓取。
- [ ] 推荐流没有真正的数据库，换浏览器后行为画像不会跨设备同步（同一台机器上换浏览器是可以的，画像在服务端）。
- [ ] 暂无定时任务、后台抓取队列或自动推送。

### 3.3 尚未开始

- [ ] Telegram 频道/资源群配置页面。
- [ ] Telegram 公开频道消息读取、链接抽取、去重和卡片生成。
- [ ] RSS、Hacker News、Product Hunt 等来源连接器（接口已就绪，见第 12 节）。
- [ ] 内容规范化（标题、描述、标签的语义合并），现在只做了 URL 级去重。
- [ ] 无限滚动或分页式“继续刷”。
- [ ] 真实的跳过与不再推荐入口的移动端位置验证。
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
│   ├── events.ts                # 行为事件记录（data/events.json）
│   ├── recommend.ts             # 兴趣画像、可解释评分、多样性重排
│   ├── check-connectors.ts      # npm run check 的候选池用例
│   ├── check-recommend.ts       # npm run check 的评分用例
│   ├── smoke-api.ts             # npm run smoke 的接口冒烟测试
│   └── connectors/
│       ├── types.ts             # Candidate / SourceConnector / ToolCard 接口
│       ├── github.ts            # GitHub 连接器（第一个参考实现）
│       └── index.ts             # 连接器注册表与自检汇总
├── data/                        # 运行时私密数据，整目录不提交
│   ├── session-secret
│   ├── sessions.json
│   ├── telegram-session.json
│   └── events.json              # 行为事件，兴趣画像的唯一来源
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

- `.env`、整个 `data/`（含 `session-secret`、`sessions.json`、`telegram-session.json`、`events.json`）、`node_modules`、`dist`、`.playwright-cli` 均被 `.gitignore` 忽略（用 `git check-ignore -v` 核对过）。`data/` 是整目录忽略，不再逐个列文件名。
- 提交做过内容级密钥扫描：把 `.env` 里的非空配置值逐个比对全部暂存文件，命中的只有 `127.0.0.1` 本地地址。**每次提交前都要重复这件事**，不要只看文件名。
- `.gitattributes` 锁定 `* text=auto eol=lf`，避免不同工具产生整文件换行差异。
- `data/events.json` 虽然不是凭证，但它记录了用户看过和跳过了什么，属于私人数据，同样不提交、不粘贴、不外发。

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

`vite.config.ts` 里显式写了 `server.host: '127.0.0.1'`，**不要删**。Vite 默认只监听 `localhost`，在 Windows + 较新 Node 上会解析到 `::1`（仅 IPv6），于是上面这个 `127.0.0.1:5173` 会连接被拒，GitHub OAuth 回调重定向到 `APP_URL` 时也会打不开页面。API 侧本来就是 `app.listen(port, '127.0.0.1')`，两边保持一致。

### 5.3 构建和静态检查

每次重要修改后运行：

```powershell
npm run build
npm run lint
```

`npm run build` 包含服务端 TypeScript 检查、客户端 TypeScript 构建和 Vite 生产构建。

`npm run check` 运行两个纯离线自检，覆盖 canonicalUrl 归一化、候选池同批与跨批去重、候选到卡片的往返渲染、兴趣画像加权、六个评分维度、硬规则降权和多样性重排。它不联网、不读 `.env`、不写 `data/`，改动连接器、去重、事件权重或评分逻辑后必须运行。

`npm run smoke` 是接口级冒烟测试，需要一个已经跑起来的 API：

```powershell
npm run smoke                          # 默认打 http://127.0.0.1:8787
npm run smoke -- http://127.0.0.1:8799 # 或指定地址
```

它会真实抓一次 GitHub、真的写行为事件，所以**跑之前请把 API 的 `OPENRADAR_DATA_DIR` 指到临时目录**，否则测试数据会混进你自己的兴趣画像：

```powershell
$env:PORT='8799'; $env:OPENRADAR_DATA_DIR="$env:TEMP\openradar-smoke-data"
npm run start
# 另开一个终端
npm run smoke -- http://127.0.0.1:8799
```

冒烟测试比对的是「本次新增的差值」而不是绝对值，所以可以重复运行而结果稳定。`OPENRADAR_DATA_DIR` **只被 `server/events.ts` 识别**（会话密钥和 Telegram 会话不认），它的唯一用途就是隔离行为事件，不是通用的数据目录开关。

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
- [ ] 探索成功后，提示里出现“已按你的兴趣排过序”或“其中 N 个是第一次看到”，是中文而不是技术错误原文。
- [ ] 再点一次探索，提示里出现“N 个之前已经出现过”。
- [ ] 点喜欢 / 收藏 / Star / 比较后，打开「为什么给我看这些？」，画像里出现对应标签和权重。
- [ ] 点卡片上的跳过（眼睛图标），卡片从当前列表消失，提示说明“之后不会优先出现，需要时还能翻到”。
- [ ] 详情弹窗里能看到「这张卡片是怎么来的」，且里面没有出现“分数”“权重”“模型”这类词。
- [ ] 没有留下任何行为时，画像弹窗明确说“还没有足够的偏好信号”，而不是编一个画像。
- [ ] Telegram 未配置时，弹窗清楚说明下一步，不显示错误二维码。
- [ ] 图片加载失败时有项目名称和图标后备。
- [ ] 移动端宽度下按钮和比较台不溢出。
- [ ] 浏览器 Console 没有应用错误。

### 5.5 当前已知验证结果

最近一次（行为事件与可解释评分落地后）在本机实测：

- `npm run build`：通过。
- `npm run lint`：通过（0 warning / 0 error，21 个文件）。
- `npm run check`：候选池 18 项 + 评分 44 项，全部通过。
- `npm run smoke`：24 项通过、1 项 SKIP（池里只有一个来源时来源多样性无法满足），连续跑两次结果一致。
- `/api/health`：`{"ok":true,"service":"openradar-api"}`。
- `/api/sources`：返回 7 条来源描述，并附带 `connectors` 自检结果（`github-discovery: ready`）。
- `/api/candidates`：空池时返回 `{"stats":{"size":0,...},"items":[]}`。
- `/api/profile`：没有行为时 `hasProfile=false`，明确说明“还没有足够的偏好信号”。
- `/api/events`：5 条合法事件全部入库；`{toolId:'', event:'like'}` 与非法事件名被跳过而不是整批失败（`stored=0, rejected=2`）。
- 兴趣画像加权实测：`文件工具 = 11`（save 4 + save 4 + like 3）、`本地运行 = 4`、`AI 工具 = -2`（skip），正向 3 次 / 负向 2 次。
- `/api/recommend`：第一张是全局最高分；12 张里 3 对相邻位置为多样性做了交换；同标签最长连续 2 张。
- `/api/discover/github`：返回 24 个项目，`pool.size=24, added=24, duplicates=0`；同参数再请求一次为 `added=0, duplicates=24`；换成 `q=stars:>20000` 为 `added=20, duplicates=4`。
- 手动丢链接：`https://github.com/qarmin/czkawka/tree/master` 与 `https://www.github.com/Qarmin/Czkawka.git` 归一化为同一条候选，第二次为 `added=0, duplicates=1`。
- 地址验证：`http://127.0.0.1:5173/` 与 `http://localhost:5173/` 均返回 200，Vite 的 `/api` 代理正常。
- Telegram 当前 `/api/telegram/config`：`configured: false`，因为尚未成功获得 API ID/API Hash。
- DeepSeek 当前未配置 Key，规则结果可用。

**尚未完成**：浏览器手动验证。本轮改动只做了接口级冒烟测试，还没有在浏览器里点过「探索」「跳过」和画像弹窗，下一位接手时请补上第 5.4 节的手动清单。

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
- 不要提交以下内容：
  - `.env`
  - 整个 `data/` 目录（`.gitignore` 已整目录忽略）
    - `data/session-secret`、`data/sessions.json`、`data/telegram-session.json`
    - `data/events.json`（行为事件与兴趣画像，属于私人数据）
    - 以及它们的 `.tmp` 文件
- 修改 `.env` 后必须重启 API 服务，因为 `server/ai.ts`、`server/telegram.ts` 和 `server/events.ts` 在模块加载时读取环境变量。
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
- `interestTags`：由服务端兴趣画像驱动；没有画像（或正向标签少于 2 个）时显示占位文案
- `profile` / `profileOpen`：兴趣画像摘要和「我的兴趣」弹窗

### 7.2 localStorage 键

```text
openradar_saved
openradar_liked
openradar_starred
```

当前只保存项目 ID 数组，不保存行为时间、来源和权重。**兴趣画像不再存在 localStorage**，它由服务端从 `data/events.json` 推导，所以同一台机器上换浏览器画像仍然有效，只有换机器才丢。

localStorage 的三个数组和事件记录是两套东西：localStorage 决定按钮的选中态，事件决定推荐排序。两边不一致时，按钮按 localStorage 显示，排序按事件算。后续应当把按钮状态也改成从事件推导，避免出现「按钮亮着但没有对应事件」。

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
  // 来自候选池排序时才有，用于上报事件和展示推荐透明度
  sourceId?: string
  score?: number
  reasonCodes?: string[]
  reasonDetails?: string[]
  matchedTags?: string[]
}
```

任何新来源都应该尽量先转换成这个结构，避免组件分别理解 GitHub、Telegram、RSS 的字段。

`Tool` 同时镜像在 `server/connectors/types.ts` 的 `ToolCard` 里——服务端和客户端是两套 tsconfig，不能互相 import。**改动时必须同时改两个文件**，否则类型会对不上而编译不报错。

### 7.4 当前卡片行为

- 主卡片显示大图、场景化标题、摘要、「为什么给你看」、标签和操作。
- 侧边卡片显示图片、标题、摘要、难度、价值、标签和操作。
- 详情弹窗显示场景、摘要、推荐理由、上手难度、使用价值、项目属性、标签、**「这张卡片是怎么来的」**和操作。
- 比较弹窗当前比较：一句话理解、适合场景、上手难度、价值判断、项目属性。
- 当前比较结论只是优先选择「上手低」的项目，不是 AI 结论。
- 来自候选池排序的卡片，`why` 会被替换成评分算出的个性化理由（例如「你之前点过『文件工具』方向的项目，它和它相邻」），不再使用通用文案。
- 卡片操作行有四个图标按钮：喜欢、收藏、GitHub Star、**跳过**。跳过会从当前列表移走该项目，服务端只降权、不永久删除。
- 「不再推荐这类」放在详情弹窗里，不放在卡片上——避免把小卡片塞满按钮。

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

### 8.2 行为事件与推荐（P0 的核心）

#### `POST /api/events`

记录用户行为。请求体接受 `{ events: [...] }`、裸数组或单个事件对象：

```json
{
  "events": [
    {
      "toolId": "github-123",
      "event": "like",
      "sourceKind": "github",
      "sourceId": "github-discovery",
      "tags": ["文件工具", "本地运行"],
      "occurredAt": "2026-09-28T00:00:00.000Z"
    }
  ]
}
```

- 单次最多 50 条（`MAX_EVENTS_PER_REQUEST`）。
- 非法条目被跳过并在 `rejected` 里计数，**不会整批失败**——丢一条埋点不应该影响用户正在做的事。
- 响应：`{ stored, rejected, stats }`。
- 事件写入 `data/events.json`，原子写（临时文件 + rename）+ `0o600`，最多保留 5000 条。

#### `GET /api/events?limit=<1-200>`

查看最近的事件。只返回 `toolId / event / sourceId / tags / occurredAt`，不返回内部 id。

#### `GET /api/profile`

返回兴趣画像的中文摘要和原始权重：

```json
{
  "hasProfile": true,
  "headline": "这些是你点出来的兴趣，会用来决定先给你看什么。",
  "updatedAt": "2026-09-28T00:00:00.000Z",
  "lines": [{ "label": "你在意的方向", "detail": "文件工具（+11）、AI 工具（-2）" }],
  "eventCount": 5,
  "profile": {
    "tagWeights": { "文件工具": 11 },
    "positiveCount": 3,
    "negativeCount": 2,
    "skippedCount": 1,
    "dismissedCount": 1
  }
}
```

**没有任何行为时 `hasProfile` 必须是 `false`，并明确说「还没有足够的偏好信号」。**不要为了让页面好看而编一个画像。

#### `GET /api/recommend?limit=<1-50>`

候选池第一次真正参与排序：评分 → 硬规则降权 → 多样性重排 → 渲染卡片。

```json
{
  "source": "candidate-pool",
  "hasProfile": true,
  "considered": 44,
  "tools": [
    {
      "id": "github-123",
      "why": "你之前点过「文件工具」方向的项目，它和它相邻，可以先看一眼。",
      "score": 0.62,
      "reasonCodes": ["interest:partial-match", "novelty:first-time", "activity:active", "trust:discovery"],
      "reasonDetails": ["命中一个你关注过的方向。", "这是你第一次看到它。"],
      "matchedTags": ["文件工具"]
    }
  ]
}
```

排序契约（`npm run smoke` 会验证）：

- **第一张必须是全局最高分**，多样性重排不允许把最佳选择挤下去。
- 其余位置允许为多样性做局部交换，但必须是局部的，不是把顺序打乱。
- 同标签连续不超过 2 张，**任何情况下都必须成立**。
- 同来源连续不超过 2 张，只在候选池里有 ≥2 个来源时才要求。目前只有 GitHub 探索一个连接器，所以实际的推荐结果全部同来源，这条规则会自动放宽（`diversify` 的 `relaxSource`），不会假装满足。
- 跳过过的项目乘 0.5，标记不再推荐的乘 0.1，但**两者都仍然会返回**，不永久隐藏。

### 8.3 AI

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

### 8.4 GitHub

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

### 8.5 Telegram

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

### 8.6 API 错误约定

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

## 13. 推荐系统设计（第一版已落地）

### 13.1 现阶段不急着上复杂模型

用户目前还不确定自己喜欢什么，最适合先做「可解释的行为评分」，再积累数据。不要一开始训练模型，也不要把用户锁死在标签上。

**第一版已经按这个原则实现**（`server/events.ts` + `server/recommend.ts`）：没有 embedding、没有向量、没有模型训练，只有加权计数和六个能讲成人话的维度。

### 13.2 事件与权重（已实现）

```ts
type UserEvent = {
  id: string
  toolId: string
  event: 'view' | 'open_source' | 'like' | 'save' | 'star' | 'compare' | 'similar' | 'skip' | 'dismiss'
  sourceKind?: Tool['sourceKind']
  sourceId?: string        // 第一版新增：用于统计来源偏好
  tags?: string[]
  occurredAt: string
}
```

事件权重（`EVENT_WEIGHTS`）：

```text
star       +5
save       +4
like       +3
compare    +2
similar    +2      ← 第一版新增，按与 open_source / compare 同级的主动研究行为给分
open_source+2
view       +1
skip       -2
dismiss    -4
```

权重只是起点，不要当作永久规则。调整时必须同步改 `server/check-recommend.ts` 的用例，那里的第一组断言就是「事件权重与手册一致」。

已知缺口：**取消喜欢 / 取消收藏不产生任何事件**。负向信号目前只有跳过和不再推荐。前端只在「打开/加入」这类正向动作时上报。

### 13.3 候选排序公式（已实现）

```text
总分 = 兴趣匹配 × 0.35
     + 实用价值 × 0.20
     + 新颖度 × 0.15
     + 最近活跃 × 0.10
     + 来源可信度 × 0.10
     + 探索奖励 × 0.10
```

每个维度归一化到 0..1，权重合计 1.00。各维度的定义（都在 `server/recommend.ts`，都是纯函数）：

| 维度 | 怎么算 | 说明 |
|---|---|---|
| 兴趣匹配 | 候选标签对画像标签权重取平均，再按最强兴趣归一化 | 没有画像时为 0，并标记 `interest:no-profile` |
| 实用价值 | 星数量级分档 + 有描述 + 有 topics | **这是粗略代理，不是真实有用程度**；只用了可核对的信号 |
| 新颖度 | 没看过 1.0 / 看过一次 0.4 / 看过多次 0.15，来源重复出现再扣 | 用 `view` 事件次数 |
| 最近活跃 | 按最近更新时间分档：≤7 天 1.0，≤30 天 0.85，≥365 天 0.1 | 没有时间取中性 0.4 |
| 来源可信度 | 固定表：manual 1.0、github-stars 0.95、github-similar 0.75、github-discovery 0.7 | 这是产品判断，不是客观事实 |
| 探索奖励 | 候选标签全部未知 1.0、部分已知 0.5、全部已知 0.1 | 「探索」能扩大范围的机制 |

硬规则（`diversify`）：

- 连续 3 张卡片不能是同一个来源或同一个标签 → 实现为「连续不超过 2 张」，用「优先消耗剩余数量最多的那一类」的贪心，避免把某一类留到最后被迫连排。
- 已经跳过（× 0.5）和标记不再推荐（× 0.1）的项目降权，但**都会继续返回**，不永久隐藏。
- 单一来源占比软上限 0.6；如果所有可放位置都超了上限就照常放，不把自己饿死。
- 池子里只有一个来源时自动放宽来源规则（`relaxSource`），但**标签规则永远保持**。目前只有 GitHub 一个连接器，这是常态而不是例外。

排序契约由 `npm run smoke` 验证：第一张必须是全局最高分，同标签连续不超过 2 张。

### 13.4 兴趣画像

第一版存的是：

- `tagWeights`：标签 → 权重（主题偏好、使用方式偏好、形态偏好在第一版里都混在标签里，因为 GitHub 分类只产出一层标签）。
- `sourceKindWeights` / `sourceIdWeights`：来源偏好。
- `viewCountByTool`：每个项目被看过几次。
- `skippedToolIds` / `dismissedToolIds`：负向信号。
- `positiveCount` / `negativeCount`：动作计数。

还**没有**存的（见第 16 节 P1）：解释风格偏好、形态偏好单列、以及「我已经试过 / 以后提醒我」这类状态。

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
3. [x] 增加 `view / like / save / star / compare / similar / skip / dismiss` 行为事件。（2026-09-28 完成，写入 `data/events.json`）
4. [x] 做第一版可解释的兴趣评分，并在卡片和详情里展示理由。（2026-09-28 完成）
5. [x] 让候选池真正参与排序与多样性重排。（2026-09-28 完成，见 `GET /api/recommend`）
6. [ ] 让“继续刷”能够加载下一批结果，并把候选池从内存换成 SQLite。

P0 剩下的第 6 项是下一步最该做的：现在候选池每重启一次就清空，「继续刷」也还没有分页游标（`SourceConnector.fetchCandidates` 已经预留了 `cursor`/`nextCursor`，但只有 GitHub 连接器还没用它）。

### P1：把信息源做成真正可扩展的系统

1. RSS 通用连接器（接口已就绪，照 `server/connectors/github.ts` 写）。
2. Telegram 频道连接器（在 API 凭证可用后）。
3. Hacker News 连接器。
4. Product Hunt 配置页和 API 适配。
5. 来源启用/暂停和来源权重。
6. 接入第二个来源后，`diversify` 的来源多样性规则才会真正生效，请在那时把 `npm run smoke` 里的 SKIP 分支去掉。

### P1：提升研究能力

1. 相关项目图谱。
2. 替代项目和互补项目分类。
3. 事实字段与 AI 解释分离。
4. 真实的优缺点对比。
5. 记录“我已经试过 / 我暂时不想看 / 以后提醒我”。
6. 把「取消喜欢 / 取消收藏」也记成负向事件（现在完全没有记录，见 13.2）。

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

### 17.6 本地地址与 IPv4 / IPv6

- Windows + 较新 Node 上，`localhost` 常解析到 `::1`（仅 IPv6）。Vite 默认只监听 `localhost`，因此必须显式绑定 `127.0.0.1`，否则手册里写的 `http://127.0.0.1:5173/` 打不开。
- 这个坑最隐蔽的后果是 GitHub OAuth：回调最后重定向到 `APP_URL`，地址写对了但服务没在 IPv4 上监听，用户看到的是一次“连接失败”。
- 改端口、改 host、升级 Vite 或 Node 之后，务必重新确认 `http://127.0.0.1:5173/` 能打开，而不只是 `localhost` 能打开。

### 17.7 兴趣评分与行为记录

- **分数不是事实。** `score` 只是排序用的中间量，UI 必须展示理由而不是数字。绝对不要把 `score` 或 `reasonCodes` 直接给用户看。
- **实用价值只是粗略代理。** 它只用星数量级、有没有描述、有没有 topics，不能当成「这个工具好用」的结论。任何把它说成“质量分”的文案都是过度承诺。
- **样本极少时不要装作懂用户。** 一条 `like` 就能让某个标签排到最前。`hasProfile` 为 false 时必须走「还没有足够的偏好信号」分支，不要用一条事件推出来的画像去说服用户。
- **事件文件是隐私数据。** `data/events.json` 记录用户看过什么、跳过什么。它已被 `.gitignore` 整目录忽略，接口也不返回内部 id。新增接口时不要顺手把它暴露出去。
- **事件会无限增长。** 目前超过 5000 条丢最早的，且每批都整文件重写。事件多了以后写入会变慢，换 SQLite 时先处理这个。
- **`interestTags` 和 localStorage 可能不一致。** 按钮选中态看 localStorage，排序看事件。用户手改 localStorage 或换浏览器后，会出现「按钮亮着但画像里没有这条」的情况。
- **`npm run smoke` 会真的写事件。** 直接打真实实例会污染用户画像（本轮开发就发生过一次，已清理）。跑之前必须设置 `OPENRADAR_DATA_DIR` 到临时目录。

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
已完成：页面、GitHub 项目发现、候选池去重、行为记录和个性化排序都可以用了。
待配置：DeepSeek/Telegram 需要你在本机填写自己的凭证。
外部阻塞：Telegram 的应用创建页面当前只返回 ERROR，不是项目代码报错。
下一步：候选池换成 SQLite，并做「继续刷」的分页，不必等 Telegram。
```

---

## 19. 下一位 AI 的建议起手式

接手本项目时，按以下顺序开始：

1. 先读本文，不要立即重写页面。
2. 检查 `D:\Codex\Projects\openradar-personal` 是否存在，并 `git pull --ff-only` 确认基线干净。
3. 运行 `npm install`（如果 `node_modules` 不存在）。
4. 运行 `npm run build`、`npm run lint` 和 `npm run check`，确认基线。
5. 检查 `/api/health`、`/api/sources`、`/api/candidates`、`/api/profile`、`/api/recommend` 和 `/api/ai/config`。
6. 不读取或打印 `.env` 的真实值；也不要把 `data/events.json` 的内容贴到任何地方。
7. 跑 `npm run smoke` 之前，**先把 API 的 `OPENRADAR_DATA_DIR` 指到临时目录**，否则会污染用户真实画像。
8. 看清用户当前优先级：个人工具发现、中文、简单、视觉化、可持续推荐。
9. 如果任务涉及新来源，先设计 Candidate 和去重字段，再写抓取代码；接口和参考实现都已经在 `server/connectors/`。
10. 如果任务涉及 UI，先保持“频道编辑流”方向，不要改成后台仪表盘。
11. 完成后更新本文第 3 节、第 16 节和第 20 节。

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

### 2026-09-28：修复 Vite 只监听 IPv6 回环

手册和 `.env.example` 都写 `http://127.0.0.1:5173`，但 Vite 实际只监听 `::1`，导致该地址连接被拒，GitHub OAuth 回调重定向也会失败。已在 `vite.config.ts` 显式设置 `server.host: '127.0.0.1'`，与 API 的绑定保持一致。这是验证阶段实测发现的，不是猜测。

### 2026-09-28：行为事件与第一版可解释评分

按第 13 节的设计实现 P0 的第 3～5 项：事件写入 `data/events.json`（原子写、0o600、上限 5000 条），评分是六个归一化维度的加权和，理由由 `reasonCodes` 翻成中文。**没有引入模型、embedding 或向量**——用户还不确定自己喜欢什么，这一阶段要的是可解释和可调整。

配套决定：

- **取消喜欢 / 取消收藏暂不记录事件。** 事件联合类型里没有对应的负向动作，为了不发明语义就先不记，并把这个缺口写进 13.2 和第 16 节，而不是假装负向信号已经完整。
- **给 `similar` 补了 +2 权重**，原文只给了事件名没给权重。按与 `open_source` / `compare` 同级的主动研究行为处理。
- **多样性重排的降级策略**：池里只有一个来源时（当前常态），来源规则自动放宽，但标签规则永远保持。第一版实现是「排不出来就把剩下的按原顺序倒出去」，实测会连排 12 张，属于真 bug，已改成两级降级。
- **排序契约**：第一张必须是全局最高分，其余位置允许为多样性做局部交换。这是权衡后的结果，不是「严格按分数排序」，`npm run smoke` 按这个契约验证。
- **去重语义不变**：本轮没有扩大去重的范围，仍然只做 URL 级。

### 2026-09-28：data/ 改为整目录忽略

原来逐个列 `data/` 下的文件名，新增 `events.json` 时就要再改一次 `.gitignore`，很容易漏。改成整目录忽略，以后新增任何运行时数据文件都不会被误提交。

### 2026-09-28：冒烟测试写进真实画像的一次事故

第一次验证 `/api/events` 时直接打了正在运行的真实实例，5 条测试事件写进了 `data/events.json`（标签还因 PowerShell 编码问题变成乱码）。已经删除该文件并重启服务，用户画像是干净的。

由此定下的规则：`npm run smoke` 必须配合 `OPENRADAR_DATA_DIR` 指到临时目录；`server/events.ts` 因此支持这个变量，并且**只有它支持**（会话密钥和 Telegram 会话不认），避免以后有人误以为这是通用数据目录开关。

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
- [ ] `npm run check` 通过（涉及连接器、去重、事件或评分时必须）。
- [ ] 涉及接口契约时，`npm run smoke` 通过（记得先隔离 `OPENRADAR_DATA_DIR`）。
- [ ] 推荐相关改动必须保留「第一张是最高分」和「同标签不连续超过 2 张」两条契约。
- [ ] 如果做不到某件事，手册里要写明做不到，而不是写成已完成。
- [ ] 至少完成一次浏览器手动验证。
- [ ] 更新本手册的当前状态或决策记录。
- [ ] 用中文向用户说明现在已完成什么、还需要什么。

---

## 22. 给主代理的最后提醒

这个项目最容易走偏的地方，是把它重新做成“更多来源、更多字段、更多按钮”的资讯后台。

真正的核心不是抓到最多项目，而是：

> 每次用户打开，都能舒服地看到几个他愿意点开的东西；点开之后，能更快理解、找到替代方案、做出选择；系统也因此越来越知道他喜欢什么。

如果一个功能会让页面更杂、更像 GitHub、更像新闻列表，即使技术上很先进，也要先问：它是否让用户更容易发现和判断一个值得试的工具？

