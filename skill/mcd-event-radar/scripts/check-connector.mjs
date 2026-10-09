#!/usr/bin/env node
// 麦麦活动雷达 · 连接器体检
//
// 用途：在「查不到活动 / 工具一个都不出现」时，先分清是本地没配好，
//       还是官方服务连不上，避免盲目猜测。脚本绝不打印 Token 或请求头明文。
//
// 用法：
//   node scripts/check-connector.mjs            只体检本地 WorkBuddy 配置（不需要 Token）
//   node scripts/check-connector.mjs --online   额外连通官方服务并核对工具覆盖
//   node scripts/check-connector.mjs --json     输出机器可读结果（供自动化使用）
//
// 环境变量：MCD_MCP_TOKEN（仅 --online 需要）

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { FULL_TOOLSET, McpClient, REQUIRED_TOOLS } from './lib/mcp-client.mjs';

const SERVER_KEY = 'mcd-mcp';
const EXPECTED_TYPE = 'streamableHttp';
const EXPECTED_URL = 'https://mcp.mcd.cn';

function workbuddyConfigPath() {
  const home = process.env.USERPROFILE || process.env.HOME || homedir();
  return path.join(home, '.workbuddy', 'mcp.json');
}

function summarizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return { exists: false };
  const headers = entry.headers && typeof entry.headers === 'object' ? entry.headers : {};
  const authKey = Object.keys(headers)
    .find((key) => key.toLowerCase() === 'authorization');
  const type = typeof entry.type === 'string' ? entry.type : null;
  return {
    exists: true,
    url: typeof entry.url === 'string' ? entry.url : null,
    type,
    typeCaseWarning: type !== null && type !== EXPECTED_TYPE
      && type.toLowerCase() === EXPECTED_TYPE.toLowerCase(),
    authConfigured: Boolean(authKey),
    authScheme: authKey ? String(headers[authKey]).split(' ')[0] : null,
    transport: typeof entry.command === 'string' ? 'stdio' : 'http',
    disabled: entry.disabled === true,
  };
}

async function checkLocalConfig() {
  const configPath = workbuddyConfigPath();
  const result = { configPath, status: 'ok', findings: [], server: null };
  let raw;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch (error) {
    result.status = error.code === 'ENOENT' ? 'missing-file' : 'unreadable';
    result.findings.push(error.code === 'ENOENT'
      ? '未找到 WorkBuddy 的 mcp.json，当前没有任何自定义 MCP 服务器。'
      : `无法读取 mcp.json：${error.message}`);
    return result;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    result.status = 'invalid-json';
    result.findings.push(`mcp.json 不是合法 JSON：${error.message}`);
    return result;
  }
  const servers = parsed?.mcpServers ?? {};
  result.knownServers = Object.keys(servers);
  const entry = servers[SERVER_KEY];
  result.server = summarizeEntry(entry);
  if (!entry) {
    result.status = 'not-configured';
    result.findings.push(`mcp.json 中没有 "${SERVER_KEY}" 条目，Skill 无法调用麦当劳官方工具。`);
    return result;
  }
  if (result.server.disabled) {
    result.status = 'disabled';
    result.findings.push(`"${SERVER_KEY}" 被标记为 disabled，需要在配置中去掉该字段或设为 false。`);
  }
  if (!result.server.url) {
    result.status = 'misconfigured';
    result.findings.push(`"${SERVER_KEY}" 缺少 url 字段。`);
  } else if (!result.server.url.startsWith(EXPECTED_URL)) {
    result.findings.push(`url 为 ${result.server.url}，与官方文档的 ${EXPECTED_URL} 不一致，请核对官方接入指南。`);
  }
  if (result.server.typeCaseWarning) {
    result.findings.push(`type 写作 "${result.server.type}"，与 WorkBuddy 其他条目惯用的 "${EXPECTED_TYPE}" 仅大小写不同；若工具始终不出现，先改成 "${EXPECTED_TYPE}" 再重试。`);
  }
  if (!result.server.authConfigured) {
    result.status = result.status === 'ok' ? 'misconfigured' : result.status;
    result.findings.push(`"${SERVER_KEY}" 未配置 Authorization 请求头，Token 需要放在 headers.Authorization（Bearer <Token>）。`);
  }
  return result;
}

async function checkOnline() {
  const token = process.env.MCD_MCP_TOKEN;
  const result = { status: 'skipped', findings: [] };
  if (!token) {
    result.status = 'no-token';
    result.findings.push('未设置 MCD_MCP_TOKEN，跳过联网检查。可用 Read-Host -MaskInput 临时设置，用完立即删除。');
    return result;
  }
  const client = new McpClient(token);
  try {
    const init = await client.initialize();
    const tools = await client.listTools();
    const names = new Set(tools.map((tool) => tool.name));
    result.status = 'ok';
    result.protocolVersion = init.protocolVersion ?? null;
    result.serverInfo = init.serverInfo?.name ?? null;
    result.toolCount = tools.length;
    result.missingRequired = REQUIRED_TOOLS.filter((name) => !names.has(name));
    result.missingOptional = FULL_TOOLSET
      .filter((name) => !REQUIRED_TOOLS.includes(name) && !names.has(name));
    if (result.missingRequired.length) {
      result.status = 'partial';
      result.findings.push(`服务缺少必需工具：${result.missingRequired.join(', ')}；主题活动核实链无法完成。`);
    }
  } catch (error) {
    result.status = 'error';
    result.findings.push(error.message);
  }
  return result;
}

