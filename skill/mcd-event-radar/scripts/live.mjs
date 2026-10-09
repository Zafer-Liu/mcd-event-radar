#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { CATEGORIES, McpClient, REQUIRED_TOOLS } from './lib/mcp-client.mjs';

function fail(message) {
  throw new Error(message);
}

function parseDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${label} 必须是 YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    fail(`${label} 不是有效日期`);
  }
  return value;
}

function todayInShanghai() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  if (argv.includes('--help')) return { help: true };
  const options = { maxProducts: 12, maxStores: 4 };
  const allowed = new Set(['--city', '--from', '--to', '--keyword', '--output', '--max-products', '--max-stores']);
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!allowed.has(key)) fail(`未知参数：${key}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) fail(`${key} 缺少值`);
    options[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  if (!options.city?.trim()) fail('请提供 --city');
  options.city = options.city.trim();
  options.from = parseDate(options.from ?? todayInShanghai(), '--from');
  options.to = parseDate(options.to ?? addDays(options.from, 14), '--to');
  if (options.from > options.to) fail('--from 不能晚于 --to');
  for (const key of ['maxProducts', 'maxStores']) {
    options[key] = Number(options[key]);
    if (!Number.isInteger(options[key]) || options[key] < 1 || options[key] > 50) {
      fail(`--${key === 'maxProducts' ? 'max-products' : 'max-stores'} 必须是 1 至 50 的整数`);
    }
  }
  return options;
}

function dataArray(payload, toolName) {
  if (payload?.success === false) fail(`${toolName} 返回业务错误：${payload.message ?? payload.code ?? '未知原因'}`);
  const value = payload?.data ?? payload;
  if (Array.isArray(value)) return value;
  for (const key of ['list', 'items', 'products', 'records']) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  fail(`${toolName} 的数据结构与预期不符`);
}

function cityMatches(actual, requested) {
  const clean = (value) => String(value ?? '').trim().replace(/(市|地区|自治州)$/u, '');
  return clean(actual) === clean(requested);
}

function nonemptyId(value) {
  return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');
}

function safeText(value) {
  return value == null ? '' : String(value).trim();
}

// 场次 price 单位核实：mall-product-detail 的同商品价格单位为元（2026-10-09 实测），
// 若场次价 = 商城价 × 100，则场次单位判定为「分」并给出约价；对不上则回退「单位待核实」。
function priceNote(rawPrice, detailYuan) {
  if (rawPrice === null) return '价格未提供';
  const sessionNum = Number(rawPrice);
  if (detailYuan != null && Number.isFinite(sessionNum)
    && sessionNum === Math.round(detailYuan * 100)) {
    const yuan = sessionNum / 100;
    const yuanText = Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2);
    return `原始价格字段：${rawPrice}（单位分，经商城价 ${detailYuan} 元交叉核实，约 ¥${yuanText}）`;
  }
  return `原始价格字段：${rawPrice}（单位待核实）`;
}

async function discover(client, options) {
  const catalog = dataArray(await client.call('mall-points-products', { catRuleIds: CATEGORIES }),
    'mall-points-products');
  const selected = catalog.filter((product) => nonemptyId(product.spuId)
    && (!options.keyword || safeText(product.spuName).includes(options.keyword)))
    .slice(0, options.maxProducts);
  const events = [];
  const notes = [];
  const storeMeta = {};
  let cityGeo = null;
  if (catalog.length > selected.length) notes.push(`仅检查前 ${selected.length} 个匹配的活动商品；可调整筛选条件或 --max-products。`);
  for (const product of selected) {
    const spuId = product.spuId;
    // 取商城同商品价格（单位元），用于核实场次 price 的单位
    let detailYuan = null;
    try {
      const detailResp = await client.call('mall-product-detail', { spuId });
      const detailData = detailResp?.data ?? detailResp;
      const firstSku = Array.isArray(detailData?.skuList) ? detailData.skuList[0] : null;
      if (firstSku && Number.isFinite(Number(firstSku.price)) && Number(firstSku.price) > 0) {
        detailYuan = Number(firstSku.price);
      }
    } catch {
      detailYuan = null;   // 核实失败不影响主流程，回退「单位待核实」
    }
    const cities = dataArray(await client.call('query-party-city', { spuId }), 'query-party-city');
    const city = cities.find((item) => cityMatches(item.name, options.city));
    if (!city || !nonemptyId(city.code)) continue;
    if (!cityGeo && Number.isFinite(Number(city.latitude)) && Number.isFinite(Number(city.longitude))) {
      cityGeo = { latitude: Number(city.latitude), longitude: Number(city.longitude) };
    }
    const storeList = dataArray(await client.call('query-party-store', {
      spuId, code: String(city.code),
    }), 'query-party-store').slice(0, options.maxStores);
    for (const store of storeList) {
      const storeCode = store.code;
      if (!nonemptyId(storeCode)) continue;
      const key = String(storeCode);
      if (!storeMeta[key]) {
        storeMeta[key] = {
          name: safeText(store.name),
          shortName: safeText(store.shortName),
          address: safeText(store.address),
          latitude: Number.isFinite(Number(store.latitude)) ? Number(store.latitude) : null,
          longitude: Number.isFinite(Number(store.longitude)) ? Number(store.longitude) : null,
        };
      }
      const dates = dataArray(await client.call('query-party-store-date', {
        spuId, storeCode: String(storeCode),
      }), 'query-party-store-date');
      for (const item of dates) {
        const date = safeText(item.date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < options.from || date > options.to) continue;
        const sessions = dataArray(await client.call('query-party-store-session', {
          spuId, storeCode: String(storeCode), dateStr: date,
        }), 'query-party-store-session');
        for (const session of sessions) {
          const count = Number(session.leftNum);
          const bookingStatus = Number.isFinite(count)
            ? (count > 0 ? 'open' : 'full') : 'unknown';
          const rawPrice = session.price == null ? null : String(session.price);
          const detail = [
            Number.isFinite(count) ? `剩余名额：${count}` : '剩余名额未提供',
            priceNote(rawPrice, detailYuan),
          ].join('；');
          events.push({
            id: `${spuId}:${storeCode}:${date}:${session.id ?? `${session.timeStart}-${session.timeEnd}`}`,
            title: safeText(product.spuName) || '未命名主题活动',
            kind: 'theme',
            city: safeText(city.name),
            store: safeText(store.name),
            storeCode: key,
            startDate: date,
            session: [safeText(session.timeStart), safeText(session.timeEnd)].filter(Boolean).join('—'),
            bookingStatus,
            priceYuan: null,
            detail,
            sourceTool: 'query-party-store-session',
          });
        }
      }
    }
  }
  return { events, notes, checkedProducts: selected.length, storeMeta, cityGeo };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write('用法：node scripts/live.mjs --city <城市> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--keyword 文字] [--max-products 12] [--max-stores 4] [--output 文件]\n环境变量：MCD_MCP_TOKEN（必填）\n');
    return;
  }
  const token = process.env.MCD_MCP_TOKEN;
  if (!token) fail('请在当前终端设置 MCD_MCP_TOKEN；不要把 Token 写进仓库');
  const client = new McpClient(token);
  await client.initialize();
  const availableTools = new Set((await client.listTools()).map((tool) => tool.name));
  const missing = REQUIRED_TOOLS.filter((name) => !availableTools.has(name));
  if (missing.length) fail(`服务当前缺少所需工具：${missing.join(', ')}`);
  const { events, notes, checkedProducts, storeMeta, cityGeo } = await discover(client, options);
  const output = {
    note: '由麦当劳官方 MCP 实时查询生成；场次和名额可能变化。场次 price 字段与 mall-product-detail 同商品价格（元）交叉核实：倍率一致（×100）时判定单位为分并标注约价，否则保留「单位待核实」，不做无依据换算。stores 为 query-party-store 返回的门店元数据（官方经纬度与地址），供地图可视化使用。',
    retrievedAt: new Date().toISOString(),
    query: { city: options.city, from: options.from, to: options.to, keyword: options.keyword ?? null },
    coverage: { checkedProducts, maxProducts: options.maxProducts, maxStoresPerProduct: options.maxStores },
    notes,
    cityGeo: cityGeo ?? null,
    stores: storeMeta ?? {},
    events,
  };
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (options.output) await writeFile(options.output, serialized, 'utf8');
  else process.stdout.write(serialized);
}

main().catch((error) => {
  process.stderr.write(`错误：${error.message}\n`);
  process.exitCode = 1;
});
