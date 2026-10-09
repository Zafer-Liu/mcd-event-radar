// 麦麦活动雷达 · HTML 卡通地图生成器
// 输入：radar.mjs 校验后的归一化数据（events + stores + query + retrievedAt + 可选 districts）
// 输出：自包含 HTML——卡通城市示意地图 + 活动卡片面板，无外部依赖，离线可打开。
//
// 位置数据的诚实性约定：
// - 门店标记位置由官方 query-party-store 返回的经纬度线性投影得到（真实相对位置）；
// - 辖区区块、道路、公园均为卡通示意装饰，页面明确标注「示意图」；
// - 不使用任何在线地图底图或 SDK，因此不涉及地图服务资质问题。

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// 防止 </script> 提前闭合
function embedJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const CSS = `
:root {
  --red: #DA291C; --gold: #FFC72C; --paper: #FFF9EF; --ink: #3B2B20;
  --sub: #8A7660; --line: #F0E2C8; --cardline: #EFE0C4;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--paper); color: var(--ink);
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif; }
.topbar { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
  padding: 14px 22px; background: #fff; border-bottom: 4px solid var(--gold); }
.brand { font-size: 21px; font-weight: 800; letter-spacing: .5px; }
.brand em { font-style: normal; color: var(--red); }
.topmeta { font-size: 13px; color: var(--sub); }
.layout { display: flex; gap: 16px; padding: 16px; align-items: stretch; }
.mapcol { flex: 1.35; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.stats { display: flex; gap: 8px; flex-wrap: wrap; }
.schip { background: #fff; border: 1px solid var(--line); border-radius: 999px;
  padding: 5px 14px; font-size: 13px; color: var(--sub); }
.schip b { color: var(--ink); font-size: 15px; margin-right: 2px; }
.schip.ok b { color: #2E7D32; }
.mapwrap { position: relative; }
svg#map { width: 100%; height: auto; display: block; background: #FFFDF6;
  border: 1px solid var(--line); border-radius: 18px; }
.legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--sub);
  padding: 2px 4px; }
.panel { flex: 1; min-width: 340px; max-width: 540px; display: flex; flex-direction: column;
  background: #fff; border: 1px solid var(--line); border-radius: 18px; overflow: hidden; }
.fbar { padding: 12px 14px 8px; border-bottom: 1px dashed var(--cardline); }
.dchips { display: flex; gap: 6px; flex-wrap: wrap; }
.dchip { border: 1px solid #E8D9BC; background: #fff; color: var(--ink); border-radius: 999px;
  padding: 4px 12px; font-size: 12.5px; cursor: pointer;
  transition: transform .12s, box-shadow .12s, border-color .15s, background .15s, color .15s; }
.dchip:hover { border-color: var(--red); transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(122, 82, 26, .15); }
.dchip:active { transform: translateY(1px); box-shadow: 0 1px 2px rgba(122, 82, 26, .12); }
.dchip.on { background: var(--red); border-color: var(--red); color: #fff;
  box-shadow: 2px 2px 0 var(--gold); }
.dchip.on:hover, .dchip.on:active { transform: none; box-shadow: 2px 2px 0 var(--gold); }
.frow { display: flex; gap: 8px; margin-top: 9px; flex-wrap: wrap; }
.frow select { flex: 1; min-width: 120px; border: 1px solid #E8D9BC; border-radius: 10px;
  padding: 6px 8px; font-size: 13px; background: #fff; color: var(--ink); }
.frow button { border: 1px solid #E8D9BC; background: #FFF6E3; border-radius: 10px;
  padding: 6px 14px; font-size: 13px; cursor: pointer; color: var(--ink); }
.frow button:hover { background: var(--gold); }
.fstore { margin-top: 8px; display: none; }
.fstore .schip { cursor: pointer; }
.cardshead { display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 10px 16px 4px; font-size: 13px; color: var(--sub); }
.cards { flex: 1; overflow-y: auto; padding: 6px 12px 12px; max-height: calc(100vh - 300px); min-height: 320px; }
.card { background: #fff; border: 1px solid var(--cardline); border-left-width: 5px;
  border-radius: 14px; padding: 10px 12px; margin-bottom: 9px; cursor: pointer;
  transition: transform .15s, box-shadow .15s; }
.card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(122, 82, 26, .12); }
.c1 { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; }
.tag { font-size: 13.5px; font-weight: 700; }
.badge { font-size: 11px; border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
.b-open { background: #E6F4E6; color: #2E7D32; font-weight: 700; }
.b-full { background: #F1F1F1; color: #666; }
.b-unk { background: #FFF6E3; color: #9C7A1E; }
.c2 { font-size: 12.5px; color: var(--sub); margin-bottom: 7px; }
.c2 .addr { margin-left: 6px; opacity: .85; }
.c3 { display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline; font-size: 12.5px; }
.c3 .d { font-weight: 700; }
.c3 .t { color: var(--ink); background: #FFF6E3; border-radius: 6px; padding: 1px 7px; }
.c3 .l { color: #2E7D32; font-weight: 600; }
.c3 .p { color: var(--red); font-weight: 800; font-size: 14px; }
.c3 .p i { font-style: normal; font-weight: 400; font-size: 10px; color: var(--sub); margin-left: 3px; }
.c3 .p-na { color: var(--sub); font-weight: 400; font-size: 12px; }
.morebtn { display: block; width: 100%; border: none; border-bottom: 5px solid #A61B11;
  background: var(--red); color: #fff; font-weight: 700; border-radius: 12px;
  padding: 10px; font-size: 13.5px; cursor: pointer;
  box-shadow: 0 4px 10px rgba(218, 41, 28, .22); transition: transform .1s, border-bottom-width .1s; }
.morebtn:hover { transform: translateY(4px); border-bottom-width: 1px; }
.empty { text-align: center; color: var(--sub); padding: 50px 10px; font-size: 14px; }
.pfoot { padding: 10px 16px 14px; border-top: 1px dashed var(--cardline);
  font-size: 11.5px; color: var(--sub); line-height: 1.7; }
.mk { cursor: pointer; }
.mkbody { transition: transform .22s ease, opacity .22s; transform-box: fill-box; transform-origin: 50% 62%; }
.mk:hover .mkbody, .mk.sel .mkbody { transform: scale(1.14); }
.mk.dim .mkbody { opacity: .4; filter: grayscale(.7); }
.mk.pulse .mkbody { animation: mpulse 1.1s ease; }
@keyframes mpulse { 0% { transform: scale(1); } 30% { transform: scale(1.45); } 100% { transform: scale(1); } }
.zlabel rect { rx: 12; }
button:focus-visible, select:focus-visible, .mk:focus-visible, .tl:focus-visible, .icsbtn:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }
.tlegend { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 9px; }
.tl { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--line);
  background: #fff; border-radius: 999px; padding: 3px 9px; font-size: 11.5px;
  color: var(--ink); cursor: pointer; transition: border-color .15s, background .15s, transform .12s; }
.tl:hover { border-color: var(--red); transform: translateY(-1px); }
.tl.on { border-color: var(--ink); background: #FFF6E3; font-weight: 700; }
.tl i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
.icsbtn { border: 1px solid #E8D9BC; background: #fff; border-radius: 999px; padding: 4px 11px;
  font-size: 12px; color: var(--ink); cursor: pointer;
  transition: background .15s, border-color .15s; }
.icsbtn:hover { background: var(--gold); border-color: #E9AB4E; }

/* ---- 微交互元素改编自 Uiverse.io（MIT 许可，© 各原作者）----
   气泡提示 vinodjangid07/mighty-elephant-52 · 扫光填充 adamgiebl/curly-wombat-58
   厚底按压 adamgiebl/big-moose-23 · 硬影按压 andrew-demchenk0/afraid-squid-51 */
#freset { position: relative; overflow: hidden; background: #fff; border: 1.5px solid #E8D9BC;
  font-weight: 700; }
#freset span { position: relative; z-index: 2; }
#freset::before { content: ''; position: absolute; top: 50%; left: 50%; width: 9%; height: 500%;
  background: var(--gold); transform: translate(-50%, -50%) rotate(-60deg);
  transition: transform .3s, width .3s; z-index: 1; }
#freset:hover::before { transform: translate(-50%, -50%) rotate(-90deg); width: 100%; }
#freset:hover { border-color: #E9AB4E; }
#freset:active { transform: translate(1px, 1px); }
/* left/top 给初始值：未显示时不落在静态位置，避免小屏撑出横向滚动 */
.mtooltip { position: absolute; left: 0; top: 0; z-index: 30; max-width: 240px; padding: 9px 12px;
  background: #fff; border: 1.5px solid var(--gold); border-radius: 12px;
  box-shadow: 0 8px 20px rgba(122, 82, 26, .16); opacity: 0; pointer-events: none;
  transform: translateX(-50%) translateY(5px); transition: opacity .18s, transform .18s; }
.mtooltip.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.mtooltip::before { content: ''; position: absolute; left: 50%; bottom: -5.5px; width: 10px; height: 10px;
  background: #fff; border-right: 1.5px solid var(--gold); border-bottom: 1.5px solid var(--gold);
  transform: translateX(-50%) rotate(45deg); }
.mtooltip.below { transform: translateX(-50%) translateY(-5px); }
.mtooltip.below.show { transform: translateX(-50%) translateY(0); }
.mtooltip.below::before { bottom: auto; top: -5.5px; transform: translateX(-50%) rotate(225deg); }
.mt-name { font-size: 13.5px; font-weight: 800; color: var(--ink); }
.mt-addr { font-size: 11px; color: var(--sub); margin-top: 2px; line-height: 1.5; }
.mt-cnt { font-size: 12px; margin-top: 5px; color: var(--ink); }
.mt-cnt b { color: var(--red); font-size: 14px; }
.mt-hint { font-size: 10.5px; color: #B09555; margin-top: 4px;
  border-top: 1px dashed var(--line); padding-top: 4px; }
@media (max-width: 980px) {
  .layout { flex-direction: column; }
  .panel { max-width: none; }
  .cards { max-height: 60vh; }
}
@media (max-width: 720px) {
  .topbar { padding: 10px 14px; gap: 6px; }
  .brand { font-size: 18px; }
  .topmeta { font-size: 12px; }
  .layout { padding: 10px; gap: 12px; }
  .stats { gap: 6px; }
  .schip { padding: 4px 10px; font-size: 12px; }
  .dchips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 3px;
    scrollbar-width: thin; }
  .dchip { flex: 0 0 auto; }
  .frow select { flex-basis: 100%; }
  .cards { max-height: 54vh; min-height: 240px; }
  .mtooltip { max-width: 190px; padding: 7px 10px; }
  .mt-name { font-size: 12.5px; }
  .pfoot { font-size: 11px; max-height: 132px; overflow-y: auto; }
}
/* 尊重系统「减少动态效果」设置：关闭装饰动画与位移反馈 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important;
    transition-duration: .001ms !important; scroll-behavior: auto !important; }
  .mk:hover .mkbody, .mk.sel .mkbody { transform: none; }
  .dchip:hover, .dchip:active, .dchip.on:hover, .dchip.on:active { transform: none; }
  .morebtn:hover { transform: none; border-bottom-width: 5px; }
  .tl:hover { transform: none; }
  .card:hover { transform: none; }
  .mtooltip { transform: translateX(-50%); }
  .mtooltip.below { transform: translateX(-50%); }
  #freset::before { transition: none; }
}
`;

