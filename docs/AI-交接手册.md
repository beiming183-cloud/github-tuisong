# OpenRadar Personal 多 AI 协同开发交接手册

> 文档版本：V0.3
>
> 编写时间：2026-09-28
>
> 当前项目状态：V0.6 前端原型 + GitHub 接入 + 统一候选池与连接器 + 行为事件与可解释兴趣评分 + DeepSeek 可选接入 + Telegram 公开频道增量来源 + Telegram QR 登录骨架
>
> 项目目录：`D:\Codex\Projects\openradar-personal`
>
> 适用对象：后续接手本项目的 Codex、Claude、Cursor、ChatGPT 或其他 AI 开发代理，以及负责最终整合的主代理。

---

## 进度快照（2026-09-29）

**当前状态：`main` 与 `origin/main` 一致，没有未推送提交。**（用 `git log -1 --oneline` 看确切提交号；本文档不写死哈希，因为写下它本身就会产生新提交。）

### 两个代理的交接已完成

2026-09-28 到 09-29 期间，Codex 和另一个代理在同一个仓库里并行开发过。现在 Codex **已经收尾**，它的成果由接手方一并落库。按时间顺序：

| 提交 | 内容 |
|---|---|
| `4d54fa1` | 统一候选 `Candidate` + 来源连接器接口，GitHub 参考实现 + canonicalUrl 去重 |
| `7b75ad1` | 修复 Vite 只监听 IPv6 导致 `127.0.0.1:5173` 打不开、OAuth 回调失败 |
| `25f4932` | 行为事件记录 + 第一版可解释兴趣评分 + 多样性重排 + 前端展示 |
| `9bf7359` | 修复来源解释编造关系（通用探索谎称“从你感兴趣的项目延伸”） |
| `e83a015` | 修正手册过期数字；**此提交被 `git add -A` 污染，内含并行代理的文件** |
| `78ab951` | 记录并行开发事故与 Telegram 公开频道新路线 |
| 后续提交 | Codex 的 SQLite 持久化 / feed 分页 / Telegram 公开频道来源，以及接手方的分析队列与隔离修复 |

### 现在可以做什么

- 页面、GitHub 发现、Telegram 公开频道、候选池持久化、行为画像和个性化排序都能跑。
- `npm run check` 有 103 项离线用例；`npm run smoke` 有 32 项接口断言并带隔离门禁。
- **待配置**：`DEEPSEEK_API_KEY`（分析队列从未真实跑过）、`TELEGRAM_API_ID`/`API_HASH`（个人账号登录）。
- **待人工确认**：浏览器手动验证（第 5.4 节），至今无人执行。

**下一步优先级**：

1. 配好 DeepSeek Key，小批跑通分析队列（99 个候选、已分析 0 个）。
2. 浏览器手动验证第 5.4 节清单。
3. 回填：等下一次 Telegram 同步撞上 GitHub 限流产生 `pending` 后再验证限流提前停止的行为。
4. P1：继续补 GitHub 之外的开源社区来源；Telegram 作为补充，不要抢掉主发现入口。

**两条硬规则**（都是踩过坑换来的）：

1. 禁止 `git add -A` / `git add .`，只能按路径显式暂存，提交前核对暂存清单。见 15.7 节。
2. 声明「用 `OPENRADAR_DATA_DIR` 隔离测试数据」之后必须**实测**，不能只看临时目录里生成了文件。见 17.8 节。

来源：进度快照按实际仓库状态写，不是回顾记忆。

---

## 0. 给下一位 AI 的最短说明

OpenRadar Personal 不是一个 GitHub 热榜，也不是新闻聚合站。

它是一个面向个人的中文“新工具发现与研究助手”：从 GitHub、Telegram 资源频道、RSS、工具目录等来源找到新出现的、小而有用的项目，用直白的中文和视觉化卡片解释它们，按照用户的喜欢、收藏、跳过、查看详情、Star 等行为逐渐理解用户兴趣，并支持从一个项目继续找到相关项目、进行横向比较，最终形成一个可以不断刷、不断探索、但不杂乱的私人宝藏工具流。

当前最重要的用户感受是：

> “我不想先学会 GitHub，也不想看一堆新闻；我只想舒服地刷到一些可能真的有用、看得懂、值得试试的东西。”

当前主页面已经可以运行，但它仍然是一个单用户本地原型。真实的长期推荐、多个来源的统一抓取、候选池持久化和正式部署都还没有完成；Telegram 公开频道已经有第一版增量来源，个人账号读取仍未配置。

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

### 2.4 长期工具库与统一风格（2026-09-29 新确认）

用户希望系统最终沉淀一两千个可持续筛选的项目，能够支持连续浏览和后续大规模推送。这个数量属于后台候选储备，不是首页一次展示一两千张卡片；首页仍然只给用户当前最值得看的部分。数量增加后，界面和内容风格必须统一：来源可以是 GitHub、Telegram、FOSS 目录或其他开源社区，但用户看到的卡片都要使用同一套中文结构。

统一卡片至少包含：

```text
项目名 / 一句话说明 / 主要用途 / 适合谁 / 上手难度
所属分类 / 关键词 / 来源 / 最近活跃时间 / 是否值得现在尝试
```

分类不能只靠频道名称或 GitHub 仓库语言。每个项目需要同时保存：

- 主分类：例如 AI 工具、桌面工具、浏览器工具、开发工具、自动化、Self-hosted、隐私安全、Android FOSS、文件与效率、媒体处理等；
- 使用场景：例如“整理文件”“自己部署服务”“接入 API”“管理服务器”“处理图片”；
- 项目形态：应用、库、框架、命令行工具、插件、Skill、MCP、服务、资源列表；
- 质量和状态：待分析、已分析、可推荐、已看过、暂不推荐、疑似重复；
- 来源权重：GitHub 直接发现、用户 Star、Telegram 频道、相似项目、手动链接。

一两千个项目不能一次性加载到首页。推荐流需要分页或持续刷，每批从已分析项目中取一部分，同时保留“探索”和“继续加载”。推送任务应从分类、用户兴趣、项目新鲜度和来源可信度中生成，而不是把全部新项目一次发送。分类服务于后台整理、筛选和推送，不能把界面做成分类目录或新闻后台。

内容生成必须经过统一模板和去重层：频道原文、GitHub README 和英文描述只作为输入，不能直接混在卡片里。DeepSeek 负责翻译、提炼、分类和比较，规则层负责字段校验、广告过滤、重复合并和推荐状态。

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
- [x] Telegram 公开频道网页读取脚本 `scripts/telegram-public-reader.mjs`：读取 `t.me/s/<频道>`、分页、提取正文/时间/浏览量/图片/链接并输出 JSON；Windows 下 Node 网络失败时回退系统 `curl.exe`。
- [x] Telegram 公开频道连接器 `server/connectors/telegram-public.ts`：频道配置、消息 ID 增量读取、GitHub 链接提取、仓库元数据补充、候选池接入和状态文件。
- [x] Telegram 公开频道接口与页面入口：`/api/telegram/public/status`、`PUT /api/telegram/public/channels`、`POST /api/telegram/public/sync`；弹窗可粘贴多条频道链接并手动同步。
- [x] Telegram 公开频道每天最多一次的本地调度：默认 24 小时；首次同步必须手动触发，完成过一次后服务重启若到期才补跑；没有频道配置时不运行。
- [x] 移动端样式、焦点状态和基本键盘可访问性。
- [x] 统一候选 `Candidate` 与来源连接器接口 `SourceConnector`。
- [x] GitHub 连接器 `server/connectors/github.ts`；探索路由改为调用连接器，不再直接写抓取逻辑。
- [x] 候选池 `server/candidates.ts`：canonical URL 归一化 + 同批与跨批去重。
- [x] `GET /api/candidates` 查看候选池状态；`/api/sources` 附带连接器自检结果。
- [x] 卡片由候选反向渲染（`candidateToTool`），不再直接依赖原始 API 响应。
- [x] `npm run check` 自检：候选池 19 项 + 评分 44 项 + 分析队列 40 项离线用例。
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
- [x] `npm run smoke`：接口级冒烟测试（32 项通过 + 2 项如实 SKIP），带「未隔离就拒绝执行」的硬门禁。
- [x] `server/analysis.ts` 分析队列：批次有界（默认 6 / 上限 8）、可续跑、默认 dryRun、分析器可注入。
- [x] `GET /api/analysis/status`、`POST /api/analysis/run`；`server/check-analysis.ts` 40 项离线用例。
- [x] GitHub 限流识别：`githubRequest` 读取剩余额度与重置时间；回填遇限流提前停止，不再把限流算成失败。
- [x] 修复 `ready` 覆盖 `analyzed` 的状态降级，和 Telegram 候选 AI 结果写不回候选池的问题。
- [x] 修复 `OPENRADAR_DATA_DIR` 隔离失效：所有模块统一用 `store.ts` 的 `resolveDataDir()`；`/api/health` 暴露 `isolated`。
- [x] README 更新到 V0.6 实际状态：公开频道来源、校验命令、推荐公式、数据与隐私说明。
- [x] `npm run build` 通过。
- [x] `npm run lint` 通过。

