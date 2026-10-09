#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { renderHtmlMap } from './lib/html-map.mjs';

const USAGE = `麦麦活动雷达 · 结果整理器

用法：node scripts/radar.mjs --input <归一化活动.json> [选项]

选项：
  --city <城市>          只显示该城市的活动（自动兼容「北京/北京市」写法）
  --from <YYYY-MM-DD>    日期范围起点（含）
  --to <YYYY-MM-DD>      日期范围终点（含）
  --keyword <文字>       按标题、详情、门店筛选
  --open-only            只显示明确可预约的场次
  --format html|md|json  输出格式，默认 html（卡通示意地图 + 活动卡片，自包含单文件）
  --districts <JSON|@文件> 门店→辖区示意映射，如 '{"麦当劳北京北师大餐厅":"海淀区"}'；
                        仅用于地图区块标注，门店位置始终取官方经纬度
  --output <文件>        写入文件；html 缺省生成 麦麦活动地图_<城市>_<起>_<止>.html，md/json 缺省输出到终端
  --help                 显示帮助

输入格式参见 examples/sample-events.json。示例数据为虚构数据。`;

const BOOKING_STATUS = new Set(['open', 'full', 'unknown', 'not_required']);
const OFFICIAL_TOOLS = new Set([
  'campaign-calendar',
  'mall-points-products',
  'mall-product-detail',
  'query-party-city',
  'query-party-store',
  'query-party-store-date',
  'query-party-store-session',
]);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = { format: 'html', openOnly: false };
  const values = new Set(['--input', '--output', '--city', '--from', '--to', '--keyword', '--format', '--districts']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') return { help: true };
    if (arg === '--open-only') {
      options.openOnly = true;
      continue;
    }
    if (!values.has(arg)) fail(`未知参数：${arg}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) fail(`${arg} 缺少值`);
    options[arg.slice(2)] = value;
  }
  if (!options.input) fail('请提供 --input 文件');
  if (!['md', 'json', 'html'].includes(options.format)) fail('--format 只能是 html、md 或 json');
  return options;
}

function dateOnly(value, field, required = false) {
  if (value == null || value === '') {
    if (required) fail(`${field} 不能为空`);
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${field} 必须是 YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    fail(`${field} 不是有效日期`);
  }
  return value;
}

function cleanText(value, field, required = false) {
  if (value == null || value === '') {
    if (required) fail(`${field} 不能为空`);
    return null;
  }
  if (typeof value !== 'string') fail(`${field} 必须是文字`);
  const cleaned = value.trim().replace(/[\r\n\t]+/g, ' ');
  if (!cleaned && required) fail(`${field} 不能为空`);
  return cleaned || null;
}

function cleanEvent(raw, index) {
  const label = `events[${index}]`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`${label} 必须是对象`);
  const title = cleanText(raw.title, `${label}.title`, true);
  const sourceTool = cleanText(raw.sourceTool, `${label}.sourceTool`, true);
  if (!OFFICIAL_TOOLS.has(sourceTool)) fail(`${label}.sourceTool 不是活动相关的官方 MCP 工具`);
  const startDate = dateOnly(raw.startDate, `${label}.startDate`);
  const endDate = dateOnly(raw.endDate, `${label}.endDate`) ?? startDate;
  if (startDate && endDate && endDate < startDate) fail(`${label} 的结束日期早于开始日期`);
  const bookingStatus = raw.bookingStatus ?? 'unknown';
  if (!BOOKING_STATUS.has(bookingStatus)) fail(`${label}.bookingStatus 无效`);
  if (sourceTool === 'campaign-calendar' && bookingStatus === 'open') {
    fail(`${label}：活动日历本身不能证明有可预约场次`);
  }
  const priceYuan = raw.priceYuan == null ? null : Number(raw.priceYuan);
  if (priceYuan !== null && (!Number.isFinite(priceYuan) || priceYuan < 0)) {
    fail(`${label}.priceYuan 必须是非负数字`);
  }
  return {
    id: cleanText(raw.id, `${label}.id`),
    title,
    kind: raw.kind === 'theme' ? 'theme' : 'calendar',
    city: cleanText(raw.city, `${label}.city`),
    store: cleanText(raw.store, `${label}.store`),
    storeCode: cleanText(raw.storeCode, `${label}.storeCode`),
    startDate,
    endDate,
    session: cleanText(raw.session, `${label}.session`),
    bookingStatus,
    priceYuan,
    detail: cleanText(raw.detail, `${label}.detail`),
    sourceTool,
    sourceUrl: /^https:\/\//.test(raw.sourceUrl ?? '') ? raw.sourceUrl : null,
  };
}

function dedupe(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = [event.id ?? '', event.title, event.city ?? '', event.store ?? '',
      event.startDate ?? '', event.session ?? ''].join('|').toLocaleLowerCase('zh-CN');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function overlaps(event, from, to) {
  if (!from && !to) return true;
  if (!event.startDate) return false;
  return (!to || event.startDate <= to) && (!from || (event.endDate ?? event.startDate) >= from);
}

// 城市匹配做后缀归一化：让「北京」匹配数据里的「北京市」，与 live.mjs 的 cityMatches 口径一致
function cityKey(value) {
  return String(value ?? '').trim().toLocaleLowerCase('zh-CN').replace(/(市|地区|自治州|盟)$/u, '');
}

function filterEvents(events, options) {
  const city = options.city ? cityKey(options.city) : '';
  const keyword = options.keyword?.trim().toLocaleLowerCase('zh-CN');
  return events.filter((event) => {
    if (city && cityKey(event.city) !== city) return false;
    if (!overlaps(event, options.from, options.to)) return false;
    if (options.openOnly && event.bookingStatus !== 'open') return false;
    if (keyword && ![event.title, event.detail, event.store].some(
      (part) => part?.toLocaleLowerCase('zh-CN').includes(keyword),
    )) return false;
    return true;
  });
}

function sortEvents(events) {
  const statusRank = { open: 0, not_required: 1, unknown: 2, full: 3 };
  return [...events].sort((a, b) =>
    statusRank[a.bookingStatus] - statusRank[b.bookingStatus]
    || (a.startDate ?? '9999-12-31').localeCompare(b.startDate ?? '9999-12-31')
    || a.title.localeCompare(b.title, 'zh-CN'));
}

function escapeMarkdown(value) {
  return String(value).replace(/[\\`*_{}[\]()#+.!|>]/g, '\\$&');
}

function statusLabel(status) {
  return {
    open: '已查到可预约场次',
    full: '已满',
    unknown: '预约状态未核实',
    not_required: '无需预约或仅作活动展示',
  }[status];
}

// 校验 live.mjs 输出里的门店元数据（含官方经纬度），供 HTML 地图使用
function cleanStores(raw) {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('stores 需要是对象（门店编码 → 门店信息）');
  const result = {};
  for (const [code, info] of Object.entries(raw)) {
    if (!info || typeof info !== 'object') fail(`stores[${code}] 需要是对象`);
    const latitude = Number(info.latitude);
    const longitude = Number(info.longitude);
    result[code] = {
      name: cleanText(info.name, `stores[${code}].name`),
      shortName: cleanText(info.shortName, `stores[${code}].shortName`),
      address: cleanText(info.address, `stores[${code}].address`),
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    };
  }
  return result;
}

// --districts：内联 JSON 或 @文件，门店名 → 辖区示意标注
async function resolveDistricts(value) {
  if (!value) return null;
  const text = value.startsWith('@') ? await readFile(value.slice(1), 'utf8') : value;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail('--districts 不是合法 JSON（可传内联对象或 @文件路径）');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('--districts 需要是 { "门店名": "辖区名" } 形式的对象');
  }
  const result = {};
  for (const [store, label] of Object.entries(parsed)) {
    result[cleanText(store, '--districts 的门店名', true)] = cleanText(label, '--districts 的辖区名', true);
  }
  return result;
}

