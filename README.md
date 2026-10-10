<div align="center">

<img src="images/map-preview.png" width="880" alt="麦麦活动地图 · 北京实测效果" />

# 🍟 麦麦活动雷达 · McEvent Radar

**「这个周末，附近哪家麦麦有生日派对？哪家读书会还有名额？」**

一句话问出去，回来一张**卡通活动地图**——门店小屋站在麦当劳官方给的真实经纬度上，
活动卡片里只装**官方亲口确认还有名额**的场次。

<br>

[![MCP](https://img.shields.io/badge/MCD--MCP-35%20tools-DA291C.svg)](MCP_INTEGRATION.md)
[![Skill](https://img.shields.io/badge/WorkBuddy-Skill-FFC72C.svg)](skill/mcd-event-radar/SKILL.md)
[![Live Tested](https://img.shields.io/badge/realtime--verified-620%20sessions%20%C2%B7%20BJ-brightgreen.svg)](MCP_INTEGRATION.md#在线验证记录2026-10-09真实-token)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/live--demo-online-blueviolet.svg)](https://app-ezf35mw5oq9t.miaoda.online/map)

**🌐 [项目介绍主页](https://app-ezf35mw5oq9t.miaoda.online) · [在线演示地图（免安装，浏览器直接玩）](https://app-ezf35mw5oq9t.miaoda.online/map)**

*麦当劳程序员创意开发大赛参赛作品 · 基于麦当劳 MCP 的 Agent Skill · 全程使用 WorkBuddy 开发*

</div>

---

## 🧭 30 秒看懂

```
你：附近有什么麦当劳活动？

雷达：📡 扫描北京 · 未来 14 天
      ✅ 620 个可预约场次 · 11 类活动 · 10 家门店

      🗺️  [卡通活动地图]
          海淀区 · 北师大餐厅 ── 今天 17:30—19:30
              四小福豪华版生日派对  ¥88  余 12
          东城区 · 8 家门店连成一片 party 区 🎪

      🎯 离你最近的：北师大餐厅，天天都有四小福豪华版（¥88）
      📅 点一下「周六」，36 场任你挑
```

每一个数字都有出处：620 是官方接口实时返回的场次数，¥88 是和商城价核对过的价格，
「余 12」是官方接口的原始名额数——**雷达只转述，不编故事**。

---

## 🎬 演示视频（3 分 52 秒 · 完整跑一遍）

[![麦麦活动雷达演示视频](images/video-poster.jpg)](https://github.com/Zafer-Liu/mcd-event-radar/releases/download/demo-video/mcd-event-radar-demo.mp4)

> ▶ **[点击观看 / 下载视频（13.4 MB · 1080p）](https://github.com/Zafer-Liu/mcd-event-radar/releases/download/demo-video/mcd-event-radar-demo.mp4)**
> · 讨论见 [Issue #1](https://github.com/Zafer-Liu/mcd-event-radar/issues/1)
>
> GitHub 不支持在线播放视频，链接会**下载到本机**后用播放器观看；不想下载就先看
> [在线演示地图](https://app-ezf35mw5oq9t.miaoda.online/map)，浏览器里直接点。

视频里你能看到：一句话提问 → 城市确认 → 官方 MCP 实时扫描 → 卡通活动地图生成
→ 点日期/活动类型筛选 → 导出 `.ics` 日历，全程无剪辑、无假数据。

---

## 🚀 三步开吃

> **想先看效果？** 打开[在线演示地图](https://app-ezf35mw5oq9t.miaoda.online/map)：不用安装、不用 Token，在浏览器里直接点门店、筛日期、导出日历。
> 演示站的活动与场次为**虚构数据**（门店相对位置仍是真实经纬度投影），页面本身已明确标注；
> 真实数据请按下面三步接入自己的 Token。

### 第 1 步 · 把这句话发给 WorkBuddy

不用打开任何命令行——WorkBuddy 自己就会干活。复制下面这句，粘贴进 WorkBuddy 对话框，回车：

```text
帮我安装这个技能：https://github.com/Zafer-Liu/mcd-event-radar
把仓库里 skill/mcd-event-radar 文件夹复制到用户级技能目录（~/.workbuddy/skills/），
确认 SKILL.md 存在，装完提醒我重开一轮会话
```

它会自己下载、安装、验收。装好后**新开一轮会话**，进入第 2 步。

> **不想用对话装？** 两个替代方案，效果一样：
> - **图形界面**：下载本仓库的 `dist/mcd-event-radar-skill.zip`，
>   在 WorkBuddy「技能 → 添加技能 → 上传技能」里导入。
> - **命令行**（适合熟手，重复运行 = 更新；卸载 = 删掉 `~/.workbuddy/skills/mcd-event-radar` 文件夹）：
>
>   ```powershell
>   irm https://raw.githubusercontent.com/Zafer-Liu/mcd-event-radar/main/install.ps1 | iex
>   ```
>
>   ```bash
>   curl -fsSL https://raw.githubusercontent.com/Zafer-Liu/mcd-event-radar/main/install.sh | bash
>   ```

### 第 2 步 · 对它说一句话

> **「查附近的活动」**

它会先和你确认城市（支持自动定位，VPN 用户直接报城市名更稳），然后开扫。

### 第 3 步 · 贴一次 Token，以后一直免配置

第一次使用时，它会给你一个 1 分钟的官方 Token 申请指引
（[open.mcd.cn/mcp/doc](https://open.mcd.cn/mcp/doc) → 登录 → 控制台 → 激活 → 一键复制），
你把 Token 粘贴到对话里，**剩下的配置它自己完成**——自动备份、在线验证、绝不外传。

> ⚠️ Token 等同于你的账号凭证：只贴在自己的对话里，不要发群聊、朋友圈或 GitHub。

---

## 🗺️ 这张地图，哪些是真的？

| 你看到的 | 是真的吗 | 一句话解释 |
| --- | --- | --- |
| 🏠 门店小屋的位置 | ✅ 真 | 麦当劳官方接口返回的门店经纬度，直接投影到地图上 |
| 🛣️ 街道名字（东单北大街…） | ✅ 真 | 官方地址字段里的街道名 |
| 🎫 卡片上的「可预约」 | ✅ 真 | 官方场次接口亲口说还有名额，才算可预约 |
| 💰 卡片上的 ¥88 | ✅ 核实过 | 接口原始值 8800（单位是分），已和商城标价 88 元核对一致 |
| 🎪 彩色片区 / 道路 / 公园 | ⚠️ 示意 | 画得好看用的，页面明确标注「卡通示意图 · 非精确地图」 |
| 🟡 小屋头顶的数字 | ✅ 实时 | 当前筛选下这家店还有多少场，点日期立刻变 |

**不画假位置、不虚报名额、不瞎标价格**——这是本项目的底线，详见下方「数据诚实红线」。

顺手还能做：点活动类型的**色标**一键筛选、把当前筛选结果**导出成日历文件**（`.ics`，可直接导入手机日历；官方没给场次时间的会如实标成全天事件）；
门店小屋支持**键盘操作**（Tab 聚焦、回车筛选），系统开启「减少动态效果」时会自动关掉动画。

---

## 🧑‍🤝‍🧑 谁需要它

| 你是 | 你会问 |
| --- | --- |
| 有娃家庭 | 「周末带娃去哪家麦麦？生日派对/读书会哪场还有名额？」 |
| 活动型麦门 | 「麦麦奇妙夜捣蛋派对什么时候开？离我近吗？」 |
| 附近党 | 「别给我一堵文字墙，地图上指给我看哪家店最近」 |
| 谨慎型用户 | 「预约前我要看清活动、门店、场次、费用、名额依据」 |

---

## ❓ 小白常见问题

**Q：我的城市查不到活动？**
麦当劳主题活动只在部分城市/门店开放。可以换个城市、把日期范围拉长，或过几天再扫。

**Q：Token 是什么？安全吗？**
相当于一把只开你自己家门的钥匙。Skill 只把它写进你本机的 WorkBuddy 配置（写前自动备份），
不进仓库、不进日志、不在对话里回显。介意的话，随时可去官方平台重新申请作废旧的。

**Q：它会不会偷偷帮我下单？**
不会。默认只查询；真要预约，它会把活动、门店、日期、场次、人数、费用全部列出来，
**你逐项点头之后**才动手，付款也在麦当劳官方流程里由你自己完成。

**Q：地图能当导航用吗？**
不能。门店的相对位置是真的，但彩色片区和道路是卡通装饰，页面本身也标注了「非精确地图」。

**Q：装完没反应？**
重启 WorkBuddy 或新开一轮会话，再说「查附近的活动」。

---

# 🔬 给爱看细节的同学

以下是技术部分，普通用户不需要读。

## 四个实测发现（2026-10-09 真实 Token 联调，非文档推测）

**1️⃣ 官方文档的工具名和线上不一致** — 文档写 `query-partystore-date/session`，
线上 `tools/list` 实测为 `query-party-store-date/session`，本项目全部按实测名对接并写进自检。

**2️⃣ 场次价格的单位是「分」，且可自证** — 场次接口只给裸数字（如 `13800`）。
用 `mall-product-detail` 同商品价格交叉核实：**11/11 商品倍率恒 ×100**（商城 138 元 ↔ 场次 13800）。
这个核验已做进运行时：倍率对上才显示 ¥138，对不上自动回退「单位待核实」，官方改口径也不翻车。

**3️⃣ `leftNum` 恒为 12，疑似容量上限而非实时余量** — 上海 116 场、北京 620 场全部如此，
界面只转述原始值并注明，不吹「名额充足」。

**4️⃣ 门店坐标是官方接口自带的** — `query-party-store` 原始返回含
`address / latitude / longitude`（北京单商品即 365 家门店全带），这是地图敢用真实位置投影的底气。

> 完整联调记录：[MCP_INTEGRATION.md](MCP_INTEGRATION.md)

## 架构一句话

**Agent 编排 + 确定性脚本**：数字与数据链全部钉在零依赖 Node.js 脚本里（连接器自检、实时查询、
坐标投影、价格核验），LLM 只负责理解需求、执行流程和守护确认门控。

```text
用户一句话 → 城市确认 → 官方 MCP 核实链（商品→城市→门店→日期→场次）
          → 卡通地图（真实坐标投影 + 活动卡片） → 用户确认后才可预约
```

## 命令行进阶（零依赖，Node.js 20+）

```powershell
$env:MCD_MCP_TOKEN = Read-Host -MaskInput '麦当劳 MCP Token'
npm run live -- --city 北京 --output events.local.json   # 官方 MCP 实时查询（含门店坐标）
npm run radar -- --input events.local.json --city 北京    # 生成卡通活动地图（默认 HTML）
Remove-Item Env:\MCD_MCP_TOKEN
```

离线体验（无需 Token）：`node skill/mcd-event-radar/scripts/radar.mjs --input examples/sample-events.json --city 上海 --output demo.html`

## 数据诚实红线

- 查不到就说查不到，说明已查范围；不用搜索结果、模型记忆或示例数据冒充实时结果
- 活动日历 ≠ 预约名额：只有场次接口明确返回有名额才标「可预约」
- 价格展示原始值 + 运行时单位核验，核验不过不换算
- 门店无坐标就进「示意车道」并注明，不猜位置
- Token 只进本机配置，不进回复、示例、日志和本仓库

## 项目结构（精简版）

```
mcd-event-radar/
├── install.ps1 / install.sh      # 命令行安装脚本（备选路径，见第 1 步）
├── skill/mcd-event-radar/        # Skill 源码（SKILL.md + 6 个零依赖脚本）
├── dist/mcd-event-radar-skill.zip # 可直接导入 WorkBuddy 的 Skill 包
├── examples/sample-events.json   # 虚构演示数据（离线体验用，已标注）
└── images/                       # 北京实测截图 + 演示视频封面
```

## 参赛材料

| 要求 | 文件 |
| --- | --- |
| 项目介绍/安装/示例/目标用户 | 本 README |
| 介绍主页 + 在线演示地图 | [app-ezf35mw5oq9t.miaoda.online](https://app-ezf35mw5oq9t.miaoda.online)（介绍页 · [演示地图](https://app-ezf35mw5oq9t.miaoda.online/map)） |
| 作品演示视频（3 分 52 秒） | [Issue #1](https://github.com/Zafer-Liu/mcd-event-radar/issues/1) · [下载观看（13.4 MB）](https://github.com/Zafer-Liu/mcd-event-radar/releases/download/demo-video/mcd-event-radar-demo.mp4) |
| 参赛声明（官方原文未改动） | [CONTEST_DECLARATION.md](CONTEST_DECLARATION.md) |
| MCP 接入说明 | [MCP_INTEGRATION.md](MCP_INTEGRATION.md) |
| 脱敏 MCP 配置示例 | [mcp-config.example.json](mcp-config.example.json) |
| WorkBuddy 开发上下文 | [workbuddy.md](workbuddy.md) |

---

## License & 声明

[MIT](LICENSE) · 本项目为麦当劳程序员创意开发大赛参赛作品，由参赛者独立开发，非麦当劳官方产品。
活动、价格和名额均以麦当劳官方实时结果为准。