### 3.2 已有但不完整

**2026-09-29 整理**：这一节原来混着一批已经完成却还挂在「不完整」里的条目（SQLite 持久化、分页、DeepSeek 缓存、画像查看），会让人误判项目进度。已按当前代码逐条核对重写。

- [ ] `interestTags` 由真实行为画像驱动，但只在有 ≥2 个正向标签时才替换占位标签；没有画像时仍显示默认文案。
- [ ] **分析队列从未对真实 DeepSeek 跑过一次**（本机没有 Key）。队列逻辑有 40 项离线用例覆盖，但「真的连上会不会按预期写回」未验证。当前 99 个候选、已分析 0 个。
- [ ] 「取消喜欢 / 取消收藏」不产生任何事件，负向信号只有「跳过」和「不再推荐」。
- [ ] 评分只用「星数量级 + 更新时间 + 有无描述/topics」，没有近期 Star 增长、Issue 活跃度、安装复杂度。
- [ ] 去重只做 URL 级，没有标题 / 描述 / 标签的语义合并。
- [ ] GitHub 分类是关键词启发式，不是相关度模型。
- [ ] DeepSeek 结果按输入哈希缓存，但**没有成本统计、Prompt 版本号和人工纠错**。
- [ ] 事件上限 5000 条，超出丢弃最早的；没有按用户或按天分片。
- [ ] Telegram 个人账号登录仍未配置 API ID/API Hash；公开频道路线已接入候选池和推荐排序，但只处理公开网页能看到的内容。
- [ ] 公开频道只有「每天最多一次」的本地调度，没有失败重试队列。
- [ ] 比较结果没有持久化；比较结论仍是规则优先「上手低」。
- [ ] 前端按钮选中态仍存在 `localStorage`，与事件记录是两套，可能出现「按钮亮着但画像里没有这条」。
- [x] 推荐排序不再只依赖来源返回顺序：候选池参与评分、硬规则降权和多样性重排。
- [x] 候选池、事件、暂存、AI 缓存已落到 `data/openradar.sqlite`（`server/store.ts`），启动时从旧 JSON 迁移。
- [x] `rss` 曾在来源登记表中虚标为 ready，已改为 coming_soon 并写明「目前还没有抓取代码」。

### 3.3 尚未开始

- [ ] Telegram 初次历史回看策略（先 100～200 条，消息多的频道允许扩大到 500+）还没有正式跑。
- [ ] 来源级「少量先看 / 大量先暂存 / 用户不感兴趣后不再推荐」策略。
- [ ] RSS、Hacker News、Product Hunt 等来源连接器（接口已就绪，见第 12 节）。
- [ ] 推送任务：按分类、兴趣、新鲜度和来源可信度生成摘要，而不是把新项目一次全推。
- [ ] 图片、频道截图、帖子媒体的稳健提取。
- [ ] Docker、云部署、自动化运行。
- [ ] 多用户、权限与隐私设置。
- [ ] **浏览器手动验证**：第 5.4 节的清单至今没有任何人执行过，所有验证都停在接口层。

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

`npm run check` 运行**三套**纯离线自检：候选池（`check-connectors.ts`，19 项）、评分（`check-recommend.ts`，44 项）、分析队列（`check-analysis.ts`，40 项），合计 103 项。覆盖 canonicalUrl 归一化、跨批去重、候选到卡片往返、兴趣画像加权、六个评分维度、硬规则降权、多样性重排、状态单向合并、分析队列的批次/续跑/dryRun/错误处理。它不联网、不读 `.env`、不写 `data/`，改动连接器、去重、事件权重、评分或分析逻辑后必须运行。

`npm run smoke` 是接口级冒烟测试，需要一个已经跑起来的 API：

```powershell
npm run smoke                          # 默认打 http://127.0.0.1:8787
npm run smoke -- http://127.0.0.1:8799 # 或指定地址
npm run smoke -- --force               # 明知没隔离也要跑（会污染真实数据）
```

它会真实抓一次 GitHub、真的往候选池和行为事件里写东西。**它现在有硬门禁**：目标实例的 `/api/health` 报 `isolated: false` 时直接拒绝执行（退出码 2）并打印正确用法。所以正确流程是先把数据目录隔离再起服务：

```powershell
$env:PORT='8799'; $env:OPENRADAR_DATA_DIR="$env:TEMP\openradar-smoke-data"
npm run start
# 另开一个终端
npm run smoke -- http://127.0.0.1:8799
```

冒烟测试比对的是「本次新增的差值」而不是绝对值，所以可以重复运行而结果稳定。

`OPENRADAR_DATA_DIR` 现在是**全模块生效**的通用数据目录开关（`server/store.ts` 的 `resolveDataDir()` 是唯一来源），候选池、行为事件、暂存区、GitHub 会话、Telegram 状态都会跟着走。这一点在 2026-09-29 之前是坏的，见 17.8 节。

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
- [ ] 移动端下新增的画像弹窗（`.profile-lines`）和透明度说明（`.reason-breakdown`）不溢出；这两处用了 `minmax(0, 1fr)`，但**还没有人真的在窄屏上看过**。
- [ ] 浏览器 Console 没有应用错误。

### 5.5 当前已知验证结果

最近一次（分析队列、限流回填与隔离修复之后）在本机实测：

- `npm run build`：通过。
- `npm run lint`：通过（0 warning / 0 error，27 个文件）。
- `npm run check`：三套离线用例全部通过 —— 候选池 19 项 + 评分 44 项 + 分析队列 40 项（合计 103 项）。
- `npm run smoke`：32 项通过、2 项 SKIP、0 失败。两个 SKIP 都是如实跳过：候选池只有一个来源时无法验证来源多样性；没有 `DEEPSEEK_API_KEY` 时无法验证真实分析写回。
- **隔离门禁实测**：对未隔离的实例跑 `npm run smoke` 会以退出码 2 拒绝执行并打印正确用法；对设了 `OPENRADAR_DATA_DIR` 的实例正常跑完。
- **隔离修复实测**：修复前，隔离实例报出真实数据的 99 个候选；修复后隔离实例报 0 个候选，写入只落在临时目录，真实库在测试前后保持 `99 候选 / 1 事件` 不变。
- `/api/health`：返回 `{ ok, service, isolated }`。
- `/api/analysis/status`：真实数据下报告 `total=99, analyzed=0, needsAnalysis=99`，其中 telegram 53 / github 46。
- `/api/analysis/run`：不传 `dryRun` 时返回 `dryRun: true, applied: 0`，不写任何数据。
- `/api/sources`：返回 7 条来源描述，并附带 `connectors` 自检结果。
- `/api/profile`：没有行为时 `hasProfile=false`，明确说明“还没有足够的偏好信号”。
- 兴趣画像加权：`文件工具 = 11`（save 4 + save 4 + like 3）、`本地运行 = 4`、`AI 工具 = -2`（skip）。
- `/api/recommend`：第一张是全局最高分；同标签最长连续 2 张。
- `/api/discover/github`：返回 24 个候选，重复请求 `added=0`。
- Telegram 个人账号：`/api/telegram/config` 仍是 `configured: false`（没有 API ID/API Hash）；公开频道路线可用且已接入候选池。
- DeepSeek：未配置 Key。

