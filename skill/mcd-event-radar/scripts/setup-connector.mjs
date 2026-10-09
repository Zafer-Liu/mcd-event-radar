#!/usr/bin/env node
// 麦麦活动雷达 · 一键配置连接器
//
// 把用户提供的麦当劳 MCP Token 写入 WorkBuddy 的私有配置文件
// ~/.workbuddy/mcp.json（写前自动备份，保留其他服务器条目），
// 然后在线验证 Token 是否可用。全程不打印 Token 本身。
//
// 用法（三种方式任选其一）：
//   MCD_MCP_TOKEN=<你的Token> node scripts/setup-connector.mjs    （推荐）
//   node scripts/setup-connector.mjs --token <你的Token>
//   node scripts/setup-connector.mjs                               （交互式，输入不回显）
// 可选：--offline 跳过在线验证；--json 输出机器可读结果
//
// 退出码：0 = 配置成功且验证通过；1 = 失败（原因见输出）

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { homedir } from 'node:os';
import path from 'node:path';
import { McpClient, REQUIRED_TOOLS } from './lib/mcp-client.mjs';

const SERVER_KEY = 'mcd-mcp';
// 与 WorkBuddy 现有条目保持一致的驼峰写法；官方文档示例为全小写 streamablehttp
const ENTRY_TYPE = 'streamableHttp';
const ENTRY_URL = 'https://mcp.mcd.cn';

function fail(message) {
  throw new Error(message);
}

function line(text = '') {
  process.stdout.write(`${text}\n`);
}

function parseArgs(argv) {
  const options = { json: false, offline: false, token: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') return { help: true };
    if (arg === '--json') options.json = true;
    else if (arg === '--offline') options.offline = true;
    else if (arg === '--token') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) fail('--token 后面要跟 Token 值（或改用 MCD_MCP_TOKEN 环境变量 / 交互式输入）');
      options.token = value;
    } else fail(`未知参数：${arg}（可用：--token <值> --offline --json）`);
  }
  return options;
}

async function readTokenInteractive() {
  // 隐藏输入：吞掉回显，避免 Token 出现在终端和录屏里
  const muted = new Writable({ write(chunk, encoding, callback) { callback(); } });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  const token = await rl.question('请粘贴你的麦当劳 MCP Token（输入不会回显）：');
  rl.close();
  return token.trim();
}

function validateToken(token) {
  if (!token) fail('没有拿到 Token。请在开放平台申请后，用 MCD_MCP_TOKEN 环境变量、--token 参数或交互式输入提供。');
  if (token.includes('YOUR_MCP_TOKEN')) fail('这是文档里的占位符，不是真实 Token。请到 https://open.mcd.cn/mcp/doc 申请并复制真实 Token。');
  if (/\s/.test(token)) fail('Token 中间含有空格或换行，复制时可能不完整，请重新一键复制。');
  if (token.length < 16) fail(`Token 长度只有 ${token.length} 位，异常偏短（麦当劳 MCP Token 通常为 32 位），请核对。`);
}

function configPath() {
  const home = process.env.USERPROFILE || process.env.HOME || homedir();
  return path.join(home, '.workbuddy', 'mcp.json');
}

function timestamp() {
  const digits = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date()).replace(/\D/g, '');
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}