function line(text = '') {
  process.stdout.write(`${text}\n`);
}

function render(report) {
  const { local, online } = report;
  line('麦麦活动雷达 · 连接器体检');
  line(`体检时间：${report.checkedAt}（北京时间 ${report.checkedAtShanghai}）`);
  line();
  line('[1] WorkBuddy 本地配置');
  line(`  配置文件：${local.configPath}`);
  line(`  已知服务器：${(local.knownServers ?? []).join(', ') || '（无）'}`);
  if (local.server?.exists) {
    line(`  ${SERVER_KEY}：已配置，type=${local.server.type ?? '未设置'}，url=${local.server.url ?? '未设置'}`);
    line(`  Token：${local.server.authConfigured ? '已配置（值不显示）' : '未配置'}`);
    if (local.server.disabled) line('  状态：已禁用（disabled）');
  } else {
    line(`  ${SERVER_KEY}：未配置`);
  }
  for (const finding of local.findings) line(`  · ${finding}`);
  line();
  line('[2] 官方服务连通性');
  if (online.status === 'skipped') {
    line('  已跳过（未加 --online）');
  } else if (online.status === 'no-token') {
    line('  已跳过：未提供 Token');
  } else if (online.status === 'ok' || online.status === 'partial') {
    line(`  连接成功：协议 ${online.protocolVersion ?? '未知'}，工具数 ${online.toolCount}`);
    line(`  必需工具：${online.missingRequired.length ? `缺失 ${online.missingRequired.join(', ')}` : '齐全'}`);
    if (online.missingOptional?.length) {
      line(`  可选工具缺失：${online.missingOptional.join(', ')}（对应能力不可用）`);
    }
  } else {
    line(`  连接失败：${online.findings.join('；')}`);
  }
  for (const finding of online.findings ?? []) {
    if (online.status === 'error' || online.status === 'partial') line(`  · ${finding}`);
  }
  line();
  line(`结论：${report.verdict}`);
  for (const step of report.nextSteps) line(`  → ${step}`);
}

function buildVerdict({ local, online }) {
  if (online.status === 'ok') {
    return { verdict: '可用 — 官方服务已连通且必需工具齐全', nextSteps: ['在 WorkBuddy 中确认连接器已启用，然后直接向 Skill 提问。'] };
  }
  if (online.status === 'partial') {
    return { verdict: '部分可用 — 服务可连通但工具不全', nextSteps: ['核对官方 MCP 使用指南的工具清单与账号权限，必要时重新申请 Token。'] };
  }
  if (local.status === 'not-configured' || local.status === 'missing-file') {
    return { verdict: '不可用 — 本机尚未配置 mcd-mcp', nextSteps: [
      '到麦当劳 MCP 开放平台申请个人 Token（不要发给任何人、不要提交到仓库）。',
      `按官方接入指南把 ${SERVER_KEY} 写入 ${local.configPath}，并在 headers.Authorization 填 Bearer <Token>。`,
      '在连接器管理页对新服务器点「Trust」，并在聊天窗口左下角「+」菜单启用；新服务器通常要重开一轮会话才生效。',
    ] };
  }
  if (local.status === 'disabled') {
    return { verdict: '已配置但被禁用', nextSteps: ['去掉配置中的 disabled 字段或改为 false，重启 WorkBuddy 后重试。'] };
  }
  if (local.status === 'ok' && online.status === 'skipped') {
    return local.findings.length
      ? { verdict: '本地配置基本正常（有提示项）', nextSteps: [...local.findings.map((finding) => `提示：${finding}`), '处理提示项后，可加 --online 在线复核。'] }
      : { verdict: '本地配置正常 — 未做在线验证', nextSteps: ['如需连网复核官方服务与工具覆盖，加 --online 运行（需 MCD_MCP_TOKEN）。'] };
  }
  return { verdict: '已配置但存在问题', nextSteps: [
    ...local.findings.map((finding) => `修复：${finding}`),
    '改完配置后重开一轮会话，再运行 node scripts/check-connector.mjs --online 复核。',
  ] };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    line('用法：node scripts/check-connector.mjs [--online] [--json]');
    line('  --online  用 MCD_MCP_TOKEN 连通官方服务并核对工具覆盖（默认跳过）');
    line('  --json    以 JSON 输出结果（不含任何 Token 或请求头明文）');
    return;
  }
  const wantJson = argv.includes('--json');
  const wantOnline = argv.includes('--online');
  const local = await checkLocalConfig();
  const online = wantOnline ? await checkOnline() : { status: 'skipped', findings: [] };
  const report = {
    checkedAt: new Date().toISOString(),
    checkedAtShanghai: new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date()),
    local,
    online,
    ...buildVerdict({ local, online }),
  };
  if (wantJson) {
    line(JSON.stringify(report, null, 2));
    return;
  }
  render(report);
}

main().catch((error) => {
  process.stderr.write(`错误：${error.message}\n`);
  process.exitCode = 1;
});