**尚未完成**：真实 DeepSeek 分析已跑通（见 5.6），但浏览器交互验证只做了下面 5.6 节列出的部分；第 5.4 节里剩下的条目（GitHub 登录态、Telegram 弹窗、图片失败后备、我的收藏页、从链接导入）还没有实测。

### 5.6 浏览器交互验证（2026-09-29 首次执行）

这一节以前一直写着「至今无人执行」。现在用 **Chrome DevTools Protocol** 跑了一遍真实点击，14 项全过：

| 验证项 | 结果 |
|---|---|
| 首屏渲染卡片、无白屏 | 15 张侧卡 |
| 点「看详情」打开详情弹窗且有标题 | 通过 |
| 点喜欢后选中态变化 + 写入 localStorage | 1 → 2，localStorage 1 条 |
| 搜索能过滤结果 | 15 → 3 |
| 点跳过会移走卡片 | 15 → 14 |
| 加入比较后出现比较台 | 通过 |
| 能打开横向比较弹窗 | 通过 |
| 比较表 5 行 + 中文结论 | 「如果你想先选一个不费劲的，建议从 metamask-extension 开始…」 |
| 能打开兴趣画像弹窗且内容真实 | 浏览器插件（+3）、效率工具（+3）… 来源 github / telegram |
| 探索能返回并展示项目 | 29 张 |
| Console 无应用错误 | 通过 |

**顺带修掉的一个过期文案**：画像弹窗的隐私说明写的是 `data/events.json`，但事件早已迁到 `data/openradar.sqlite`。用户看得见的地方写着不存在的文件路径，属于该改的。

**一个已知的 UX 取舍**：为了修好侧边卡片的按钮折行，把「比较」从侧边卡片移走了（只在详情弹窗和主卡上）。所以要比较两个项目，现在得点「看详情 → 加入比较」，比以前多一步。如果实际用起来觉得别扭，可以把比较做成卡片上的第五个图标，但那时要重新考虑图标行会不会又挤。

**方法**：`--headless` 截图 + CDP `Runtime.evaluate` 点击 + `Page.captureScreenshot`。这套办法不依赖任何第三方包（Node 24 自带 `fetch` 和 `WebSocket`），以后改 UI 都应该先这样自己看一遍再交给用户。

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
- **2026-09-29 版式调整**：整条流改成「主卡通栏 + 其余卡片两列网格」。卡片图片一律放在上方，按 GitHub OG 图的原生比例（1200×630）显示，用 `object-fit: contain`。侧边卡片的操作行只保留 4 个图标 + 看详情 + 打开链接，比较和找相似只在详情弹窗里。
- 图片容器**绝对不要设 `min-height`**：`aspect-ratio` 配上一个确定高度会反推出宽度（470 × 1200/630 = 894px），而网格列的 `minmax(0, …)` 只管轨道不管项目，图片会溢出所在列并盖住旁边的文字。这个坑实际踩过，见第 20.5 节。
- 详情弹窗显示场景、摘要、推荐理由、上手难度、使用价值、项目属性、标签、**「这张卡片是怎么来的」**和操作。
- 比较弹窗当前比较：一句话理解、适合场景、上手难度、价值判断、项目属性。
- 当前比较结论只是优先选择「上手低」的项目，不是 AI 结论。
- 来自候选池排序的卡片，`why` 会被替换成评分算出的个性化理由（例如「你之前点过『文件工具』方向的项目，它和它相邻」），不再使用通用文案。
- 卡片操作行有四个图标按钮：喜欢、收藏、GitHub Star、**跳过**。跳过会从当前列表移走该项目，服务端只降权、不永久删除。
- 「不再推荐这类」放在详情弹窗里，不放在卡片上——避免把小卡片塞满按钮。
- **已知的密度取舍**：操作行从 3 个图标变成 4 个之后，窄屏上更容易折成两行。`.card-actions` 有 `flex-wrap: wrap`，所以不会横向溢出，但确实更挤。如果用户觉得卡片变杂，优先考虑在 ≤720px 时隐藏卡片上的「找相似」（详情弹窗里还有），而不是把图标缩小到 44px 触控目标以下。

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
{ "ok": true, "service": "openradar-api", "isolated": false }
```

`isolated` 表示这个实例是否跑在隔离数据目录里（设了 `OPENRADAR_DATA_DIR`）。

**`npm run smoke` 会用它当硬门禁**：`isolated: false` 时直接拒绝执行，因为冒烟脚本会真的往候选池和行为事件里写测试数据。这条规则是一次真实事故换来的，见 17.8 节。

#### `GET /api/sources`

返回 `{ sources, connectors }`。`sources` 是用户可见的来源登记表，`connectors` 是连接器自检结果，用来对账“登记为可用但实际没有代码”的情况。目前包括：

| id | 来源 | 当前状态 | 说明 |
|---|---|---|---|
| `github-stars` | 我的 GitHub Star | ready | 已实现 |
| `github-discovery` | GitHub 新项目 | ready | 已实现 |
| `rss` | RSS / 网站 | coming_soon | 接口已就绪但没有抓取代码，已从虚标的 ready 改正 |
| `hacker-news` | Hacker News | coming_soon | 尚未实现 |
| `product-hunt` | Product Hunt | needs_config | 需要 API 配置 |
| `telegram` | 纸飞机频道 / 资源群 | needs_config | 个人账号 QR 连接骨架，需要 API ID/API Hash |
| `telegram-public` | 纸飞机公开频道 | needs_config | 公开网页读取连接器；配置频道后 ready，不需要 Telegram API |
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

### 8.3 分析队列（2026-09-29 新增）

候选池有积压时，不能用一次请求把上千条送给 DeepSeek。分析队列把这件事拆成有界、可续跑、可干跑的三步。

#### `GET /api/analysis/status`

只读，不发任何请求。`configured: false` 时**仍然**会列出 `nextBatch`，方便先看清工作量再决定要不要配 Key。

```json
{
  "configured": false,
  "provider": "deepseek",
  "model": "deepseek-chat",
  "backlog": {
    "total": 99, "analyzed": 0, "needsAnalysis": 99, "notEligible": 0,
    "bySourceKind": { "telegram": { "total": 53, "analyzed": 0, "needsAnalysis": 53 } }
  },
  "nextBatch": [
    { "id": "telegram-code_stars-16051-1338539251", "title": "whiteboard", "sourceKind": "telegram", "sourceId": "telegram-public:code_stars" }
  ]
}
```

#### `POST /api/analysis/run`

请求体：`{ "limit"?: 1-8, "dryRun"?: boolean }`。

**默认 `dryRun: true`** —— 必须显式传 `"dryRun": false` 才会真的调用 DeepSeek 并写回。误触接口不应该消耗额度或改数据。

```json
{
  "configured": true, "dryRun": false,
  "attempted": 6, "applied": 6, "unmatched": 0, "skipped": 0,
  "remaining": 93, "batchSizeLimit": 6,
  "ids": ["github-123", "telegram-..."],
  "error": "可选：调用失败时的中文原因"
}
```

状态约定（`server/analysis.ts`，由 `server/check-analysis.ts` 的 40 项用例覆盖）：

| 情况 | 行为 |
|---|---|
| 拿到 AI 结果 | 写回 `metadata.aiPatch` + `metadata.analyzedAt`，状态置 `analyzed` |
| 调用成功但某条没返回结果 | 也标记 `analyzed`（记 `analysisSkipped`），否则它会永远堵在队首 |
| 调用抛错 | **什么都不标记**，整批留给下次重试 |
| 没有配置 DeepSeek | **什么都不标记**，只报告 `configured: false` |
| `dryRun` | 只列出 `ids`，不改任何数据 |

「已分析」判定看 `metadata.analyzedAt`（或旧数据的 `metadata.aiPatch`），而不是只看 `status`——因为 `status` 会被连接器的重新同步影响。

### 8.4 AI

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

### 8.5 GitHub

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

### 8.6 Telegram

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

### 8.7 API 错误约定

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

**2026-09-29 加入的硬约束**（对应 `server/ai.ts` 的 system prompt，版本 `v3`）：

- 只能依据输入里的 `description` 和 `metadata` 写卡片，**不得从仓库名、owner 名或组织名推断功能**。
- owner 名只是账号名，不代表公司或质量背书；除非 description 明确写了，否则不许出现「某公司开源」这类来源描述。
- `description_missing` 为 true 时不许编造：标题写成「仓库名 + 暂时看不出用途」，摘要第一句必须是「仓库没有提供说明，需要打开链接确认」，tags 只给「信息有限」加两个中性词。
- 不许添加原文没有的具体数字、量级词（如「千亿级」）、平台支持或功能承诺。
- 课程作业、题目集、资源列表、索引和基础设施仓库要如实标注类别，不要包装成能直接用的工具。

输入字段名也是约束的一部分：以前叫 `existing_summary`，模型会当成「已写好的摘要」去润色；现在直接用 `description` + `description_missing`，把「事实」和「要它补的东西」分开。

**改 prompt 必须同时改 `PROMPT_VERSION`**，否则缓存命中旧结果、且已标 `analyzed` 的候选不会重算——等于白改。详见 20.5 节的记录。

### 10.3 后续必须补的能力

- [x] Prompt 版本号（`PROMPT_VERSION`，写进 `metadata.analysisVersion`，版本不一致自动重算）。
- [x] 项目卡片缓存（`ai_cache`，按输入哈希）。
- [x] 空字段、非法 JSON 的容错。
- [ ] 输入项目字段和输出字段校验（目前只校验 id / title / summary 存在）。
- [ ] 单次调用 token 和费用记录。
- [ ] 失败重试次数上限（现在靠调用方重试）。
- [ ] 用户反馈修正：用户点「不像我」后不要直接把 AI 文案当事实。
- [ ] 允许用户选择「直白 / 技术 / 简短」解释风格。

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

不要一上来抓全量频道。当前已经落地“我的公开来源”配置，运行时文件为 `data/telegram-web/channels.json`：

```text
来源名称
频道链接或用户名
启用 / 暂停
是否只读取新消息
是否允许媒体图片作为卡片图片
关键词排除
最后抓取时间
```

当前公开网页路线只接入公开频道，第一版只读取文本和公开链接：

1. 解析频道用户名/链接，去重后保存配置。
2. 使用 `https://t.me/s/<频道>` 公开网页预览；不使用 API、Cookie 或登录会话。
3. 以 `data/telegram-web/state.json` 中的 `lastMessageId` 为游标，只读取新增消息。
4. 提取 GitHub URL，兼容正文单独成行的 `owner/repo` 写法；V0.6 先把 GitHub 作为可渲染候选，非 GitHub 链接暂存为后续扩展。
5. 用 canonical URL 去重；相同仓库从多个频道或 GitHub 发现时合并来源记录。
6. 记录原始来源频道、消息 ID、发布时间、浏览量、图片和原文。
7. 调用 GitHub 元数据抓取，转换成统一 `Candidate`；候选的 `sourceKind` 为 `telegram`，`sourceId` 为 `telegram-public:<username>`。
8. 放入候选池，走现有推荐评分；DeepSeek 通过现有 `/api/ai/enrich` 按需补中文卡片，不把 AI 调用写死在抓取循环中。
9. 手动同步和本地调度共用同一套函数，默认 24 小时最多一次；服务器重启时只在到期后补跑。

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