// 客户端脚本：无反引号、无模板字符串，全部字符串拼接（便于安全内嵌）
const CLIENT_JS = `
'use strict';
var D = window.__MCD_MAP_DATA__;
var W = 1000, H = 640, PAD = 84;
var ZONE_COLORS = [
  { fill: '#FFE9CB', stroke: '#E7B66B', label: '#8A5A1E' },
  { fill: '#DCEEDC', stroke: '#82C277', label: '#2F6B2A' },
  { fill: '#D8E9F8', stroke: '#72A9DC', label: '#1F4E79' },
  { fill: '#F6DAE8', stroke: '#DA8FB2', label: '#8E3A63' },
  { fill: '#EFE4F6', stroke: '#B288CD', label: '#5D3A7E' },
  { fill: '#FDECD2', stroke: '#E9AB4E', label: '#7A521A' }
];
var TAG_COLORS = ['#DA291C', '#D97706', '#B8860B', '#2F6B2A', '#1F4E79', '#6B4FA0', '#B04A78', '#4A7A2F', '#8C5A2B', '#317873', '#A63D2F', '#5B6B8C'];

function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function hashStr(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h >>> 0; }
function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function wdIdx(d) { return new Date(d + 'T00:00:00Z').getUTCDay(); }
function wdName(d) { return '日一二三四五六'[wdIdx(d)]; }
function shortDate(d) { return d.slice(5).replace('-', '/'); }
function fmtRetrieved(iso) {
  try { return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }); }
  catch (e) { return String(iso || ''); }
}
function parseDetail(detail) {
  var left = null, price = null, approx = null, m;
  m = /剩余名额：([0-9]+)/.exec(detail || ''); if (m) left = m[1];
  m = /原始价格字段：([0-9]+)（([^）]*)）/.exec(detail || '');
  if (m) {
    price = m[1];
    // 已核实（单位分）时提取约价，如「单位分，经商城价 138 元交叉核实，约 ¥138」
    var am = /约 ¥([0-9.]+)/.exec(m[2]);
    if (am) approx = am[1];
  }
  return { left: left, price: price, approx: approx };
}
function streetOf(addr) {
  if (!addr) return '';
  return String(addr).replace(/[0-9０-９]+.*$/, '').replace(/[（(].*$/, '').replace(/[·、,，].*$/, '').trim();
}

/* ---------- 数据准备 ---------- */
var events = D.events || [];
var meta = D.stores || {};
var storeList = [], storeIdx = {};
function storeKey(e) { return e.storeCode || e.store; }
events.forEach(function (e) {
  var k = storeKey(e);
  if (!(k in storeIdx)) {
    storeIdx[k] = storeList.length;
    storeList.push({ key: k, code: e.storeCode || null, name: e.store, events: [] });
  }
});
storeList.forEach(function (s) {
  var m = s.code ? meta[s.code] : null;
  s.address = m && m.address ? String(m.address) : '';
  s.shortName = m && m.shortName ? String(m.shortName) : s.name.replace(/^麦当劳/, '');
  s.lat = m && typeof m.latitude === 'number' ? m.latitude : null;
  s.lng = m && typeof m.longitude === 'number' ? m.longitude : null;
  s.mx = null; s.my = null;
});
events.forEach(function (e) {
  var s = storeList[storeIdx[storeKey(e)]];
  if (s) s.events.push(e);
});

/* ---------- 空数据 ---------- */
if (!events.length) {
  document.addEventListener('DOMContentLoaded', function () {
    document.body.innerHTML = '<div class="empty" style="padding:80px 20px;font-size:16px;">'
      + '没有符合条件的已核实活动。<br><br>可扩大日期范围、更换城市，或重新运行实时查询。</div>';
  });
} else {
  document.addEventListener('DOMContentLoaded', init);
}

function init() {
  /* ---------- 经纬度投影（真实相对位置） ---------- */
  var geo = [], nogeo = [];
  storeList.forEach(function (s) { ((s.lat != null && s.lng != null) ? geo : nogeo).push(s); });
  var perRow = nogeo.length ? Math.min(nogeo.length, 7) : 0;
  var laneRows = perRow ? Math.ceil(nogeo.length / perRow) : 0;
  var laneH = laneRows ? 46 + laneRows * 52 : 0;
  var laneY = laneRows ? H - laneH - 16 : 0;
  var laneTop = laneRows ? (laneY - 14) : (H - PAD);
  var minLat = 1 / 0, maxLat = -1 / 0, minLng = 1 / 0, maxLng = -1 / 0;
  geo.forEach(function (s) {
    if (s.lat < minLat) minLat = s.lat; if (s.lat > maxLat) maxLat = s.lat;
    if (s.lng < minLng) minLng = s.lng; if (s.lng > maxLng) maxLng = s.lng;
  });
  if (geo.length) {
    var spanX = Math.max(maxLng - minLng, 1e-9), spanY = Math.max(maxLat - minLat, 1e-9);
    var scale = Math.min((W - 2 * PAD) / spanX, (laneTop - PAD) / spanY);
    var cx = (minLng + maxLng) / 2, cy = (minLat + maxLat) / 2;
    var baseY = (PAD + laneTop) / 2;
    geo.forEach(function (s) {
      s.px = W / 2 + (s.lng - cx) * scale;
      s.py = baseY - (s.lat - cy) * scale;
    });
  }

  /* ---------- 分组：辖区映射 > 自动邻近聚类 ---------- */
  var districts = D.districts || null;
  var zoneMap = {};   // key -> { key, label, stores }
  function zoneFor(key, label) {
    if (!zoneMap[key]) zoneMap[key] = { key: key, label: label, stores: [] };
    return zoneMap[key];
  }
  var autoIds = null;
  if (districts) {
    geo.forEach(function (s) {
      var label = districts[s.name] || districts[s.shortName] || null;
      if (label) zoneFor('d:' + label, label).stores.push(s);
      else zoneFor('u:' + s.key, null).stores.push(s);   // 未映射的先挂起，稍后聚类
    });
  }
  var pending = [];
  Object.keys(zoneMap).forEach(function (k) {
    if (zoneMap[k].label === null) { pending = pending.concat(zoneMap[k].stores); delete zoneMap[k]; }
  });
  // 未映射 / 无映射的地理门店 → 自动聚类
  if (pending.length) {
    var parent = []; pending.forEach(function (_, i) { parent[i] = i; });
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function uni(a, b) { a = find(a); b = find(b); if (a !== b) parent[b] = a; }
    var maxD = 0, pairs = [];
    for (var i = 0; i < pending.length; i++) for (var j = i + 1; j < pending.length; j++) {
      var dx = pending[i].lng - pending[j].lng, dy = pending[i].lat - pending[j].lat;
      var dd = Math.sqrt(dx * dx + dy * dy); pairs.push([i, j, dd]); if (dd > maxD) maxD = dd;
    }
    var th = Math.max(maxD * 0.3, 1e-9);
    pairs.forEach(function (p) { if (p[2] <= th) uni(p[0], p[1]); });
    var clusters = {};
    pending.forEach(function (s, i) {
      var root = find(i);
      if (!clusters[root]) clusters[root] = [];
      clusters[root].push(s);
    });
    // 全域质心（用于方位命名）
    var ccx = 0, ccy = 0;
    geo.forEach(function (s) { ccx += s.lng; ccy += s.lat; });
    ccx /= geo.length; ccy /= geo.length;
    var maxOff = 0;
    geo.forEach(function (s) {
      var ox = s.lng - ccx, oy = s.lat - ccy;
      maxOff = Math.max(maxOff, Math.sqrt(ox * ox + oy * oy));
    });
    Object.keys(clusters).forEach(function (root, ci) {
      var list = clusters[root], mx = 0, my = 0;
      list.forEach(function (s) { mx += s.lng; my += s.lat; });
      mx /= list.length; my /= list.length;
      var label = compassLabel(ccx, ccy, mx, my, maxOff);
      var z = zoneFor('a:' + ci, label);
      z.stores = z.stores.concat(list);
    });
  }
  function compassLabel(cx0, cy0, x, y, spread) {
    var dx = x - cx0, dy = y - cy0, d = Math.sqrt(dx * dx + dy * dy);
    if (spread <= 0 || d < spread * 0.18) return '核心城区';
    var names = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
    var ang = Math.atan2(dy, dx);
    var idx = Math.round(((ang + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
    return names[idx] + '片区';
  }

  var zones = Object.keys(zoneMap).map(function (k) { return zoneMap[k]; });
  // 按门店数排序后着色，保持稳定
  zones.sort(function (a, b) { return b.stores.length - a.stores.length; });
  zones.forEach(function (z, i) { z.color = ZONE_COLORS[i % ZONE_COLORS.length]; });
  zones.forEach(function (z) {
    if (!z.stores.length) return;
    var sx = 0, sy = 0;
    z.stores.forEach(function (s) { sx += s.px; sy += s.py; });
    z.x = sx / z.stores.length; z.y = sy / z.stores.length;
    z.r = Math.min(150, Math.max(84, 62 + z.stores.length * 22));
  });
  zones = zones.filter(function (z) { return z.stores.length; });

  /* ---------- 区块防重叠扩散（保持相对方位） ---------- */
  for (var iter = 0; iter < 80; iter++) {
    var moved = false;
    for (var i = 0; i < zones.length; i++) for (var j = i + 1; j < zones.length; j++) {
      var a = zones[i], b = zones[j];
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      var min = (a.r + b.r) * 0.82 + 26;
      if (d < min) {
        var push = (min - d) / 2, ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
        moved = true;
      }
    }
    zones.forEach(function (z) {
      z.x = Math.min(Math.max(z.x, PAD * 0.7 + z.r), W - PAD * 0.7 - z.r);
      z.y = Math.min(Math.max(z.y, PAD * 0.55 + z.r), laneTop - z.r * 0.7);
    });
    if (!moved) break;
  }

  /* ---------- 门店在区块内的落位（保序 + 防碰撞） ---------- */
  zones.forEach(function (z) {
    var n = z.stores.length;
    if (n === 1) { z.stores[0].mx = z.x; z.stores[0].my = z.y; return; }
    var gx = 0, gy = 0, maxRel = 0;
    z.stores.forEach(function (s) { gx += s.px; gy += s.py; });
    gx /= n; gy /= n;
    z.stores.forEach(function (s) {
      var rx = s.px - gx, ry = s.py - gy;
      maxRel = Math.max(maxRel, Math.sqrt(rx * rx + ry * ry));
    });
    var fit = maxRel > 0 ? Math.min(1, (z.r - 46) / maxRel) : 1;
    z.stores.forEach(function (s) {
      s.mx = z.x + (s.px - gx) * fit;
      s.my = z.y + (s.py - gy) * fit;
    });
    for (var it = 0; it < 50; it++) {
      var hit = false;
      for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
        var p = z.stores[i], q = z.stores[j];
        var dx = q.mx - p.mx, dy = q.my - p.my;
        var d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        if (d < 82) {
          var push = (82 - d) / 2, ux = dx / d, uy = dy / d;
          p.mx -= ux * push; p.my -= uy * push; q.mx += ux * push; q.my += uy * push;
          hit = true;
        }
      }
      if (!hit) break;
    }
  });

  /* ---------- 无坐标门店：底部示意车道 ---------- */
  if (nogeo.length) {
    nogeo.forEach(function (s, i) {
      var row = Math.floor(i / perRow), col = i % perRow;
      var rowCount = Math.min(perRow, nogeo.length - row * perRow);
      s.mx = rowCount === 1 ? W / 2
        : W / 2 + (col - (rowCount - 1) / 2) * (W - 260) / Math.max(perRow - 1, 1);
      s.my = laneY + 52 + row * 52;
    });
  }

  /* ---------- 绘制卡通场景 ---------- */
  var svg = $('map');
  var parts = [];
  // 纸面点阵
  var dots = [];
  for (var gx2 = 30; gx2 < W; gx2 += 46) for (var gy2 = 30; gy2 < H; gy2 += 46) dots.push(gx2 + ',' + gy2);
  parts.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#FFFDF6"/>');
  var dotStr = dots.map(function (p) { return '<circle cx="' + p.split(',')[0] + '" cy="' + p.split(',')[1] + '" r="1.6"/>'; }).join('');
  parts.push('<g fill="#F0E4C8" opacity=".6">' + dotStr + '</g>');

  // 街区地块（每个区块内 2-3 个装饰小楼）
  zones.forEach(function (z) {
    var r = rng(hashStr(z.label));
    for (var i = 0; i < 3; i++) {
      var bx = z.x + (r() - 0.5) * z.r * 1.5, by = z.y + (r() - 0.5) * z.r * 1.4;
      parts.push('<rect x="' + (bx - 11) + '" y="' + (by - 8) + '" width="22" height="16" rx="3" fill="#FFF3DC" stroke="#EBD9AF" stroke-width="1"/>');
    }
    var trees = 2 + Math.floor(r() * 3);
    for (var t = 0; t < trees; t++) {
      var tx = z.x + (r() - 0.5) * z.r * 1.9, ty = z.y + (r() - 0.5) * z.r * 1.8;
      parts.push(treeGlyph(tx, ty));
    }
  });

  // 城市公园（放在离所有区块最远的角落）
  var corners = [[W * 0.17, H * 0.18], [W * 0.83, H * 0.18], [W * 0.17, H * 0.8], [W * 0.83, H * 0.8]];
  var best = corners[0], bestD = -1;
  corners.forEach(function (c) {
    var dmin = 1 / 0;
    zones.forEach(function (z) {
      var dd = Math.sqrt((c[0] - z.x) * (c[0] - z.x) + (c[1] - z.y) * (c[1] - z.y));
      if (dd < dmin) dmin = dd;
    });
    if (nogeo.length) { var dl = Math.abs(c[1] - (H - 70)); if (dl < dmin) dmin = dl; }
    if (dmin > bestD) { bestD = dmin; best = c; }
  });
  if (zones.length) {
    parts.push('<ellipse cx="' + best[0] + '" cy="' + best[1] + '" rx="62" ry="44" fill="#DCEEDC" stroke="#82C277" stroke-width="2" opacity=".8"/>');
    parts.push(treeGlyph(best[0] - 26, best[1] + 4) + treeGlyph(best[0] + 20, best[1] - 8) + treeGlyph(best[0] + 4, best[1] + 12));
    parts.push('<text x="' + best[0] + '" y="' + (best[1] + 34) + '" text-anchor="middle" font-size="11" fill="#5B8A52">城市公园</text>');
  }

  // 路网：区块间的连接道路 + 外环
  function road(x1, y1, x2, y2, seed) {
    var r = rng(seed);
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    var dx = x2 - x1, dy = y2 - y1, len = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
    var off = (r() - 0.5) * len * 0.3;
    var qx = mx - dy / len * off, qy = my + dx / len * off;
    return '<path d="M' + x1 + ',' + y1 + ' Q' + qx + ',' + qy + ' ' + x2 + ',' + y2 + '" fill="none" stroke="#F0E0BE" stroke-width="13" stroke-linecap="round"/>'
      + '<path d="M' + x1 + ',' + y1 + ' Q' + qx + ',' + qy + ' ' + x2 + ',' + y2 + '" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="9 11" stroke-linecap="round" opacity=".9"/>';
  }
  var byX = zones.slice().sort(function (a, b) { return a.x - b.x; });
  for (var i = 0; i + 1 < byX.length; i++) {
    parts.push(road(byX[i].x, byX[i].y, byX[i + 1].x, byX[i + 1].y, hashStr(byX[i].label + byX[i + 1].label)));
  }
  // 无区块时画网格街道兜底
  if (!zones.length) {
    for (var gy3 = H * 0.22; gy3 < H * 0.85; gy3 += H * 0.24) {
      parts.push('<path d="M40,' + gy3 + ' Q' + W / 2 + ',' + (gy3 + 30) + ' ' + (W - 40) + ',' + gy3 + '" fill="none" stroke="#F0E0BE" stroke-width="13"/>');
    }
  }

  // 辖区区块（圆角矩形泡泡 + 标签）
  zones.forEach(function (z) {
    var w = z.r * 2.1, h2 = z.r * 1.9;
    parts.push('<rect x="' + (z.x - w / 2) + '" y="' + (z.y - h2 / 2) + '" width="' + w + '" height="' + h2 + '" rx="' + Math.min(w, h2) * 0.42 + '" fill="' + z.color.fill + '" stroke="' + z.color.stroke + '" stroke-width="2.5" stroke-dasharray="10 7" opacity=".9"/>');
    var lw = Math.max(z.label.length * 13 + 148, 150);
    parts.push('<g transform="translate(' + (z.x - lw / 2) + ',' + (z.y - h2 / 2 - 30) + ')"'
      + '<rect width="' + lw + '" height="26" rx="13" fill="#FFFFFF" stroke="' + z.color.stroke + '" stroke-width="1.5"/>'
      + '<circle cx="15" cy="13" r="5" fill="' + z.color.stroke + '"/>'
      + '<text x="27" y="17.5" font-size="13" font-weight="700" fill="' + z.color.label + '">' + esc(z.label) + ' · ' + z.stores.length + ' 家门店</text></g>');
  });

  // 街道名（来自官方 address 字段，去重，每区最多 1 条）
  var usedStreets = {};
  zones.forEach(function (z) {
    var st = '';
    for (var i = 0; i < z.stores.length; i++) {
      var s = streetOf(z.stores[i].address);
      if (s && !usedStreets[s]) { st = s; usedStreets[s] = 1; break; }
    }
    if (!st) return;
    var sw = st.length * 12 + 26;
    parts.push('<g transform="translate(' + (z.x + z.r * 0.55 - sw / 2) + ',' + (z.y + z.r * 0.95 + 26) + ')" opacity=".95">'
      + '<rect width="' + sw + '" height="20" rx="10" fill="#FFFFFF" stroke="#E4D2A8" stroke-width="1"/>'
      + '<path d="M10,6 L10,14 M14,6 L14,14" stroke="#C9B27E" stroke-width="1.6"/>'
      + '<text x="22" y="14" font-size="11" fill="#8A7660">' + esc(st) + '</text></g>');
  });

  // 底部示意车道（无坐标门店）
  if (nogeo.length) {
    parts.push('<rect x="70" y="' + laneY + '" width="' + (W - 140) + '" height="' + laneH + '" rx="18" fill="#FFF6E3" stroke="#EAD9AE" stroke-dasharray="7 6" stroke-width="1.5"/>');
    parts.push('<text x="' + (W / 2) + '" y="' + (laneY + 20) + '" text-anchor="middle" font-size="11" fill="#B09555">📍 以下门店官方数据未含经纬度，按示意排列</text>');
  }

  // 指北针 + 城市徽章 + 示意图水印
  parts.push('<g transform="translate(' + (W - 48) + ',52)"><circle r="17" fill="#FFFFFF" stroke="#E4D2A8" stroke-width="1.5"/>'
    + '<path d="M0,-10 L4.5,7 L0,3 L-4.5,7 Z" fill="#DA291C"/><text y="-24" text-anchor="middle" font-size="11" font-weight="800" fill="#8A7660">N</text></g>');
  var cityText = '📍 ' + (D.city || '麦麦活动');
  parts.push('<g transform="translate(24,' + (H - 26) + ')"><rect width="' + (cityText.length * 13 + 24) + '" height="26" rx="13" fill="#DA291C"/>'
    + '<text x="14" y="17.5" font-size="12.5" font-weight="700" fill="#FFE9A8">' + esc(cityText) + '</text></g>');
  parts.push('<text x="' + (W - 22) + '" y="' + (H - 18) + '" text-anchor="end" font-size="11" fill="#C4AE85">卡通示意图 · 非精确地图</text>');

  /* ---------- 门店标记（卡通麦当劳小屋） ---------- */
  function marker(s, dim) {
    var x = Math.round(s.mx), y = Math.round(s.my);
    return '<g class="mk' + (dim ? ' dim' : '') + '" data-key="' + esc(s.key) + '" transform="translate(' + x + ',' + y + ')"'
      + ' role="button" tabindex="0" aria-pressed="false" aria-label="' + esc(s.name) + '">'
      + '<g class="mkbody">'
      + '<ellipse cy="30" rx="21" ry="6" fill="rgba(90,60,20,.12)"/>'
      + '<rect x="-17" y="-4" width="34" height="30" rx="4" fill="#FFFFFF" stroke="#E7D8B8" stroke-width="1.5"/>'
      + '<path d="M-19,-4 L0,-19 L19,-4 Z" fill="#DA291C"/>'
      + '<rect x="-8" y="9" width="16" height="17" rx="2.5" fill="#FFE9B8" stroke="#EBD39A"/>'
      + '<line x1="0" y1="9" x2="0" y2="26" stroke="#EBD39A" stroke-width="1.5"/>'
      + '<circle cy="-27" r="11" fill="#DA291C" stroke="#FFFFFF" stroke-width="2"/>'
      + '<text y="-22.5" text-anchor="middle" font-size="13" font-weight="900" fill="#FFC72C" font-family="Arial, sans-serif">M</text>'
      + '<g class="bub" transform="translate(16,-34)"><circle r="10.5" fill="#FFC72C" stroke="#FFFFFF" stroke-width="2"/>'
      + '<text class="bubn" y="3.8" text-anchor="middle" font-size="11" font-weight="800" fill="#5A3A10">0</text></g>'
      + '</g></g>';
  }
  function treeGlyph(x, y) {
    return '<g transform="translate(' + x + ',' + y + ')"><rect x="-1.6" y="2" width="3.2" height="7" rx="1" fill="#9C6B3F"/>'
      + '<circle cy="-4" r="7.5" fill="#7FBF72"/><circle cx="-5.5" cy="-1" r="5" fill="#8FCC82"/></g>';
  }

  var allStores = zones.reduce(function (acc, z) { return acc.concat(z.stores); }, []).concat(nogeo);
  allStores.forEach(function (s) { parts.push(marker(s, false)); });
  svg.innerHTML = parts.join('');

  /* ---------- 筛选与卡片 ---------- */
  var state = { date: 'all', activity: 'all', status: 'all', store: null, shown: 80 };
  var perStoreNow = {};   // 当前筛选下各门店场次数（悬停提示用）
  var currentList = [];   // 当前筛选结果（导出日历用）
  var dates = [], dateSet = {};
  events.forEach(function (e) { if (!dateSet[e.startDate]) { dateSet[e.startDate] = 1; dates.push(e.startDate); } });
  dates.sort();
  var titles = [], titleSet = {};
  events.forEach(function (e) { if (!titleSet[e.title]) { titleSet[e.title] = 1; titles.push(e.title); } });
  titles.sort();

  function filtered() {
    return events.filter(function (e) {
      if (state.date !== 'all') {
        if (state.date === 'weekend') { if (wdIdx(e.startDate) !== 0 && wdIdx(e.startDate) !== 6) return false; }
        else if (e.startDate !== state.date) return false;
      }
      if (state.activity !== 'all' && e.title !== state.activity) return false;
      if (state.status !== 'all' && e.bookingStatus !== state.status) return false;
      if (state.store !== null && storeKey(e) !== state.store) return false;
      return true;
    });
  }

  function cardHtml(e) {
    var p = parseDetail(e.detail);
    var tagColor = TAG_COLORS[hashStr(e.title) % TAG_COLORS.length];
    var badge = e.bookingStatus === 'open' ? '<span class="badge b-open">可预约</span>'
      : e.bookingStatus === 'full' ? '<span class="badge b-full">已满</span>'
      : '<span class="badge b-unk">状态未核实</span>';
    var s = storeList[storeIdx[storeKey(e)]];
    var addr = s && s.address ? '<span class="addr">' + esc(s.address) + '</span>' : '';
    return '<div class="card" data-key="' + esc(storeKey(e)) + '" style="border-left-color:' + tagColor + '">'
      + '<div class="c1"><span class="tag" style="color:' + tagColor + '">' + esc(e.title) + '</span>' + badge + '</div>'
      + '<div class="c2">🍟 ' + esc(e.store) + addr + '</div>'
      + '<div class="c3"><span class="d">' + shortDate(e.startDate) + ' 周' + wdName(e.startDate) + '</span>'
      + '<span class="t">' + esc(e.session || '时间未提供') + '</span>'
      + (p.left != null ? '<span class="l">余 ' + esc(p.left) + '</span>' : '')
      + (p.approx != null ? '<span class="p">¥' + esc(p.approx) + '<i>原始 ' + esc(p.price) + ' 分</i></span>'
        : p.price != null ? '<span class="p">' + esc(p.price) + '<i>单位待核实</i></span>'
        : '<span class="p-na">价格未提供</span>')
      + '</div></div>';
  }

  function applyFilters(scrollTop) {
    hideTip();
    var list = filtered().slice().sort(function (a, b) {
      return a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1
        : (a.session || '') < (b.session || '') ? -1 : (a.session || '') > (b.session || '') ? 1
        : a.title < b.title ? -1 : 1;
    });
    var html = '', n = Math.min(state.shown, list.length);
    currentList = list;
    for (var i = 0; i < n; i++) html += cardHtml(list[i]);
    if (list.length > state.shown) html += '<button class="morebtn" id="morebtn">显示更多（还有 ' + (list.length - state.shown) + ' 场）</button>';
    if (!list.length) html = '<div class="empty">当前筛选条件下没有场次，试试放宽日期或活动类型。</div>';
    $('cards').innerHTML = html;
    var mb = $('morebtn');
    if (mb) mb.onclick = function () { state.shown += 120; applyFilters(false); };
    $('count').textContent = list.length === events.length
      ? '共 ' + events.length + ' 场' : '当前 ' + list.length + ' / ' + events.length + ' 场';
    // 地图气泡与选中态
    var perStore = {};
    list.forEach(function (e) {
      var k = storeKey(e);
      perStore[k] = (perStore[k] || 0) + 1;
    });
    perStoreNow = perStore;
    svg.querySelectorAll('g.mk').forEach(function (g) {
      var k = g.getAttribute('data-key');
      var num = g.querySelector('.bubn');
      var cnt = perStore[k] || 0;
      if (num) num.textContent = cnt > 99 ? '99+' : String(cnt);
      g.classList.toggle('dim', cnt === 0);
      g.classList.toggle('sel', state.store === k);
      var nm = storeIdx[k] != null ? storeList[storeIdx[k]].name : k;
      g.setAttribute('aria-label', nm + '：当前筛选 ' + cnt + ' 场' + (cnt === 0 ? '，已置灰' : ''));
      g.setAttribute('aria-pressed', state.store === k ? 'true' : 'false');
    });
    // 门店筛选提示条
    var fs = $('fstore');
    if (state.store !== null) {
      var st = storeList[storeIdx[state.store]];
      fs.style.display = 'block';
      fs.innerHTML = '<span class="schip">门店：' + esc(st ? st.name : state.store) + ' ✕</span>';
      fs.querySelector('.schip').onclick = function () { state.store = null; applyFilters(true); };
    } else { fs.style.display = 'none'; fs.innerHTML = ''; }
    // 筛选控件同步
    document.querySelectorAll('.dchip').forEach(function (c) {
      c.classList.toggle('on', c.getAttribute('data-v') === state.date);
    });
    document.querySelectorAll('.tl').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === state.activity);
    });
    var ib = $('icsbtn');
    if (ib) ib.textContent = list.length ? '📅 导出日历（' + list.length + '）' : '📅 导出日历';
    if (scrollTop) { var cw = $('cards'); cw.scrollTop = 0; }
  }

  // 日期 chips
  var chipsHtml = '<button class="dchip on" data-v="all">全部日期</button>'
    + '<button class="dchip" data-v="weekend">周末</button>';
  dates.forEach(function (d) {
    chipsHtml += '<button class="dchip" data-v="' + d + '">' + shortDate(d) + ' 周' + wdName(d) + '</button>';
  });
  $('dchips').innerHTML = chipsHtml;
  document.querySelectorAll('.dchip').forEach(function (c) {
    c.onclick = function () { state.date = c.getAttribute('data-v'); state.shown = 80; applyFilters(true); };
  });

  // 活动 / 状态下拉
  var actHtml = '<option value="all">全部活动类型</option>';
  titles.forEach(function (t) { actHtml += '<option value="' + esc(t) + '">' + esc(t) + '</option>'; });
  $('fact').innerHTML = actHtml;
  $('fact').onchange = function () { state.activity = this.value; state.shown = 80; applyFilters(true); };
  $('fstat').innerHTML = '<option value="all">全部状态</option><option value="open">可预约</option>'
    + '<option value="full">已满</option><option value="unknown">状态未核实</option>';
  $('fstat').onchange = function () { state.status = this.value; state.shown = 80; applyFilters(true); };

  // 活动类型色标（颜色与卡片左边框一致，点击/回车可筛选）
  var tlHtml = '<span class="tl on" data-v="all" role="button" tabindex="0">'
    + '<i style="background:#BDB3A2"></i>全部活动类型</span>';
  titles.forEach(function (t) {
    var c = TAG_COLORS[hashStr(t) % TAG_COLORS.length];
    tlHtml += '<span class="tl" data-v="' + esc(t) + '" role="button" tabindex="0">'
      + '<i style="background:' + c + '"></i>' + esc(t) + '</span>';
  });
  $('tlegend').innerHTML = tlHtml;
  document.querySelectorAll('.tl').forEach(function (b) {
    function pick() {
      state.activity = b.getAttribute('data-v');
      state.shown = 80;
      $('fact').value = state.activity;
      applyFilters(true);
    }
    b.onclick = pick;
    b.onkeydown = function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); pick(); }
    };
  });
  $('freset').onclick = function () {
    state = { date: 'all', activity: 'all', status: 'all', store: null, shown: 80 };
    $('fact').value = 'all'; $('fstat').value = 'all';
    applyFilters(true);
  };

  // 地图点击 → 门店筛选
  svg.addEventListener('click', function (ev) {
    var g = ev.target.closest ? ev.target.closest('g.mk') : null;
    if (!g) return;
    var k = g.getAttribute('data-key');
    state.store = (state.store === k) ? null : k;
    state.shown = 80;
    applyFilters(true);
  });

  // 卡片点击 → 门店标记脉冲
  $('cards').addEventListener('click', function (ev) {
    var card = ev.target.closest('.card');
    if (!card) return;
    var k = card.getAttribute('data-key');
    var g = svg.querySelector('g.mk[data-key="' + k + '"]');
    if (g) {
      g.classList.remove('pulse');
      g.getBoundingClientRect();   // 强制重排以重启动画
      g.classList.add('pulse');
      setTimeout(function () { g.classList.remove('pulse'); }, 1200);
    }
  });

  /* ---------- 导出日历（.ics）：只导出当前筛选结果 ---------- */
  // 注意：本段位于 CLIENT_JS 模板字符串内，源码里的反斜杠会被吞掉，
  // 因此一律用字符码构造转义符，不写任何字面反斜杠。
  var BS = String.fromCharCode(92), LF = String.fromCharCode(10), CR = String.fromCharCode(13);
  var CRLF = CR + LF, BOM = String.fromCharCode(65279);
  function icsEsc(s) {
    var out = String(s == null ? '' : s);
    out = out.split(CR).join('');
    out = out.split(BS).join(BS + BS);
    out = out.split(';').join(BS + ';');
    out = out.split(',').join(BS + ',');
    out = out.split(LF).join(BS + 'n');
    return out;
  }
  function pad2(n) { var v = Number(n); return v < 10 ? '0' + v : String(v); }
  function nextDay(d) {
    var p = String(d).split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + 86400000).toISOString().slice(0, 10);
  }
  function icsStamp() {
    var d = new Date();
    return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + 'T'
      + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + 'Z';
  }
  function buildIcs(list) {
    var out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//McEvent Radar//ZH', 'CALSCALE:GREGORIAN'];
    var stamp = icsStamp(), allDay = 0;
    list.forEach(function (e, i) {
      var s = storeIdx[storeKey(e)] != null ? storeList[storeIdx[storeKey(e)]] : null;
      // 分隔符用「非数字」匹配，不用空格类简写（模板字符串会吞掉反斜杠）
      var m = /([0-9]{1,2}):([0-9]{2})[^0-9]*([0-9]{1,2}):([0-9]{2})/.exec(e.session || '');
      var dStart, dEnd, timeNote = '';
      if (m) {
        dStart = 'DTSTART:' + e.startDate.replace(/-/g, '') + 'T' + pad2(m[1]) + m[2] + '00';
        dEnd = 'DTEND:' + e.startDate.replace(/-/g, '') + 'T' + pad2(m[3]) + m[4] + '00';
      } else {
        allDay++;
        dStart = 'DTSTART;VALUE=DATE:' + e.startDate.replace(/-/g, '');
        dEnd = 'DTEND;VALUE=DATE:' + nextDay(e.startDate).replace(/-/g, '');
        timeNote = '（官方未提供场次时间，已按全天事件创建）';
      }
      var p = parseDetail(e.detail);
      var desc = ['场次：' + (e.session || '未提供') + timeNote,
        p.left != null ? '剩余名额：' + p.left : '',
        p.approx != null ? '费用：约 ¥' + p.approx + '（原始字段 ' + p.price + ' 分）'
          : p.price != null ? '费用原始字段：' + p.price + '（单位待核实）' : '',
        '门店：' + (s ? s.name : e.store),
        '数据：麦当劳官方 MCP 实时查询，获取于 ' + fmtRetrieved(D.retrievedAt) + '；名额可能变化，以官方为准。'
      ].filter(Boolean).join(LF);
      out.push('BEGIN:VEVENT',
        'UID:mcd-' + hashStr(e.title + e.store + e.startDate + (e.session || '')) + '-' + i + '@mcevent-radar',
        'DTSTAMP:' + stamp, dStart, dEnd,
        'SUMMARY:' + icsEsc(e.title + ' · ' + (s ? (s.shortName || s.name) : e.store)),
        'LOCATION:' + icsEsc(s && s.address ? s.address : (s ? s.name : e.store)),
        'DESCRIPTION:' + icsEsc(desc),
        'END:VEVENT');
    });
    out.push('END:VCALENDAR');
    return { text: out.join(CRLF), allDay: allDay };
  }
  var icsBtn = $('icsbtn');
  if (icsBtn) icsBtn.onclick = function () {
    if (!currentList.length) return;
    var r = buildIcs(currentList);
    var blob = new Blob([BOM + r.text], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var datePart = (D.from || D.to) ? '_' + (D.from || '') + (D.to ? '至' + D.to : '') : '';
    a.download = '麦麦活动_' + (D.city || '活动') + datePart + '.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    this.textContent = '✅ 已导出 ' + currentList.length + ' 场';
    this.title = r.allDay ? '其中 ' + r.allDay + ' 场未提供场次时间，已按全天事件创建' : '已导出到下载目录';
    setTimeout(function () { applyFilters(false); }, 1600);
  };

  /* ---------- 门店悬停提示（气泡样式改编自 Uiverse.io vinodjangid07，MIT） ---------- */
  var tipEl = $('mtooltip');
  var wrapEl = document.querySelector('.mapwrap');
  function hideTip() { tipEl.classList.remove('show'); }
  function showTip(g) {
    var k = g.getAttribute('data-key');
    var st = storeIdx[k] != null ? storeList[storeIdx[k]] : null;
    if (!st) return;
    var cnt = perStoreNow[k] || 0;
    tipEl.innerHTML = '<div class="mt-name">🍟 ' + esc(st.shortName || st.name) + '</div>'
      + (st.address ? '<div class="mt-addr">' + esc(st.address) + '</div>' : '')
      + '<div class="mt-cnt">' + (cnt > 0 ? '当前筛选 <b>' + cnt + '</b> 场活动' : '当前筛选下暂无场次') + '</div>'
      + '<div class="mt-hint">' + (state.store === k ? '再次点击取消本店筛选' : '点击可只看这家店') + '</div>';
    var rect = g.getBoundingClientRect(), wr = wrapEl.getBoundingClientRect();
    var x = rect.left + rect.width / 2 - wr.left;
    var below = (rect.top - wr.top) < 100;
    var tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    var left = Math.min(Math.max(x, tw / 2 + 4), Math.max(wr.width - tw / 2 - 4, tw / 2 + 4));
    tipEl.classList.toggle('below', below);
    tipEl.style.left = left + 'px';
    tipEl.style.top = (below ? (rect.bottom - wr.top + 12) : (rect.top - wr.top - th - 12)) + 'px';
    tipEl.classList.add('show');
  }
  svg.querySelectorAll('g.mk').forEach(function (g) {
    g.addEventListener('mouseenter', function () { showTip(g); });
    g.addEventListener('mouseleave', hideTip);
    // 键盘可达：聚焦即出提示，回车/空格切换本店筛选
    g.addEventListener('focus', function () { showTip(g); });
    g.addEventListener('blur', hideTip);
    g.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
        ev.preventDefault();
        var k = g.getAttribute('data-key');
        state.store = (state.store === k) ? null : k;
        state.shown = 80;
        applyFilters(true);
      }
    });
  });
  window.addEventListener('resize', hideTip);

  // 顶部统计
  var openCnt = events.filter(function (e) { return e.bookingStatus === 'open'; }).length;
  $('st-total').innerHTML = '<b>' + events.length + '</b> 场次';
  $('st-open').innerHTML = '<b>' + openCnt + '</b> 可预约';
  $('st-store').innerHTML = '<b>' + storeList.length + '</b> 门店';
  $('st-kind').innerHTML = '<b>' + titles.length + '</b> 类活动';
  $('st-time').textContent = '获取于 ' + fmtRetrieved(D.retrievedAt);

  applyFilters(false);
}
`;

