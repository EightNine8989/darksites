// ===== 综合推荐评分引擎 =====
// 融合 5 个维度：天气 + 月相 + 方位 + 设备 + 季节
// 输出每个天体的 TonightScore，用于排序和推荐

import type { CelestialObject, CelestialPosition, MoonPhaseInfo, EquipmentSet, AppLanguage } from '../types';
import { computePosition, computeMoonPhase, computeSunInfo } from './astronomy';
import { fetchHourlyWeather, computeHourlyScore, findBestWindow } from './weather';
import type { GeoCoord, HourlyWeather } from '../types';

// ===== 类型 =====
export interface TonightScore {
  objectId: string;
  totalScore: number;       // 0-100 综合评分
  weatherScore: number;     // 0-100 天气评分
  moonScore: number;        // 0-100 月光评分
  altitudeScore: number;    // 0-100 方位/高度评分
  equipmentScore: number;  // 0-100 设备匹配评分
  seasonScore: number;      // 0-100 季节性评分
  bestTime: string;         // 最佳观测时间
  direction: string;        // 方位
  altitude: number;         // 高度角
  reasons: string[];        // 推荐理由
  warnings: string[];       // 注意事项
}

export interface TonightSummary {
  overallScore: number;          // 0-100 今晚整体评分
  bestWindow: string;            // 最佳观测时段 "22:00–02:00"
  moonPhase: string;            // 月相名称
  moonImpact: string;           // 月光影响描述
  topPicks: TonightScore[];     // 推荐天体 Top 5
  cloudCover: number;           // 云量百分比
  sunset: string;               // 日落时间
  astroDusk: string;            // 天文昏影终
  astroDawn: string;            // 天文昏影始
}

// ===== 季节数据（与 objects.ts/object-detail.ts 共享逻辑） =====
const SEASON_DATA: Record<string, number[]> = {
  sirius:      [2,2,1,0,0,0,0,0,0,0,1,2],
  arcturus:   [0,0,0,2,3,4,4,3,2,0,0,0],
  vega:       [0,0,0,0,2,3,4,4,3,1,0,0],
  altair:     [0,0,0,0,1,3,4,4,2,0,0,0],
  betelgeuse: [4,3,2,0,0,0,0,0,0,1,3,4],
  rigel:      [4,3,1,0,0,0,0,0,0,0,2,4],
  m31:        [4,3,2,0,0,0,0,0,0,1,3,4],
  m42:        [4,4,3,1,0,0,0,0,0,0,2,4],
  m45:        [4,3,2,0,0,0,0,0,0,1,3,4],
  moon:       [4,4,4,4,4,4,4,4,4,4,4,4],
  milkyway:   [0,0,0,0,1,3,4,4,3,1,0,0],
  perseids:   [0,0,0,0,0,0,0,4,4,0,0,0],
  mercury:    [2,2,2,2,2,2,2,2,2,2,2,2],
  venus:      [2,2,2,2,2,2,2,2,2,2,2,2],
  mars:       [2,2,2,2,2,2,2,2,2,2,2,2],
  jupiter:    [2,2,2,2,2,2,2,2,2,2,2,2],
  saturn:     [2,2,2,2,2,2,2,2,2,2,2,2],
};

// ===== 评分权重 =====
const WEIGHTS = {
  weather: 0.30,
  moon: 0.15,
  altitude: 0.25,
  equipment: 0.15,
  season: 0.15,
};