### 11.5 公开网页读取路线（已实现）

由于 Telegram 应用创建页面暂时无法生成 API ID/API Hash，项目先增加了不需要登录的公开频道路线：

```powershell
npm run telegram:read -- @telegram --limit 20
```

实现文件：

- `scripts/telegram-public-reader.mjs`
- `server/connectors/telegram-public.ts`
- `docs/telegram-web-reader.md`
- `package.json` 中的 `telegram:read` 脚本

读取内容来自 Telegram 的公开网页预览 `https://t.me/s/<channel>`，不读取浏览器 Cookie，不读取私有频道。输出结构已经包含 `channel`、`messages`、消息链接、时间、正文、图片、浏览量和正文中出现的外部链接，默认保存到 `data/telegram-web/<channel>.json`。

脚本仍然只负责一次性导出 JSON；正式服务路径由 `server/connectors/telegram-public.ts` 负责。当前真实验证过 `@telegram` 和 `@GithubCOTV`；后者是“极客资源仓库”，可以读取正文、图片和浏览量，并把正文中单独成行的 `owner/repo` 自动补成 GitHub 仓库 URL。分页读取 25 条也已验证成功。

用户在 `C:\Users\rog\Desktop\频道.txt` 提供了一批频道链接，后续又补充了一批英文和 FOSS / Self-hosted 频道，当前运行配置共 41 个用户名。新增频道按四组记录：`radar`（GitHub 大范围雷达）、`curated`（人工筛选项目）、`selfHosted`（可自托管和 Homelab）、`fossMedia`（FOSS / Linux / Android 媒体）。**只写入配置，没有启动几百条历史回看。** 后续首次回看策略：默认先取 100～200 条；消息密集的频道可人工提高到 500 或更多；消息少的频道只取最近十几条并交给去重层。这个策略要等候选池持久化后再做，不要把几百条原始消息直接塞进首页。

当前服务接口：

```text
GET  /api/telegram/public/status
PUT  /api/telegram/public/channels  { channels: string[] }
POST /api/telegram/public/sync      { channels?: string[], limit?: number, pages?: number }
```

公开频道只是补充来源。GitHub 公开搜索、用户 Star 和未来的开源目录仍是主体；频道里的介绍文案可以帮助 DeepSeek 理解“这个工具解决什么问题”，但不能把频道的 Star、夸张描述直接当成事实。

---

## 12. 来源连接器的统一接口（已落地）

GitHub 是第一个参考实现，接口已经真实存在于 `server/connectors/types.ts`，不再是“未来建议”。后续来源不要继续把逻辑堆到 `server/index.ts`，照着 `github.ts` 的形状写：