async function loadConfig(file) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { config: { mcpServers: {} }, existed: false };
    fail(`无法读取 ${file}：${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(`现有 ${file} 不是合法 JSON，为安全起见本次不做任何修改。请先手动检查该文件。`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(`现有 ${file} 结构异常（顶层不是对象），为安全起见本次不做任何修改。`);
  }
  if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object' || Array.isArray(parsed.mcpServers)) {
    parsed.mcpServers = {};
  }
  return { config: parsed, existed: true };
}

async function verifyOnline(token) {
  const result = { status: 'skipped', findings: [] };
  const client = new McpClient(token);
  try {
    const init = await client.initialize();
    const tools = await client.listTools();
    const names = new Set(tools.map((tool) => tool.name));
    const missing = REQUIRED_TOOLS.filter((name) => !names.has(name));
    result.status = missing.length ? 'partial' : 'ok';
    result.serverInfo = init.serverInfo ? `${init.serverInfo.name ?? '未知'} ${init.serverInfo.version ?? ''}`.trim() : null;
    result.protocolVersion = init.protocolVersion ?? null;
    result.toolCount = tools.length;
    result.missingRequired = missing;
    if (missing.length) result.findings.push(`服务缺少主题活动核实链工具：${missing.join(', ')}`);
  } catch (error) {
    result.status = 'error';
    result.findings.push(error.message);
  }
  return result;
}

function nextStepsText() {
  return [
    '① 打开 WorkBuddy 连接器管理页 → 自定义连接器 → 对 mcd-mcp 点「Trust」',
    '② 在聊天窗口左下角「+」菜单里启用 mcd-mcp',
    '③ 重开一轮会话，然后直接问「附近有什么麦当劳活动」',
  ];
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    line('用法：node scripts/setup-connector.mjs [--token <Token>] [--offline] [--json]');
    line('  Token 来源优先级：--token 参数 > MCD_MCP_TOKEN 环境变量 > 交互式隐藏输入');
    line('  --offline  只写配置，跳过在线验证（网络不好时用）');
    line('  --json     输出结构化结果（不含 Token）');
    return;
  }
  const options = parseArgs(argv);
  const token = (options.token ?? process.env.MCD_MCP_TOKEN ?? await readTokenInteractive()).trim();
  validateToken(token);

  const file = configPath();
  const { config, existed } = await loadConfig(file);
  let backupPath = null;
  if (existed) {
    backupPath = `${file}.bak-${timestamp()}`;
    await copyFile(file, backupPath);
  }

  const otherServers = Object.keys(config.mcpServers).filter((name) => name !== SERVER_KEY);
  config.mcpServers[SERVER_KEY] = {
    type: ENTRY_TYPE,
    url: ENTRY_URL,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
    disabled: false,
  };
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  const online = options.offline ? { status: 'skipped', findings: [] } : await verifyOnline(token);
  const ok = options.offline || online.status === 'ok' || online.status === 'partial';

  if (options.json) {
    line(JSON.stringify({
      ok,
      configPath: file,
      backupPath,
      servers: Object.keys(config.mcpServers),
      wroteEntry: SERVER_KEY,
      online,
      nextSteps: ok ? nextStepsText() : ['Token 验证未通过：请到 https://open.mcd.cn/mcp/doc 重新申请后，再次运行本脚本覆盖。'],
    }, null, 2));
    if (!ok) process.exitCode = 1;
    return;
  }

  line('麦麦活动雷达 · 一键配置');
  line();
  line('[1] 写入 WorkBuddy 配置');
  line(`    配置文件：${file}`);
  if (backupPath) line(`    已备份原文件：${backupPath}`);
  else line('    首次配置，无需备份');
  if (otherServers.length) line(`    其他服务器保持不变：${otherServers.join(', ')}`);
  line(`    ${SERVER_KEY}：type=${ENTRY_TYPE}，url=${ENTRY_URL}，Token 已写入（不显示）`);
  line();
  line('[2] 在线验证');
  if (online.status === 'ok' || online.status === 'partial') {
    line(`    连接成功：${online.serverInfo ?? '未知服务'}，协议 ${online.protocolVersion ?? '未知'}，共 ${online.toolCount} 个工具`);
    line(`    主题活动核实链：${online.missingRequired.length ? `缺 ${online.missingRequired.join(', ')}` : '齐全'}`);
  } else if (online.status === 'skipped') {
    line('    已跳过（--offline）');
  } else {
    line(`    验证未通过：${online.findings.join('；')}`);
    line('    配置已写入。若提示 Token 无效，请到 https://open.mcd.cn/mcp/doc 重新申请后再次运行本脚本覆盖。');
    process.exitCode = 1;
    return;
  }
  line();
  line('[3] 还差最后两步（WorkBuddy 平台要求，约 30 秒）');
  for (const step of nextStepsText()) line(`    ${step}`);
  line();
  line('配置完成！当前会话不想重启的话，也可以先用命令行直连查一次：');
  line('    MCD_MCP_TOKEN=<你的Token> node scripts/live.mjs --city <城市>');
}

main().catch((error) => {
  process.stderr.write(`错误：${error.message}\n`);
  process.exitCode = 1;
});
