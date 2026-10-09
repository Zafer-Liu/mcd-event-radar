#!/usr/bin/env node
// 麦麦活动雷达 · 位置检测（城市级）
//
// 「附近有什么活动」这类问题出发前的城市探测。
// 只做城市级 IP 定位：不收集、不上传精确坐标，结果必须经用户确认后才用于查询。
// 若用户开着 VPN/代理，检测到的是代理出口（常见为海外城市），脚本会明确提示。
//
// 用法：node scripts/locate.mjs [--json]

const TIMEOUT_MS = 8000;

// 常见城市英文 → 中文（未收录的保留英文原名，由用户确认）
const CN_CITY_MAP = new Map(Object.entries({
  Beijing: '北京', Shanghai: '上海', Guangzhou: '广州', Shenzhen: '深圳',
  Hangzhou: '杭州', Chengdu: '成都', Chongqing: '重庆', Tianjin: '天津',
  Wuhan: '武汉', "Xi'an": '西安', Xian: '西安', Nanjing: '南京', Suzhou: '苏州',
  Changsha: '长沙', Zhengzhou: '郑州', Jinan: '济南', Qingdao: '青岛',
  Hefei: '合肥', Fuzhou: '福州', Xiamen: '厦门', Ningbo: '宁波',
  Wenzhou: '温州', Dongguan: '东莞', Foshan: '佛山', Shenyang: '沈阳',
  Dalian: '大连', Harbin: '哈尔滨', Changchun: '长春', Shijiazhuang: '石家庄',
  Taiyuan: '太原', Nanchang: '南昌', Kunming: '昆明', Guiyang: '贵阳',
  Nanning: '南宁', Haikou: '海口', Lanzhou: '兰州', Xining: '西宁',
  Yinchuan: '银川', Hohhot: '呼和浩特', Urumqi: '乌鲁木齐', Lhasa: '拉萨',
  Nantong: '南通', Wuxi: '无锡', Changzhou: '常州', Xuzhou: '徐州',
  Yangzhou: '扬州', Taizhou: '泰州', Jiaxing: '嘉兴', Shaoxing: '绍兴',
  Jinhua: '金华', Zhuhai: '珠海', Huizhou: '惠州', Zhongshan: '中山',
  Jiangmen: '江门', Shantou: '汕头', Zhanjiang: '湛江', Guilin: '桂林',
  Luoyang: '洛阳', Kaifeng: '开封', Tangshan: '唐山', Baoding: '保定',
}));

function line(text = '') {
  process.stdout.write(`${text}\n`);
}

function maskIp(ip) {
  if (typeof ip !== 'string' || !ip.includes('.')) return ip ?? null;
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.*.*`;
}

async function fromIpinfo() {
  const response = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`ipinfo.io HTTP ${response.status}`);
  const data = await response.json();
  if (!data.city) throw new Error('ipinfo.io 未返回城市');
  return { city: data.city, region: data.region ?? null, country: data.country ?? null, ip: data.ip ?? null, source: 'ipinfo.io' };
}

async function fromIpSb() {
  const response = await fetch('https://api.ip.sb/geoip', {
    signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'curl/8.0' },
  });
  if (!response.ok) throw new Error(`api.ip.sb HTTP ${response.status}`);
  const data = await response.json();
  if (!data.city) throw new Error('api.ip.sb 未返回城市');
  return { city: data.city, region: data.region ?? null, country: data.country_code ?? null, ip: data.ip ?? null, source: 'api.ip.sb' };
}

async function detect() {
  const errors = [];
  for (const probe of [fromIpinfo, fromIpSb]) {
    try {
      return await probe();
    } catch (error) {
      errors.push(`${probe.name}: ${error.message}`);
    }
  }
  throw new Error(`所有定位端点都失败了（${errors.join('；')}）`);
}

function maskNull(value) {
  return value == null || value === '' ? null : value;
}

async function main() {
  const wantJson = process.argv.includes('--json');
  const detected = await detect();
  const result = {
    ...detected,
    cityZh: CN_CITY_MAP.get(detected.city) ?? null,
    likelyProxy: detected.country != null && detected.country.toUpperCase() !== 'CN',
    ipMasked: maskIp(detected.ip),
  };

  if (wantJson) {
    line(JSON.stringify(result, null, 2));
    return;
  }

  line('麦麦活动雷达 · 位置检测（城市级）');
  line();
  const cityText = result.cityZh ? `${result.cityZh}（${detected.city}）` : detected.city;
  const regionText = [maskNull(detected.region), detected.country].filter(Boolean).join(', ');
  line(`检测到的大致位置：${cityText}${regionText ? ` · ${regionText}` : ''}`);
  line(`IP（已打码）：${result.ipMasked} · 来源：${detected.source}`);
  line();
  if (result.likelyProxy) {
    line('⚠️  出口在海外（非中国大陆），大概率是 VPN/代理出口，可能不是你的真实城市。');
    line('    如果你确实在国内，直接告诉助手你在哪个城市即可。');
  } else {
    line('提示：这是城市级定位，不涉及精确坐标；是否按此城市查询，由用户确认。');
  }
}

main().catch((error) => {
  process.stderr.write(`错误：${error.message}\n`);
  process.exitCode = 1;
});