```text
server/connectors/
├── types.ts            # 已存在：Candidate / SourceConnector / ToolCard
├── index.ts            # 已存在：连接器注册表与自检汇总
├── github.ts           # 已存在：参考实现
├── telegram-public.ts  # 已存在：公开频道网页、增量游标和候选转换
├── telegram.ts         # 已存在：个人账号 QR 登录代理（需要 API ID/API Hash）
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
- **不要使用 `git add -A` / `git add .`。** 必须按文件路径显式 `git add <路径>`。这条是 2026-09-28 实际踩过的坑，见下面的真实事故记录。

#### 真实事故：2026-09-28 两个代理同时改同一个仓库

当天 Codex 和另一个代理**同时在 `openradar-personal` 里工作**（进程列表里能看到 `codex-quota.js --attach`）。另一个代理当时正在新增 `scripts/telegram-public-reader.mjs`、往 `package.json` 加 `telegram:read` 脚本、往 `README.md` 加说明。

后果：另一个代理在 `git add -A` 之后、`git commit` 之前又写了文件，于是它的**未完成工作被卷进了不属于它的提交** `e83a015`（提交信息是「修正手册里两处过期的验证数字」，实际却包含了一个 251 行的 Telegram 读取脚本）。

教训：

- `git add -A` 在任何可能并行的仓库里都是危险动作。它会把别人正在写的文件当成你的改动提交。
- 提交前用 `git status --short` 再看一眼**暂存清单**，确认每一行都是你自己改的。看到不认识的路径要停下来问，而不是顺手提交。
- 在这份手册里，未提交的改动**不代表没人负责**，它可能正在被另一个代理写着。不要清理、不要覆盖、不要回滚不属于你的未提交改动。
- 真要并行，先按 4.3 节的流程各自开分支，并约定好文件所有权（15.3 节）。同一分支上并行提交必然会互相卷。

---

## 16. 建议的后续开发优先级

### P0：先把推荐系统从“演示”变成“可持续使用”

1. [x] 建立 `Candidate` 和统一来源连接器接口。（2026-09-28 完成）
2. [x] 把 GitHub 结果纳入候选池，而不是直接覆盖 `tools`。（2026-09-28 完成，池在内存里）
3. [x] 增加 `view / like / save / star / compare / similar / skip / dismiss` 行为事件。（2026-09-28 完成，写入 `data/events.json`）
4. [x] 做第一版可解释的兴趣评分，并在卡片和详情里展示理由。（2026-09-28 完成）
5. [x] 让候选池真正参与排序与多样性重排。（2026-09-28 完成，见 `GET /api/recommend`）
6. [x] 让“继续刷”能够加载下一批结果，并把候选池从内存换成 SQLite。（2026-09-29 完成第一版，`GET /api/feed` + `data/openradar.sqlite`）

P0 的六项都完成了。下一步是 **P0-7：把积压真正分析完**——分析队列（`server/analysis.ts`）和接口都已经写好并通过 40 项离线用例，但**一次真实 DeepSeek 调用都没跑过**，因为本机没有 `DEEPSEEK_API_KEY`。现在候选池 99 个、已分析 0 个。

配好 Key 后的顺序：先 `GET /api/analysis/status` 看清工作量 → `POST /api/analysis/run`（不传 `dryRun`，默认就是计划模式）看它会处理哪些 → 传 `"dryRun": false, "limit": 2` 小批试跑，确认写回和缓存都对 → 再逐步放量。**不要一次把 99 个甚至上千条送出去。**

**开工前先看这条**：本机 Node 是 `v24.11.1`，内置的 `node:sqlite` 可用（`DatabaseSync` / `StatementSync`）。所以持久化**不需要引入 `better-sqlite3` 之类的原生依赖**。代价是 Node 目前仍把 `node:sqlite` 标为 experimental（启动时会有 `ExperimentalWarning`），API 未来可能变。已经按这个建议把数据库访问全部收在 `server/store.ts`，换库只改一个文件。

**数据目录规则（2026-09-29 修正）**：所有模块必须用 `server/store.ts` 导出的 `resolveDataDir()`，**不要自己拼 `path.join(projectDir, 'data')`**。曾经有四个模块各写一份硬编码路径，导致 `OPENRADAR_DATA_DIR` 隔离形同虚设，详见 17.8 节。

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
- **推荐理由不能说假话。** 来源解释必须按 `sourceId` 精确对应，不能按可信度数值分档。提示语里不要声称任何代码没有验证过的关系（例如「因为你收藏过类似项目」而实际上只是通用探索）。
- **实用价值只是粗略代理。** 它只用星数量级、有没有描述、有没有 topics，不能当成「这个工具好用」的结论。任何把它说成“质量分”的文案都是过度承诺。
- **样本极少时不要装作懂用户。** 一条 `like` 就能让某个标签排到最前。`hasProfile` 为 false 时必须走「还没有足够的偏好信号」分支，不要用一条事件推出来的画像去说服用户。
- **事件文件是隐私数据。** `data/events.json` 记录用户看过什么、跳过什么。它已被 `.gitignore` 整目录忽略，接口也不返回内部 id。新增接口时不要顺手把它暴露出去。
- **事件会无限增长。** 目前超过 5000 条丢最早的，且每批都整文件重写。事件多了以后写入会变慢，换 SQLite 时先处理这个。
- **`interestTags` 和 localStorage 可能不一致。** 按钮选中态看 localStorage，排序看事件。用户手改 localStorage 或换浏览器后，会出现「按钮亮着但画像里没有这条」的情况。
- **`npm run smoke` 会真的写候选池和事件。** 它现在有硬门禁：目标实例 `health.isolated` 为 false 时直接拒绝执行（退出码 2）。要打真实实例必须显式加 `--force`。

### 17.8 测试隔离事故：以为隔离了，其实没有（2026-09-29）

这是本项目到目前为止最值得记住的一个坑。

**症状**：用 `OPENRADAR_DATA_DIR` 指向临时目录启动 API，`/api/analysis/status` 却报告真实数据的 99 个候选；临时目录里只留下一个 45KB、表全空的 `openradar.sqlite`。

**根因**：只有 `server/store.ts` 认 `OPENRADAR_DATA_DIR`，而 `index.ts`、`staging.ts`、`telegram.ts`、`telegram-public.ts` 各自硬编码了 `path.join(projectDir, 'data')`。`index.ts` 又用这个硬编码路径去调 `enableCandidatePersistence(data/candidates.json)`，于是候选池、GitHub 会话、Telegram 状态全部指向真实数据。那个 45KB 的空库是某个模块提前懒加载 `db()` 时按环境变量建出来的，随后就被 `configureStore()` 切走了——所以**看起来**临时目录里有库，实际上一次都没用上。

**实际损失**（都已确认）：

- 真实候选池里 46 个 `github-discovery` 候选全部来自测试跑（时间戳 01:01Z 与 01:56Z 两次，正好对应两次冒烟）。
- 真实事件表 11 条里有 10 条是 `smoke-*` 测试事件，它们会真实影响兴趣画像和推荐排序。**已删除这 10 条**（你唯一的一条真实 `like` 保留）。清理前的库备份在 `%TEMP%\openradar-backup-before-clean.sqlite`。
- 46 个候选**没有删**：它们是真实存在的仓库，属于这个产品本来就该积累的内容。

**修复**：

1. `server/store.ts` 导出唯一的 `resolveDataDir()`，所有模块都改用它，不再各自拼路径。
2. `/api/health` 增加 `isolated` 字段。
3. `npm run smoke` 在 `isolated: false` 时拒绝执行。

**教训**：

- 隔离只有在**所有**读写路径都遵守它时才算隔离。一个模块漏掉，整套隔离就是假的，而且失败方式非常隐蔽——它不会报错，只会安静地写错地方。
- 声明「用环境变量隔离测试数据」之后，必须**实际验证**：起一个隔离实例，看它读到的数据是不是空的，再对比真实数据有没有变化。本轮就是靠对比真实库的 `99/11` 前后一致才确认修复生效。
- 任何会写数据的测试脚本，都应该自己带上「目标不对就拒绝跑」的门禁，而不是依赖操作者记得设环境变量。

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
4. 运行 `npm run build`、`npm run lint` 和 `npm run check`（三套共 103 项离线用例），确认基线。
5. 检查 `/api/health`、`/api/sources`、`/api/candidates`、`/api/analysis/status`、`/api/profile`、`/api/feed` 和 `/api/ai/config`。
6. 不读取或打印 `.env` 的真实值；也不要读或粘贴 `data/` 下任何文件（`openradar.sqlite` 里有行为事件和频道原文）。
7. 跑 `npm run smoke` 前先把数据目录隔离（`$env:OPENRADAR_DATA_DIR`）。脚本会自己检查并拒绝打未隔离的实例，但**不要因此依赖它**——先隔离再跑才是正常姿势。
8. 看清用户当前优先级：个人工具发现、中文、简单、视觉化、可持续推荐；后台可以积累一两千个项目，但首页只展示当前最值得看的一批。
9. 如果任务涉及新来源，先设计 Candidate 和去重字段，再写抓取代码；接口和参考实现都已经在 `server/connectors/`。
10. 如果任务涉及数据目录或持久化，先读 17.8 节，不要新增第二份数据路径计算。
11. 如果任务涉及 UI，先保持“频道编辑流”方向，不要改成后台仪表盘。
12. 完成后更新本文第 3 节、第 16 节和第 20.5 节。

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

个人账号 QR 登录仍保留为后续路线；由于 Telegram 创建 API 应用页面出现外部 ERROR，先采用不需要凭证的公开网页预览路线，不让外部阻塞拖住来源建设。

### 2026-09-28：公开频道从脚本升级为正式补充来源

用户提供了一批频道链接，希望 GitHub 和其他开源社区做主体、Telegram 频道做补充；系统不要一开始抓几百条把推荐流淹没，而是先保存来源，后续按频道消息量决定首次回看范围，并通过“新增消息游标 + URL 去重 + 候选池”慢慢积累。

本轮实现：

- `server/connectors/telegram-public.ts`：公开网页读取、分页、`lastMessageId` 增量状态、GitHub 链接抽取、仓库元数据补充、Candidate 转换。
- `data/telegram-web/channels.json`：本机频道配置；已从桌面 `频道.txt` 和后续补充整理 41 个公开频道用户名，并按雷达、精选、Self-hosted、FOSS 媒体分组；没有自动执行大批量历史同步。
- `data/telegram-web/state.json`：运行时游标和同步状态，整个 `data/` 不提交仓库。
- `GET /api/telegram/public/status`、`PUT /api/telegram/public/channels`、`POST /api/telegram/public/sync`：配置、查看状态和手动同步。
- `TelegramDialog` 增加“添加公开频道”区域；可以只保存而不读取，手动读取按钮按每频道最多 10 条执行；首次同步必须手动点击，之后自动调度默认每 24 小时最多一次，启动时仅在到期后补跑。
- `server/check-connectors.ts` 增加 Telegram 纯函数解析用例；`npm run build`、`npm run lint`、`npm run check` 均通过。

刻意没有做的事：没有读取私有聊天、没有读取浏览器 Cookie、没有自动回看五六百条、没有把频道的夸张文案当成事实、没有把非 GitHub 链接强行渲染成 GitHub 卡片。下一步应先做候选池持久化和“暂存区”，再实现按消息量分层的历史回看。

### 2026-09-28：候选池先增加可恢复存储

在正式批量抓取前，先把服务端候选池从“只存在内存”改为可恢复的本地 JSON：`server/index.ts` 启动时调用 `enableCandidatePersistence()` 读取 `data/candidates.json`，每次 `upsertCandidates` 后原子写回。`server/check-connectors.ts` 等离线检查不启用持久化，因此不会把测试候选写进用户数据。SQLite 仍是后续方向；下一步是在这个入口上增加原始消息表和暂存状态，而不是让批量抓取直接进入首页。

### 2026-09-28：增加原始消息暂存区和广告过滤

批量抓取前先建立 `server/staging.ts`。Telegram 新消息会先写入 `data/staging.json`，保留频道、消息 ID、原文、图片、浏览量和外链；只有非广告消息中的 GitHub 项目才进入候选池。VPN、机场、节点、优惠码、推广和赞助等常见广告模式标记为 `filtered`，不进入推荐。暂存状态为 `new / ready / dismissed / filtered`，接口为 `GET /api/staging` 和 `PATCH /api/staging/:id`。这是“批量读取不会直接污染首页”的第一版，后续再把暂存记录迁移到 SQLite，并接入 DeepSeek 分析队列。

### 2026-09-29：首次 41 个频道批量读取

按用户授权执行了首次分批读取：每个频道最多 100 条消息、最多 5 页，原始消息边读边写入暂存区。最终统计：41 个配置频道中 37 个成功读取，4 个没有公开网页预览（`heikeji_2025`、`xiaoshuwu`、`gitbig`、`watashinoAPPs`）；暂存 3227 条消息，其中 271 条被广告过滤，2956 条待处理；从首批可用 GitHub API 元数据中形成 53 个候选。

暂存消息中目前有约 1543 个去重后的 GitHub 链接。后续补全候选时需要使用 GitHub 登录令牌或等待匿名 API 限流恢复；本次批量读取没有丢失这些链接，原文和链接都在 `data/staging.json`。这次统计应作为后续“项目补全 / DeepSeek 分析队列”的输入基线。

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

### 2026-09-28：候选池持久化优先用内置 node:sqlite

本机 Node `v24.11.1` 内置 `node:sqlite`，P0-6 的持久化不需要新增原生依赖。倾向用它而不是 `better-sqlite3`：本地私人工具不值得为持久化引入原生编译和额外供应链。风险是它仍被标为 experimental，所以约定把数据库访问全部收在 `server/store.ts`，方便整体替换。这一条目前只是**倾向**，等真正动手时再作为决策确认。

### 2026-09-28：仓库里同时有第二个代理在工作

当天发现 `codex-quota.js --attach` 进程，说明 Codex 正在同一个仓库里并行开发。它新增了 `scripts/telegram-public-reader.mjs`（通过 `https://t.me/s/<频道>` 网页预览读取**公开**频道，不需要 API ID/API Hash、不登录、不读 Cookie），并往 `package.json` 加了 `telegram:read`。