// ===== 主入口：计算今晚综合评分 =====
export async function computeTonightSummary(
  catalog: CelestialObject[],
  loc: GeoCoord,
  obsDate: Date,
  equipment: EquipmentSet,
  bortle: number,
  lang: AppLanguage = 'zh'
): Promise<TonightSummary> {
  const isZh = lang === 'zh';

  // 并行计算天文+天气
  const moonInfo = computeMoonPhase(obsDate, loc);
  const sunInfo = computeSunInfo(obsDate, loc);

  let weatherData: any = null;
  let weatherScore = 70; // 默认值（无天气数据时）
  let bestWindow = '';
  let cloudCover = 0;

  try {
    weatherData = await fetchHourlyWeather(loc);
    if (weatherData && weatherData.length > 0) {
      // 取观测时段的天气评分
      const hourlyScores = weatherData.map((h: any) => {
        const r = computeHourlyScore({
          cloudCover: h.cloudCover, moonAltitude: moonInfo.altitude,
          moonIllumination: moonInfo.illumination, sunAltitude: sunInfo.altitude,
          windSpeed: h.windSpeed, bortle, visibility: h.visibility
        });
        return { time: new Date(h.time), score: r.score };
      });
      const window = findBestWindow(hourlyScores);
      if (window) {
        bestWindow = `${window.start}–${window.end}`;
        weatherScore = window.score;
      }
      // 取当前云量
      const currentHour = weatherData.find((h: any) => {
        const ht = new Date(h.time);
        return Math.abs(ht.getTime() - obsDate.getTime()) < 30 * 60 * 1000;
      });
      if (currentHour) cloudCover = (currentHour as any).cloudCover || 0;
      else cloudCover = weatherData[0].cloudCover || 0;
    }
  } catch { /* weather fetch failed, use defaults */ }

  // 计算每个天体评分
  const scoredObjects: TonightScore[] = [];
  for (const obj of catalog) {
    const pos = computePosition(obj, loc, obsDate);
    if (!pos.visible || pos.altitude <= 0) continue;

    const score = computeObjectScore(obj, pos, moonInfo, weatherScore, equipment, isZh);
    scoredObjects.push(score);
  }

  // 排序取 Top 5
  scoredObjects.sort((a, b) => b.totalScore - a.totalScore);
  const topPicks = scoredObjects.slice(0, 5);

  // 今晚整体评分 = Top 5 平均分 × 天气系数
  const avgTopScore = topPicks.length > 0
    ? topPicks.reduce((s, o) => s + o.totalScore, 0) / topPicks.length
    : 0;
  const overallScore = Math.round(avgTopScore * (weatherScore / 100 + 0.2));

  // 月光影响描述
  let moonImpact = isZh ? '今晚无月光干扰' : 'No moon interference tonight';
  if (moonInfo.altitude > 0 && moonInfo.illumination > 0.5) {
    if (moonInfo.illumination > 0.8) {
      moonImpact = isZh ? '强月光干扰，深空天体难观测' : 'Strong moonlight, deep sky objects difficult';
    } else {
      moonImpact = isZh ? `月光影响中等 (${Math.round(moonInfo.illumination * 100)}%)` : `Moderate moon impact (${Math.round(moonInfo.illumination * 100)}%)`;
    }
  }

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    bestWindow,
    moonPhase: moonInfo.phaseName,
    moonImpact,
    topPicks,
    cloudCover,
    sunset: sunInfo.sunset,
    astroDusk: sunInfo.astronomicalDusk,
    astroDawn: sunInfo.astronomicalDawn,
  };
}

