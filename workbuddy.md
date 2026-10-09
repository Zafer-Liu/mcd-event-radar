# WorkBuddy 开发记录

本项目（麦麦活动雷达 mcd-event-radar）的全部开发工作在腾讯 WorkBuddy 智能体中完成。本文件按赛事要求整理真实的 WorkBuddy 对话上下文摘录（已脱敏：不含 MCP Token、手机号等任何敏感信息），用于 WorkBuddy 专项奖励核验。

- 开发环境：WorkBuddy Agent 模式 + 本机 Node.js 20+（Windows）
- 开发时间：2026 年 10 月 9 日（两个 WorkBuddy 会话，北京时间 10:00—19:30）
- 声明：以下为真实对话的摘录与摘要，未编造内容；所有工具调用与验证产物均有本地记录可查。

## 会话一（2026-10-09 上午）：Skill 骨架与小白化

**用户**：查「附近有什么麦当劳活动」——这个 skill 连接器还没配置，帮我诊断并把它做好用，面向小白。

**WorkBuddy**：
- 走「ToolSearch 精确检索 7 个官方工具 → list_installed_plugins → 读 mcp.json」三级诊断，发现连接器未配置且 Skill 缺标准诊断路径，重写 SKILL.md：固化三级自检 + 「可用/已配置未生效/未配置」三态处理表 + 排障速查表。
- 新增 `check-connector.mjs` 连接器体检、抽出 `lib/mcp-client.mjs` 公共客户端；修正 `mcp-config.example.json` 的 `type` 大小写（streamablehttp → streamableHttp）。
- **重大发现**：官方文档与线上工具命名不一致——文档写 `query-partystore-date/session`，线上 tools/list 实测 35 个工具中为 `query-party-store-date/session`，全链路已按实测名修正。
- **在线验证**（用户提供真实 Token 后）：JSON-RPC 握手 HTTP 200，`serverInfo: mcd-mcp 1.0.0`；端到端实测上海 116 个可预约场次。

**用户**：要参赛，重构成小白三步走：Token 官方指南、一键配置脚本、允许位置获取。

**WorkBuddy**：v0.2.0——目录重构（scripts/ 移入 skill 包，zip 自包含）；新增 `setup-connector.mjs`（写前备份、保留其他服务器、在线验证、绝不打印 Token）与 `locate.mjs`（城市级 IP 定位，识别 VPN/代理出口并提示，本机实测正确识别新加坡出口）；SKILL.md 重写为「获取 Token → 贴 Token 自动配置 → Trust+启用+重开会话」，期间 live.mjs 兜底立即可用。

## 会话二（2026-10-09 下午）：HTML 卡通活动地图与价格核实

**用户**：查看我附近的活动

**WorkBuddy**：按 SKILL.md 三级自检判定「已配置未生效」，AskUserQuestion 确认城市=北京，live.mjs 直连官方 MCP 查询：未来 14 天 **620 个已核实可预约场次**（11 类活动），生成报告展示；期间发现 `radar.mjs --city 北京` 匹配不上数据里的「北京市」（精确匹配无归一化）。

**用户**：这个 skill 是为了参加比赛的，所以要保持可用、清晰。添加新的实现模式，生成 HTML 地图，而不是这种 MD 文档。

**用户**：我想要的是一个卡通式的类似地图就行。

**用户**：生成地图加上活动卡片，不要 MD 文档。

**WorkBuddy**：探查官方 MCP 原始返回，发现 `query-party-store` 自带 `address/latitude/longitude`（北京单商品即返回 365 家门店全带坐标）——卡通地图的门店位置因此可以用真实官方坐标投影。实现 v0.3.0：
- `live.mjs` 补采门店元数据（`stores`/`cityGeo`）；
- 新增 `lib/html-map.mjs`：自包含 HTML 卡通活动地图（门店小屋按官方经纬度投影、辖区色块、街道标签取自官方地址、活动卡片面板、日期/活动/状态筛选、门店↔卡片双向联动、零外部依赖离线可开）；
- `radar.mjs` 默认 `--format html`，新增 `--districts` 辖区示意标注，并修复城市归一化 bug；
- Playwright 无头浏览器实测：0 控制台错误、0 坏 SVG 属性，门店筛选（14 场）、周末+门店组合（4 场）、重置、卡片脉冲全部通过；期间定位并修复辖区标签 `translate(` 缺右括号的 bug（3 个辖区 = 3 个报错）。

**用户**：13800 单位待核实，这些单位待核实什么意思？

**WorkBuddy**：解释保守展示原因（接口只返回裸数字、官方未标注单位），随后用 `mall-product-detail` 同商品价格交叉核实：**11/11 商品倍率恒为 ×100**（如商城价 138 元 ↔ 场次价 13800），判定场次 `price` 单位为**分**。升级 v0.3.1：`live.mjs` 每次查询运行时自适应核验，一致则标注「单位分 + 约 ¥138」，不一致自动回退「单位待核实」；地图卡片显示「¥138 · 原始 13800 分」。北京复测 620/620 场次全部核实为分。

**用户**：升级 skill，按照比赛要求推送：（附比赛通知全文）

**WorkBuddy**：核对 M-China 官方 `activityGuidelines.md` 与 README 硬性要求 → 仓库安全审计（Token/凭证/手机号全仓库扫描；`CONTEST_DECLARATION.md` 与官方文件逐字节比对一致；`mcp-config.example.json` 仅含 `${MCD_MCP_TOKEN}` 环境变量占位符）→ 补齐本文件等参赛材料 → 发布 GitHub 公开仓库 → 按标准格式提交参赛 Issue。

## 使用的 WorkBuddy 能力

- Agent 模式：文件读写与代码生成（全部脚本为 WorkBuddy 编写/重构）、命令执行、任务清单管理、后台任务
- Skill 系统：mcd-event-radar（本仓库）
- 连接器/MCP：麦当劳官方 `mcd-mcp`（Streamable HTTP，Token 仅存本机 `~/.workbuddy/mcp.json`，未写入仓库）
- present_files 成品预览（HTML 地图即时报送预览）、AskUserQuestion 交互确认（城市确认等）