这条对第 11 节有直接影响：**Telegram 的「外部阻塞」只阻塞了需要 API ID 的个人账号登录路线；公开频道的网页预览是另一条不需要凭证的路线。** 如果它可用，第 11 节和第 16 节 P1 的 Telegram 部分应当重新评估优先级，不一定非要等 `my.telegram.org` 恢复。

同时发生的协作事故：我的 `git add -A` 把对方正在写的文件卷进了提交 `e83a015`（提交信息与内容不符）。已把「禁止 `git add -A`」写进 15.7 节。**没有回滚对方的改动**——那是它正在进行的工作，未提交不等于没人负责。

### 2026-09-28：来源解释不能按可信度数值分档

来源可信度（`SOURCE_TRUST`）是排序用的数字，来源解释（`TRUST_REASON_CODES`）是给用户看的话，两者必须各自按 `sourceId` 精确对应。

第一版图省事用了 `trust >= 0.7` 兜底，导致 `github-discovery`（0.7）和 `github-similar`（0.75）落到同一档，于是**通用探索的卡片对用户说「这是从你感兴趣的项目延伸出来的」——凭空编造了一层和用户兴趣的关系**。这是实际跑通接口读输出时才发现的，不是推导出来的。

已改成按 `sourceId` 精确映射，并加了三条回归用例锁住它。这条值得记下来是因为它属于最危险的一类 bug：不报错、不崩溃、测试也能过，只是对用户说了假话。

