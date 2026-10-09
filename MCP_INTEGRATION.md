# 麦当劳 MCP 接入说明

## 使用的服务

- 提供方：麦当劳中国
- 服务地址：`https://mcp.mcd.cn`
- 传输：Streamable HTTP
- 认证：`Authorization: Bearer <Token>`，Token 由用户在[麦当劳 MCP 开放平台](https://open.mcd.cn/mcp/doc)申请（登录 → 控制台 → 激活 → 一键复制）
- 接入客户端：WorkBuddy；项目另提供直接使用 Streamable HTTP 的 Node.js 命令行程序

WorkBuddy 侧由 Skill 内置的 `setup-connector.mjs` 一键完成配置：用户只需把 Token 贴进对话，脚本自动备份并写入 `~/.workbuddy/mcp.json`（保留其他服务器条目）、在线验证后提示「Trust → 启用 → 重开会话」。用户全程不编辑 JSON。仓库中的 [`mcp-config.example.json`](mcp-config.example.json) 只含环境变量占位符，不含凭证。

## 工具与业务价值

工具名以线上 `tools/list` 实际返回为准（2026-10-09 实测共 35 个；官方文档页对日期/场次两个工具的命名与其不一致，本表采用线上实测名）：

| 工具（线上实测名） | 本项目中的作用 | 边界 |
| --- | --- | --- |
| `campaign-calendar` | 发现本月活动线索 | 不代表某门店有预约名额 |
| `mall-points-products` | 按活动类目发现可预约的商品 | 返回的商品不代表用户城市有名额 |
| `mall-product-detail` | 获取商品 `spuId`、规格 `skuId`、说明等 | 不从标题猜测编码 |
| `query-party-city` | 确认主题活动覆盖的城市（含城市中心经纬度） | 使用商品列表实际返回的 `spuId` |
| `query-party-store` | 列出参与主题活动的门店，并返回门店元数据：名称、简称、详细地址、经纬度、营业状态 | 只展示工具实际返回的门店；经纬度仅用于地图相对位置投影 |
| `query-party-store-date` | 查某门店可预约日期 | 日期需与用户条件相交；文档写作 `query-partystore-date` |
| `query-party-store-session` | 查具体日期的场次与状态 | 仅据此标记「可预约」；文档写作 `query-partystore-session` |
| `party-order-create` | 用户确认后创建主题活动订单 | 默认不调用；不自动支付 |

官方工具的参数和返回结构可能变化。本项目不硬编码未经官方公布的字段名：WorkBuddy 在调用时读取连接器实际提供的工具 schema，按前一步的真实返回值传递必要标识；缺失字段时停止该分支并说明原因。

## 实际调用流程

```text
用户给出城市、日期、偏好（「附近」则先做城市级定位并经用户确认）
  ├─ campaign-calendar → 活动线索
  └─ mall-points-products → mall-product-detail → query-party-city
       → query-party-store → query-party-store-date
       → query-party-store-session → 已核实的可预约场次
  → 对齐条件、去重、标明来源与查询时间
  → 用户明确确认后，才可调用 party-order-create
```

`mall-points-products` 的官方活动类目为生日派对 `1>6>20`、主题派对 `1>6>21`、体验营 `1>6>22`、品鉴会 `1>6>25`、读书会 `1>6>34`。例如用户问「上海下周六下午有哪些活动」，Skill 将先取得活动商品的 `spuId` 和可用城市，再查询上海相关门店与日期，最后只将 `query-party-store-session` 明确返回 `leftNum > 0` 的场次标为「有名额」。如果只有活动日历结果，则显示「活动线索／待核实」，不生成虚假的门店、时间、价格或名额。价格字段的单位未核实时不擅自换算。

## 数据处理

Skill 在 WorkBuddy 对话中直接使用 MCP 工具结果，并在每次查询前自检连接器（工具检索 → 连接器列表 → 本地 `mcp.json`），未配置时走「申请 Token → 一键配置 → Trust 启用」的小白三步引导，而不是猜测结果。

- `setup-connector.mjs`：把用户提供的 Token 写入个人连接器配置并在线验证；写前备份、保留其他条目、不回显 Token。
- `check-connector.mjs`：同一套自检的可独立运行体检命令，用于区分「本机没配好」与「官方服务连不上」。
- `locate.mjs`：城市级 IP 定位（ipinfo.io 主、api.ip.sb 备），用于「附近」类问题的城市确认；不收集精确坐标，海外/代理出口会明确提示，结果需用户确认。
- `live.mjs`：使用用户当前终端的 `MCD_MCP_TOKEN` 完成上述主题活动查询链，将非敏感字段导出为 `examples/sample-events.json` 所示结构（含 `query-party-store` 返回的门店经纬度与地址，供地图定位）；`radar.mjs` 再进行日期、城市、关键词筛选，默认输出自包含 HTML 卡通活动地图，也可选 Markdown / JSON。
- `radar.mjs --format html`：生成「卡通示意地图 + 活动卡片」单文件页面——门店标记位置由官方经纬度线性投影（真实相对位置），辖区区块、道路与公园为卡通示意并在页面明确标注「示意图」；支持按日期（含周末）、活动类型、预约状态筛选与门店↔卡片联动。可选 `--districts` 传入 `{ "门店名": "辖区名" }` 做区块标注（示意性质，位置仍取官方坐标）；未提供时按门店聚簇自动划片并按方位命名。不调用任何在线地图服务。

归一化结果只保留活动名称、城市、门店、日期、场次、状态、价格、说明、来源工具和查询时间。不会把 Token、手机号、地址、订单或完整 MCP 响应写入导出文件。

## 在线验证记录（2026-10-09，真实 Token）

- 握手：HTTP 200，`serverInfo: mcd-mcp 1.0.0`，协议 `2025-06-18`，能力含 tools。
- 工具清单：35 个，主题活动核实链五工具齐全（采用线上命名）。
- 端到端：`live.mjs --city 上海 --max-products 5 --max-stores 2` 返回未来 14 天 116 个场次，例如「麦当劳亲子读书会 · 麦当劳上海黄浦华旭国际大厦餐厅 · 2026-10-12 10:30—12:00 · 剩余名额 12」。场次 `price` 原始字段为 `4500`，单位未核实，按原始值展示。
- 北京复测（同日）：`live.mjs --city 北京` 返回 620 个场次、11 家有场次门店；`query-party-store` 对单个 `spuId` 即返回全市 365 家门店，每家均含 `address` 与 `latitude/longitude`（如「东单北大街112、114号 · 39.910424, 116.418208」）。门店地址与经纬度已用于卡通活动地图的街道标注与位置投影。
- 价格单位交叉核实（同日）：`query-party-store-session` 的 `price`（如 4500/13800）与 `mall-product-detail` 同商品 `skuList[].price`（如 45/138，单位元）倍率恒为 ×100（11/11 商品一致，`points` 均为 0，排除积分兑换），判定场次 `price` 单位为**分**。`live.mjs` 在每次查询时自动核验，一致则标注「单位分 + 约价」，不一致则回退「单位待核实」。
- 两地实测中 `leftNum` 恒为 12，疑似「每场次容量上限」而非实时余量，界面按原始值展示并注明，不解读为确定库存。

## 已知限制

- 官方文档与线上工具命名存在差异（`query-partystore-date` vs `query-party-store-date`），本项目以 `tools/list` 实测为准，并在自检与体检脚本中按实测名核对。
- WorkBuddy 侧配置 `mcd-mcp` 时，`type` 用驼峰 `streamableHttp`（与 WorkBuddy 现有条目一致；官方示例为全小写 `streamablehttp`）。配置变更后通常需要重开一轮会话才会加载工具，期间可用 `live.mjs` 直连兜底。
- 官方限流为每 Token 每分钟 600 次请求（429），命令行与 Skill 均不做并发加大。
- 命令行程序按上限查询候选商品和门店，不保证穷举所有活动；结果文件包含实际检查数量和查询上限。
- 活动数据可能受城市、活动商品、日期和名额影响，空结果不能解释为全国没有活动。
- 本项目不提供支付能力，也不承诺任何场次持续可预约。