function renderMarkdown(result) {
  const { query, retrievedAt, events } = result;
  const lines = [
    '# 麦麦活动雷达',
    '',
    `查询条件：${escapeMarkdown(query.city ?? '不限城市')} · ${query.from ?? '不限起点'} 至 ${query.to ?? '不限终点'}${query.keyword ? ` · 关键词：${escapeMarkdown(query.keyword)}` : ''}`,
    `数据获取时间：${escapeMarkdown(retrievedAt ?? '未提供')}。活动、价格和场次可能变化，请以麦当劳实时结果为准。`,
    '',
  ];
  if (events.length === 0) {
    lines.push('没有符合条件的已核实活动。可扩大日期范围，或在 WorkBuddy 中重新查询实时 MCP 数据。', '');
    return lines.join('\n');
  }
  for (const [index, event] of events.entries()) {
    lines.push(`## ${index + 1}. ${escapeMarkdown(event.title)}`, '');
    lines.push(`- 地点：${escapeMarkdown([event.city, event.store].filter(Boolean).join(' · ') || '未提供')}`);
    lines.push(`- 日期：${event.startDate ?? '未提供'}${event.endDate && event.endDate !== event.startDate ? ` 至 ${event.endDate}` : ''}${event.session ? ` · ${escapeMarkdown(event.session)}` : ''}`);
    lines.push(`- 状态：${statusLabel(event.bookingStatus)}`);
    lines.push(`- 价格：${event.priceYuan == null ? '未提供' : `¥${event.priceYuan.toFixed(2)}`}`);
    if (event.detail) lines.push(`- 说明：${escapeMarkdown(event.detail)}`);
    lines.push('- 数据来源：麦当劳 MCP `' + escapeMarkdown(event.sourceTool) + '`');
    if (event.sourceUrl) lines.push(`- 官方链接：${event.sourceUrl}`);
    lines.push('');
  }
  lines.push('预约或下单前，请先确认活动、门店、日期、场次和费用。', '');
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const from = dateOnly(options.from, '--from');
  const to = dateOnly(options.to, '--to');
  if (from && to && from > to) fail('--from 不能晚于 --to');
  const raw = JSON.parse(await readFile(options.input, 'utf8'));
  if (!raw || !Array.isArray(raw.events)) fail('输入文件需要 events 数组');
  const events = sortEvents(filterEvents(dedupe(raw.events.map(cleanEvent)), { ...options, from, to }));

  if (options.format === 'html') {
    const districts = await resolveDistricts(options.districts);
    const html = renderHtmlMap({
      query: {
        city: options.city ?? null, from, to,
        keyword: options.keyword ?? null, openOnly: options.openOnly,
      },
      retrievedAt: cleanText(raw.retrievedAt, 'retrievedAt'),
      note: cleanText(raw.note, 'note'),
      stores: cleanStores(raw.stores),
      events,
      districts,
    });
    const cityPart = (options.city ?? '全部城市').replace(/[\\/:*?"<>|]/g, '');
    const rangePart = from && to ? `${from}_${to}` : '日期不限';
    const target = options.output ?? `麦麦活动地图_${cityPart}_${rangePart}.html`;
    await writeFile(target, html, 'utf8');
    process.stdout.write(`已生成活动地图：${target}（${events.length} 个场次）\n`);
    return;
  }

  const result = {
    query: { city: options.city ?? null, from, to, keyword: options.keyword ?? null,
      openOnly: options.openOnly },
    retrievedAt: cleanText(raw.retrievedAt, 'retrievedAt'),
    count: events.length,
    events,
  };
  const output = options.format === 'json'
    ? `${JSON.stringify(result, null, 2)}\n`
    : renderMarkdown(result);
  if (options.output) await writeFile(options.output, output, 'utf8');
  else process.stdout.write(output);
}

main().catch((error) => {
  process.stderr.write(`错误：${error.message}\n`);
  process.exitCode = 1;
});