### 2026-09-28：README 更新为项目入口

仓库已经推到 GitHub，README 是第一个被看到的东西，而它当时还写着「V0.1 前端原型」和一份过时的功能清单。已更新到 V0.6 的实际状态，并补上公开频道来源、校验命令、推荐公式和数据隐私说明。

### 2026-09-29：分析队列落地，并修掉两个会让它失效的 bug

**做了什么**：`server/analysis.ts` 把分析拆成「选批次 → 调分析器 → 回写与标记」三步，批次有界、可续跑、默认 dryRun，分析器可注入。这样没有 DeepSeek Key 也能验证队列本身（40 项离线用例）。

**为什么先修 bug 再写队列**：队列的核心承诺是「已分析的不重复做」，而当时有两个 bug 正好破坏这个承诺：

1. **`ready` 会把 `analyzed` 降级。** `repoToCandidate` 每次都带 `status: 'ready'`，而 `upsertCandidates` 的条件里有一条 `item.status === 'ready'` 就允许覆盖。于是每次重新同步（Telegram 每天一次、GitHub 探索随时）都会把已分析候选打回 `ready`，进度标记永远不可信。已改为单向合并 `mergeStatus()`：终态（`analyzed` / `dismissed`）不被普通状态降级。
2. **Telegram 候选的 AI 结果写不回池子。** `applyAiPatches` 只比对 `candidate.sourceItemId`，但前端回传的是卡片 id `github-<repoId>`。GitHub 候选两者恰好相同所以一直没暴露；Telegram 候选的 `sourceItemId` 是 `telegram-<频道>-<消息>-<repoId>`，于是它的 AI 结果**永远写不回去，刷新就丢**。已改为三种键都能匹配（`sourceItemId` / 卡片 id / `canonicalUrl`）。

这两条都属于「不报错、不崩溃、测试也能过」的静默错误，和 17.7 节记的来源解释编造关系是同一类。

**分析状态的判定**：用 `metadata.analyzedAt`（旧数据兼容 `metadata.aiPatch`）而不是只看 `status`。理由是 `status` 会被连接器覆盖，而 `metadata` 是合并写入的，更能代表「这个候选真的被分析过」。

**没有配置 Key 时坚决不标记。** `configured: false` 时队列只报告、不动数据。如果这里图省事把「没分析」记成「已分析」，队列会在用户毫无察觉的情况下空转完，而且再也补不回来。

### 2026-09-29：测试隔离必须实际验证，不能只靠声明

`OPENRADAR_DATA_DIR` 之前只有 `store.ts` 认，其余四个模块硬编码 `data/`，导致「隔离跑测试」实际写进了用户真实画像（46 个候选、10 条事件）。详见 17.8 节。

定下的规则：

1. 数据目录只能有一个来源：`store.ts` 导出的 `resolveDataDir()`，任何模块都不许自己拼 `projectDir/data`。
2. 会写数据的测试脚本必须自带门禁。`/api/health` 暴露 `isolated`，`npm run smoke` 在未隔离时拒绝执行（退出码 2），要打真实实例必须显式 `--force`。
3. **声明了隔离就要实测。** 验证方法是：起隔离实例，确认它读到的数据是空的，并对比真实库在测试前后完全一致。只看「临时目录里生成了一个 .sqlite」是不够的——那次就是空库躺在临时目录里，而真实数据在被读写。

---

## 20.5 本轮实现记录（2026-09-29）

### 2026-09-29：分析质量的三个问题和 prompt 版本号

跑完第一轮 99 条分析后，逐条看输出发现三个真问题（都不是崩溃，而是**对用户说了不准确的话**）：

1. **代理/订阅类内容漏过了过滤。** `Pawdroid/Free-servers`、`roosterkid/openproxylist` 这类「免费节点列表」拿到了很漂亮的中文卡片。原因：过滤只做在 **Telegram 消息正文** 上，而频道可能只丢了个链接、正文没提节点，仓库描述里却写满了「免费订阅 / 每小时更新」。补上仓库层面的过滤后，实际命中 **4 条**（比我肉眼扫到的 2 条更多）。
2. **空描述被编出了具体功能。** `pingdotgg/t3code` 的描述是空的，卡片却写「基于 TypeScript 的网页版 AI 编程环境，打开浏览器就能让 AI 帮你写代码」——**这是从仓库名和语言猜的**。同类 4 条。
3. **从 owner 名推断组织。** `Tencent/BrowserSkill` 被写成「腾讯出的」，而原文没提；owner 名只是账号名。

修法：

- 新增 `server/contentFilter.ts`，把过滤同时作用在消息正文和仓库描述两层，并配 `server/check-content-filter.ts`（20 项用例）。**反例和正例一样重要**：clash-verge-rev、sing-box、mitmproxy 这些代理类**软件**是正经工具，不能被误伤。顺带发现裸「节点」这个词太容易误伤（节点式编辑器、区块链节点、K8s 节点），改成只在带推广语境时才算数。
- prompt 里加了硬约束：只能依据给定 description 与 metadata；**不得从仓库名、owner 名推断功能或组织**；描述缺失时必须如实写「仓库没有提供说明，需要打开链接确认」，tags 只给「信息有限」加两个中性词；不得添加原文没有的数字、量级词和平台承诺。
- 输入字段从 `existing_summary` 改成显式的 `description` + `description_missing`，避免模型把空描述当成「已经写好的摘要」去润色。

**重算前后的实际对比**：

| 项目 | 之前 | 现在 |
|---|---|---|
| `t3code`（描述为空） | 基于 TypeScript 的网页版 AI 编程环境… | `t3code 暂时看不出用途` / 仓库没有提供说明，需要打开链接确认。 |
| `Tencent/BrowserSkill` | 腾讯出的浏览器自动化工具 | 通过命令行加扩展，让 AI 代理操作你真实登录的浏览器 |
| `Fission-AI/OpenSpec`（对照） | 让 AI 写代码前先写清楚规格说明 | 让 AI 写代码前先按规格来（没有退步） |

### 2026-09-29：改了 prompt 却不重算，等于没改

第一次改完 prompt 后，`/api/analysis/status` 仍然报「已分析 132、待分析 0」——**新 prompt 完全没生效**。

两个原因叠在一起：

1. **缓存键不含 prompt。** `cacheKey` 是 `tool-card:v2:` + 输入哈希。输入没变，缓存就命中，改了 prompt 也拿回旧结果。所以版本号必须跟 prompt 一起改（这次升到 `v3`）。
2. **「是否需要分析」只看 `metadata.analyzedAt`。** 候选一旦被标成已分析，就永远不再进入队列，跟缓存版本无关。

第 2 条才是根子：**这个设计让 prompt 永远无法升级**。修法是在写回时记下 `metadata.analysisVersion`，`analysisStateOf` 发现版本与当前 `promptVersion` 不一致就判为 `needsAnalysis`。现在改 prompt 会自动触发全量重算，不需要手动清标记。

已补三条回归用例锁住这个行为（当前版本算已分析 / 旧版本和无版本都要重算 / 批次会选出它们）。

**这条值得单独记下来**：凡是「结果被缓存起来 + 有用标记表示已完成」的系统，都必须把**产出这些结果的规则版本**一起持久化，否则规则升级就是空话。

### 2026-09-29：WAL 模式下只备份 .sqlite 会丢数据

排查时我 `Copy-Item data\openradar.sqlite` 做了个备份，后来发现它只包含 99 条候选，而当时真实池子里是 136 条。原因是 SQLite 开了 `journal_mode = WAL`：最近的写入还在 `openradar.sqlite-wal` 里，没有 checkpoint 到主文件，**只复制主文件等于丢掉了最新的事务**。