// ===== 单天体综合评分 =====
function computeObjectScore(
  obj: CelestialObject,
  pos: CelestialPosition,
  moonInfo: MoonPhaseInfo,
  weatherScore: number,
  equipment: EquipmentSet,
  isZh: boolean
): TonightScore {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. 天气评分（直接使用传入的天气分）
  const weatherS = weatherScore;

  // 2. 月光评分
  let moonS = 100;
  if (moonInfo.altitude > 0 && moonInfo.illumination > 0.5) {
    // 月亮附近的天体受影响更大
    const moonDist = Math.abs(pos.azimuth - moonInfo.azimuth);
    const angularDist = Math.min(moonDist, 360 - moonDist);
    const moonPenalty = moonInfo.illumination * Math.max(0, (180 - angularDist) / 180) * 40;
    moonS = Math.round(100 - moonPenalty);
    if (moonS < 40) warnings.push(isZh ? '月光干扰强' : 'Strong moon interference');
  } else {
    reasons.push(isZh ? '月光条件好' : 'Good moon conditions');
  }

  // 3. 高度/方位评分
  let altitudeS = 0;
  if (pos.altitude >= 60) {
    altitudeS = 95;
    reasons.push(isZh ? '高空观测条件佳' : 'High altitude, excellent viewing');
  } else if (pos.altitude >= 30) {
    altitudeS = 70;
    reasons.push(isZh ? '中等高度' : 'Moderate altitude');
  } else if (pos.altitude >= 10) {
    altitudeS = 40;
    warnings.push(isZh ? '低空，大气扰动大' : 'Low altitude, atmospheric disturbance');
  } else {
    altitudeS = 15;
    warnings.push(isZh ? '极低空' : 'Very low altitude');
  }

  // 4. 设备匹配评分
  const equipmentS = computeEquipmentScore(obj, equipment, isZh);

  // 5. 季节评分
  const month = new Date().getMonth();
  const seasonArr = SEASON_DATA[obj.id];
  const seasonVal = seasonArr ? seasonArr[month] : 2;
  let seasonS = 0;
  if (seasonVal >= 4) { seasonS = 95; reasons.push(isZh ? '最佳季节' : 'Peak season'); }
  else if (seasonVal >= 3) { seasonS = 75; reasons.push(isZh ? '旺季' : 'Good season'); }
  else if (seasonVal >= 2) { seasonS = 50; }
  else if (seasonVal >= 1) { seasonS = 25; warnings.push(isZh ? '淡季' : 'Off season'); }
  else { seasonS = 10; warnings.push(isZh ? '不可见季节' : 'Not in season'); }

  // 加权综合
  const totalScore = Math.round(
    weatherS * WEIGHTS.weather +
    moonS * WEIGHTS.moon +
    altitudeS * WEIGHTS.altitude +
    equipmentS * WEIGHTS.equipment +
    seasonS * WEIGHTS.season
  );

  return {
    objectId: obj.id,
    totalScore: Math.max(0, Math.min(100, totalScore)),
    weatherScore: weatherS,
    moonScore: moonS,
    altitudeScore: altitudeS,
    equipmentScore: equipmentS,
    seasonScore: seasonS,
    bestTime: pos.bestTime,
    direction: pos.directionText,
    altitude: pos.altitude,
    reasons,
    warnings,
  };
}

// ===== 设备匹配评分 =====
function computeEquipmentScore(obj: CelestialObject, equipment: EquipmentSet, isZh: boolean): number {
  const objEquip = obj.equipment;
  if (!objEquip || objEquip.length === 0) return 70; // 无设备要求，默认70

  // 检查用户设备是否匹配
  const primaryItem = equipment.items.find(i => i.id === equipment.primary);
  if (!primaryItem) return 50;

  const userTypes = equipment.items.map(i => i.type);
  let score = 50; // 基础分

  // 裸眼对象
  if (objEquip.some(e => e.includes('肉眼') || e.includes('Naked eye') || e.includes('naked'))) {
    score = 90;
    if (userTypes.includes('naked_eye')) score = 100;
  }

  // 双筒镜对象
  if (objEquip.some(e => e.includes('双筒') || e.includes('Binocular') || e.includes('binocular'))) {
    score = Math.max(score, 70);
    if (userTypes.includes('binoculars')) score = Math.max(score, 95);
  }

  // 望远镜对象
  if (objEquip.some(e => e.includes('望远镜') || e.includes('Telescope') || e.includes('telescope'))) {
    score = Math.max(score, 60);
    if (userTypes.includes('telescope')) score = Math.max(score, 95);
  }

  // 相机对象
  if (objEquip.some(e => e.includes('相机') || e.includes('Camera') || e.includes('camera') || e.includes('广角'))) {
    score = Math.max(score, 60);
    if (userTypes.includes('camera')) score = Math.max(score, 90);
  }

  return score;
}

// ===== 天气数据缓存 =====
const WEATHER_CACHE_KEY = 'ds_weather_cache';
const WEATHER_CACHE_TTL = 15 * 60 * 1000; // 15 分钟

interface CachedWeather {
  lat: number;
  lon: number;
  timestamp: number;
  data: HourlyWeather[];
}

export function cacheWeatherData(loc: GeoCoord, data: HourlyWeather[]): void {
  try {
    const cache: CachedWeather = { lat: loc.lat, lon: loc.lon, timestamp: Date.now(), data };
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full */ }
}

export function getCachedWeather(loc: GeoCoord): HourlyWeather[] | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const cache: CachedWeather = JSON.parse(raw);
    // 检查 TTL 和位置匹配（10km 范围内）
    if (Date.now() - cache.timestamp > WEATHER_CACHE_TTL) return null;
    const dist = Math.sqrt((cache.lat - loc.lat) ** 2 + (cache.lon - loc.lon) ** 2) * 111;
    if (dist > 10) return null;
    return cache.data;
  } catch { return null; }
}