function renderHtmlMap(data) {
  const { query, retrievedAt, note, stores, events, districts } = data;
  const cityLabel = query.city ?? '全部城市';
  const rangeLabel = query.from && query.to ? `${query.from} 至 ${query.to}` : '日期不限';
  const title = `麦麦活动地图 · ${cityLabel} · ${rangeLabel}`;

  const payload = {
    city: query.city ?? null,
    from: query.from ?? null,
    to: query.to ?? null,
    keyword: query.keyword ?? null,
    retrievedAt,
    note: note ?? null,
    stores: stores ?? {},
    events,
    districts: districts ?? null,
  };

  const disclaimer = [
    '卡通示意图：门店标记的相对位置由麦当劳官方 MCP（query-party-store）返回的经纬度投影得出；辖区区块、道路与公园为卡通示意，非精确地理地图。',
    '价格：场次接口原始字段经与商城同商品价格（元）交叉核实，倍率一致（×100）时判定单位为分并显示约价（如 ¥138 = 13800 分），否则保留原始值并标注「单位待核实」；名额与状态以 query-party-store-session 实时返回为准，可能变化。',
    `数据获取：${retrievedAt ?? '未提供'}（北京时间显示）。`,
    note ?? '',
  ].filter(Boolean);

  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Ccircle cx=%2716%27 cy=%2716%27 r=%2716%27 fill=%27%23DA291C%27/%3E%3Ctext x=%2716%27 y=%2722%27 text-anchor=%27middle%27 font-size=%2717%27 font-weight=%27900%27 fill=%27%23FFC72C%27 font-family=%27Arial%27%3EM%3C/text%3E%3C/svg%3E">',
    `<style>${CSS}</style>`,
    '</head>',
    '<body>',
    '<header class="topbar">',
    '<div class="brand">🍟 麦麦活动<em>地图</em> · ' + escapeHtml(cityLabel) + '</div>',
    `<div class="topmeta">${escapeHtml(rangeLabel)} · 区块与道路为卡通示意，门店位置来自官方经纬度</div>`,
    '</header>',
    '<main class="layout">',
    '<section class="mapcol">',
    '<div class="stats">',
    '<span class="schip" id="st-total"></span>',
    '<span class="schip ok" id="st-open"></span>',
    '<span class="schip" id="st-store"></span>',
    '<span class="schip" id="st-kind"></span>',
    '<span class="schip" id="st-time"></span>',
    '</div>',
    '<div class="mapwrap"><svg id="map" viewBox="0 0 1000 640" xmlns="http://www.w3.org/2000/svg"></svg><div class="mtooltip" id="mtooltip"></div></div>',
    '<div class="legend">',
    '<span>🏠 门店小屋（位置=官方经纬度投影）</span>',
    '<span>🟡 气泡=当前筛选下场次数</span>',
    '<span>🖱️ 悬停看门店信息 · 点击门店筛选 / 点击卡片定位</span>',
    '</div>',
    '</section>',
    '<aside class="panel">',
    '<div class="fbar">',
    '<div class="dchips" id="dchips"></div>',
    '<div class="frow">',
    '<select id="fact"></select>',
    '<select id="fstat"></select>',
    '<button id="freset"><span>重置</span></button>',
    '</div>',
    '<div class="fstore" id="fstore"></div>',
    '<div class="tlegend" id="tlegend"></div>',
    '</div>',
    '<div class="cardshead"><span id="count"></span>'
    + '<span style="display:flex;align-items:center;gap:8px;">'
    + '<button class="icsbtn" id="icsbtn" title="把当前筛选结果导出为 .ics 日历文件；场次时间未提供的按全天事件创建">📅 导出日历</button>'
    + '<span>点击卡片可定位门店</span></span></div>',
    '<div class="cards" id="cards"></div>',
    '<div class="pfoot">' + escapeHtml(disclaimer.join(' ')) + '</div>',
    '</aside>',
    '</main>',
    `<script>window.__MCD_MAP_DATA__ = ${embedJson(payload)};</script>`,
    `<script>${CLIENT_JS}</script>`,
    '</body>',
    '</html>',
    ''].join('\n');
}

export { renderHtmlMap };