以后要备份这个库，要么连 `-wal` 和 `-shm` 一起复制，要么先执行一次 `PRAGMA wal_checkpoint(TRUNCATE)`。这次没造成损失（备份只是用来做前后对比），但结论要记住。

### 2026-09-29：卡片图片被裁成碎片，以及一次方向错误的排查

用户反馈「网页显示不完全」。**我第一次的判断是错的**：我以为原因是卡片操作行控件太多导致折行错位，凭宽度计算改了按钮排布——用户刷新后回复「基本没变」。

真正的根因是**图片裁切**。这个项目用 GitHub Open Graph 图当卡片主视觉，而 OG 图是 **1200×630 的横向 banner**；卡片原来的图片位是 **136×205 的竖长条**，配 `object-fit: cover` 会把图放大到 32%~75% 再横向裁掉约 65%，只剩中间一条。于是卡片上出现了 `seque`、`ter`、`Editor/`、`ehensive 2D content` 这种巨大的半截字母——**看起来就像文字被截断，实际是被裁掉的图片内容**。

修正：

- 图片一律放到卡片上方通栏，容器 `aspect-ratio: 1200/630`，`object-fit: contain`。比例和原图一致，所以既不留边也不裁切。
- 整条流从「左列主卡 / 右列卡片堆」改成「主卡通栏 + 其余卡片两列网格」。原来的排法在主卡固定高度、右列无限长时会留下大片空白，看起来也像没加载完。
- 图片容器不再设 `min-height`：`aspect-ratio` 加确定高度会反推宽度，导致图片溢出列并盖住文字（实际发生过，主卡标题被盖掉一半）。
- 元信息（语言 · Star 数）不再用省略号截断。

**方法上的教训（比这次 bug 本身更重要）**：

1. **能看就不要猜。** 前两轮我都在靠 CSS 宽度计算推断，方向错了还越改越自信。这台机器上有 Chrome，`--headless` 就能截图，**成本几乎为零**。发现方向不对时应该立刻去拿真实渲染，而不是再算一遍。
2. **`--window-size` 截图会骗人。** 它不等于布局视口：按 375px 截图时 Chrome 仍按桌面宽度排版，只截了左边 375px，看上去像横向溢出。**正确做法是用 CDP 的 `Emulation.setDeviceMetricsOverride`**，或者直接用 `Page.captureScreenshot`。
3. **布局要用测量而不是估算。** 最终用 CDP 在 320~1440px 共 13 个宽度上量了 `scrollWidth` 与关键元素尺寸，确认无横向溢出、图片框比例恒为 1.9、4 个图标在所有宽度下都是 1 行。这比任何计算都可靠。

### 2026-09-29（第二个代理接手）：分析队列、限流回填与隔离修复
接 Codex 的交接项 4 继续做，新增：

- `server/analysis.ts`：分析队列。批次有界（默认 6、上限 8）、可续跑、支持 `dryRun`、分析器可注入（所以没有 API Key 也能完整测）。
- `GET /api/analysis/status`、`POST /api/analysis/run`（**默认 dryRun**，必须显式传 `"dryRun": false` 才会真的调用）。
- `server/check-analysis.ts`：40 项离线用例，已并入 `npm run check`。
- GitHub 限流识别：`githubRequest` 现在读取 `x-ratelimit-remaining` / `x-ratelimit-reset` / `retry-after`，标出 `rateLimited`；`POST /api/github/backfill` 遇限流立即停止并返回 `rateLimitResetAt`，不再把限流算成项目失败。
- 修复两个会让分析队列失效的 bug（详见下面的决策记录）：`ready` 会把 `analyzed` 降级；Telegram 候选的 AI 结果永远写不回候选池。
- 修复测试隔离失效（17.8 节），`/api/health` 增加 `isolated`，`npm run smoke` 加硬门禁。

**没有做到的**：真实的 DeepSeek 调用一次都没验过（本机没有 Key）。队列逻辑用假分析器覆盖了，但「真的连上 DeepSeek 会不会按预期写回」仍然未知。接手的第一个动作应该是配 Key 后小批试跑。

### 2026-09-29：P0-6 SQLite、连续浏览和公开卡片契约

候选池、用户行为事件、Telegram 暂存和 DeepSeek 缓存已统一进入 `server/store.ts` 管理的 `data/openradar.sqlite`。首次启动会读取旧的 `candidates.json`、`events.json`、`staging.json` 并迁移，旧文件保留不删除。SQLite 使用 Node 24 内置的 `node:sqlite`，没有新增原生依赖。

> **更正（2026-09-29 晚）**：这一版原本写「`OPENRADAR_DATA_DIR` 仍可隔离测试数据」，**当时这句话是错的**。只有 `store.ts` 认这个变量，`index.ts` / `staging.ts` / `telegram.ts` / `telegram-public.ts` 都硬编码了 `data/`，所以候选池和会话实际读写的是用户真实数据。已修复，详见 17.8 节的事故记录。原文保留在上面是为了让后来的人看到「文档声明过、但代码没做到」这种偏差长什么样。

新增接口：`GET /api/feed?cursor=&limit=` 返回 ready/analyzed 候选和下一页游标；`POST /api/feedback` 记录产品化反馈；`GET /api/projects/:id/related` 统一相似项目入口；`POST /api/github/backfill` 回填 GitHub 限流期间留下的 pending 链接。首页“继续刷”已接入 feed，前端按游标合并且不重复显示。

公开卡片已经移除“为什么看到这个”“为什么给你看”和内部评分/理由字段。DeepSeek 仍负责标题、摘要、标签、难度和价值判断；分析结果按输入哈希缓存，并写回候选 metadata，后续页面刷新仍可使用。GitHub 限流时 Telegram 链接先保存为 pending，不阻塞同批其他频道。
### 给下一位 AI 的接手顺序

1. 先阅读 `server/store.ts`、`server/candidates.ts`、`server/events.ts`、`server/staging.ts`、`server/analysis.ts`，确认 SQLite 表、旧 JSON 迁移逻辑和分析队列的状态机。
2. 运行 `npm run build`、`npm run lint`、`npm run check`（现在是三套离线用例）。需要接口验证时先把 API 的 `OPENRADAR_DATA_DIR` 指向临时目录再起服务，然后 `npm run smoke -- http://127.0.0.1:8799`。**冒烟脚本会自己检查隔离，没隔离就拒绝跑**，所以不用再靠记性。
3. 当前真实运行数据在 `data/openradar.sqlite`（被 `.gitignore` 忽略）：暂存约 3227 条消息（2956 `new` / 271 `filtered`），候选池 99 个（46 个 GitHub 发现 + 53 个 Telegram），**已分析 0 个**，`ai_cache` 为空。
4. **下一步就是分析队列本身**：`server/analysis.ts` 和 `GET /api/analysis/status`、`POST /api/analysis/run` 已经写好并通过 40 项离线用例，但**从来没有对着真实的 DeepSeek 跑过一次**（本机没有 `DEEPSEEK_API_KEY`）。配好 Key 之后，先 `POST /api/analysis/run` 不传 `dryRun`（默认就是计划模式）看清会处理哪些，再传 `"dryRun": false` 小批（limit 2~4）试跑，确认写回和缓存都对，再逐步放量。不要一次把 99 个甚至上千条送出去。
5. 回填：`POST /api/github/backfill` 现在遇限流会提前停下并返回 `rateLimited` + `rateLimitResetAt`，不再把限流当成项目失败。没配 GitHub Token 时未认证额度只有 60 次/小时。当前 `pending` 为 0，等下一次 Telegram 同步撞上限流才会再出现。
6. 后续再增加真正的比较结果持久化、RSS/Hacker News 等来源和自动推送；不要把首页改成频道/分类数据后台。

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
