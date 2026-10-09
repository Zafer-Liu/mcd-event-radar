// 麦麦活动雷达 · 麦当劳官方 MCP 客户端（Streamable HTTP）
// 只负责连接与调用，不含任何业务筛选逻辑，也不持久化或输出 Token。

export const ENDPOINT = 'https://mcp.mcd.cn';
export const PROTOCOL_VERSION = '2025-06-18';
export const CATEGORIES = '1>6>20,1>6>21,1>6>22,1>6>25,1>6>34';

// 主题活动核实链：缺任何一个都无法完成「门店 → 日期 → 场次」核实
// 注：日期/场次两个工具以 2026-10-09 线上 tools/list 实测为准，命名为
//     query-party-store-date / query-party-store-session；
//     官方文档页面写作 query-partystore-date / query-partystore-session，与本常量不一致时以线上为准。
export const REQUIRED_TOOLS = [
  'mall-points-products',
  'query-party-city',
  'query-party-store',
  'query-party-store-date',
  'query-party-store-session',
];

// 完整能力集：在必备链之外，还包含活动日历发现、商品详情与下单
export const FULL_TOOLSET = [
  'campaign-calendar',
  'mall-points-products',
  'mall-product-detail',
  'query-party-city',
  'query-party-store',
  'query-party-store-date',
  'query-party-store-session',
  'party-order-create',
];

function fail(message) {
  throw new Error(message);
}

function parseRpcResponse(body, contentType, id) {
  if (contentType.includes('text/event-stream')) {
    const chunks = body.replace(/\r\n/g, '\n').split(/\n\n+/);
    const messages = chunks.flatMap((chunk) => {
      const data = chunk.split('\n').filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim()).join('\n');
      if (!data) return [];
      try { return [JSON.parse(data)]; } catch { return []; }
    });
    return messages.find((item) => item.id === id) ?? fail('MCP 未返回对应的请求结果');
  }
  if (!body.trim()) return null;
  return JSON.parse(body);
}

export class McpClient {
  constructor(token, { endpoint = ENDPOINT } = {}) {
    if (!token) fail('缺少 MCP Token');
    this.token = token;
    this.endpoint = endpoint;
    this.sessionId = null;
    this.version = PROTOCOL_VERSION;
    this.nextId = 1;
  }

  async request(method, params, notification = false) {
    const id = notification ? undefined : this.nextId++;
    const payload = { jsonrpc: '2.0', ...(id ? { id } : {}), method,
      ...(params === undefined ? {} : { params }) };
    const headers = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Mcp-Protocol-Version': this.version,
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
    let response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(25000),
      });
    } catch (error) {
      fail(`连接 MCP 服务失败：${error.name === 'TimeoutError' ? '请求超时' : error.message}`);
    }
    if (!response.ok) {
      const hint = response.status === 401 || response.status === 403
        ? '（Token 无效、过期或缺少权限，请到麦当劳 MCP 开放平台重新申请）' : '';
      fail(`MCP 请求失败：HTTP ${response.status}（${method}）${hint}`);
    }
    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId) this.sessionId = sessionId;
    if (notification) return null;
    const body = await response.text();
    const rpc = parseRpcResponse(body, response.headers.get('content-type') ?? '', id);
    if (rpc?.error) fail(`MCP ${method} 返回错误：${rpc.error.message ?? rpc.error.code}`);
    if (!rpc || !Object.hasOwn(rpc, 'result')) fail(`MCP ${method} 返回格式不可识别`);
    return rpc.result;
  }

  async initialize() {
    const result = await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'mcd-event-radar', version: '0.1.0' },
    });
    if (result.protocolVersion) this.version = result.protocolVersion;
    await this.request('notifications/initialized', undefined, true);
    return result;
  }

  async listTools() {
    const tools = [];
    let cursor;
    do {
      const result = await this.request('tools/list', cursor ? { cursor } : {});
      tools.push(...(result.tools ?? []));
      cursor = result.nextCursor;
    } while (cursor);
    return tools;
  }

  async call(name, args) {
    const result = await this.request('tools/call', { name, arguments: args });
    if (result.isError) fail(`${name} 返回工具错误`);
    if (result.structuredContent) return result.structuredContent;
    const text = result.content?.filter((item) => item.type === 'text')
      .map((item) => item.text).join('\n');
    if (!text) fail(`${name} 未返回可读取的数据`);
    try { return JSON.parse(text); } catch { fail(`${name} 返回的内容不是 JSON，无法安全解析`); }
  }
}
