// ===== 暗夜地点数据 =====
// 2.0 改为优先从后端 API 加载 + 硬编码 fallback
import type { DarkSite } from '../types';
import { fetchSitesNearby, pingApi } from './api';

export interface DarkSkyPlace {
  name: string; nameEn: string; region: string; country: string;
  lat: number; lon: number; bortle: number; type: string;
  yearCert?: number; altitudeM?: number; description: string;
}

// ===== 硬编码 fallback（中国+国际暗夜地点） =====
export const DARK_SKY_PLACES: DarkSkyPlace[] = [
  { name:'阿里暗夜公园', nameEn:'Ngari Dark Sky Park', region:'亚洲', country:'中国', lat:32.50, lon:80.08, bortle:1, type:'Park', yearCert:2018, altitudeM:5000, description:'Bortle 1级零光污染' },
  { name:'那曲暗夜保护地', nameEn:'Nagqu Dark Sky Reserve', region:'亚洲', country:'中国', lat:31.48, lon:92.05, bortle:1, type:'Reserve', altitudeM:4600, description:'海拔4600米' },
  { name:'冷湖暗夜保护区', nameEn:'Lenghu Dark Sky Reserve', region:'亚洲', country:'中国', lat:38.75, lon:93.35, bortle:1, type:'Reserve', altitudeM:2800, description:'晴夜率80%+' },
  { name:'黄龙国际暗夜公园', nameEn:'Huanglong IDSP', region:'亚洲', country:'中国', lat:32.75, lon:103.82, bortle:2, type:'Park', yearCert:2025, altitudeM:3800, description:'大陆首个IDA认证暗夜公园' },
  { name:'西涌暗夜社区', nameEn:'Xichong IDSC', region:'亚洲', country:'中国', lat:22.45, lon:114.35, bortle:4, type:'Community', yearCert:2023, description:'珠三角观星首选' },
  { name:'盐城野鹿荡', nameEn:'Dafeng Dark Sky Reserve', region:'亚洲', country:'中国', lat:33.22, lon:120.65, bortle:3, type:'Reserve', yearCert:2019, altitudeM:2, description:'长三角唯一暗夜地' },
  { name:'太行洪谷', nameEn:'Taihang Honggu', region:'亚洲', country:'中国', lat:36.20, lon:113.40, bortle:2, type:'Reserve', yearCert:2020, altitudeM:1200, description:'华北暗夜净土' },
  { name:'怀柔暗夜观测站', nameEn:'Huairou Station', region:'亚洲', country:'中国', lat:40.60, lon:116.65, bortle:4, type:'Station', altitudeM:600, description:'距北京最近' },
  { name:'特卡波湖', nameEn:'Lake Tekapo IDSR', region:'大洋洲', country:'新西兰', lat:-43.88, lon:170.52, bortle:1, type:'Reserve', yearCert:2012, altitudeM:700, description:'南十字星+麦哲伦云' },
  { name:'天然桥国家保护区', nameEn:'Natural Bridges', region:'北美洲', country:'美国', lat:37.61, lon:-109.99, bortle:1, type:'Park', yearCert:2007, altitudeM:2000, description:'IDA首个暗夜公园' },
  { name:'大峡谷', nameEn:'Grand Canyon', region:'北美洲', country:'美国', lat:36.10, lon:-112.11, bortle:2, type:'Park', yearCert:2019, altitudeM:2100, description:'世界遗产+暗夜公园' },
  { name:'蒙梅冈蒂克', nameEn:'Mont-Mégantic IDSR', region:'北美洲', country:'加拿大', lat:45.46, lon:-71.15, bortle:2, type:'Reserve', yearCert:2007, altitudeM:1100, description:'全球首个暗夜保护区' },
  { name:'加洛韦森林公园', nameEn:'Galloway Forest Park', region:'欧洲', country:'英国', lat:55.10, lon:-4.40, bortle:1, type:'Park', yearCert:2009, altitudeM:300, description:'欧洲首个暗夜公园' },
  { name:'拉帕尔马岛', nameEn:'La Palma', region:'欧洲', country:'西班牙', lat:28.76, lon:-17.89, bortle:1, type:'Reserve', yearCert:2012, altitudeM:2400, description:'世界顶级台址' },
];

// ===== 动态加载状态 =====
let _apiSites: DarkSite[] | null = null;
let _loading = false;

/** 从后端 API 加载附近暗夜站点 */
export async function loadApiSites(lat: number, lon: number, radiusKm: number = 300): Promise<DarkSite[]> {
  if (_loading) return _apiSites || [];
  _loading = true;

  try {
    const apiAlive = await pingApi();
    if (!apiAlive) {
      _loading = false;
      return [];
    }

    const sites = await fetchSitesNearby(lat, lon, radiusKm);
    _apiSites = sites;
    _loading = false;
    return sites;
  } catch {
    _loading = false;
    return [];
  }
}

/** 获取已加载的 API 站点（可能为 null 表示未加载） */
export function getApiSites(): DarkSite[] | null {
  return _apiSites;
}

/** 清除缓存（位置变化时调用） */
export function clearApiSitesCache(): void {
  _apiSites = null;
}

/** 后端 DarkSite → 前端 DarkSkyPlace 格式转换 */
export function darkSiteToPlace(s: DarkSite): DarkSkyPlace {
  const typeMap: Record<string, string> = {
    park: 'Park',
    reserve: 'Reserve',
    community: 'Community',
    sanctuary: 'Sanctuary',
    observatory: 'Observatory',
    station: 'Station',
  };
  const dsType = typeMap[(s as any).siteType?.toLowerCase?.()] || 'Station';
  return {
    name: s.name,
    nameEn: s.name,
    region: '',
    country: '',
    lat: s.lat,
    lon: s.lon,
    bortle: s.bortle,
    type: dsType,
    altitudeM: s.elevation,
    description: '',
    // API 站点用 id 存储，place-detail 可据此调 API 详情
    _apiId: s.id,
    _apiSite: s,
  } as DarkSkyPlace & { _apiId: string; _apiSite: DarkSite };
}

/** 合并硬编码地点 + API 站点（去重，按 name 判断） */
export function getAllPlaces(): DarkSkyPlace[] {
  const apiSites = _apiSites;
  if (!apiSites || apiSites.length === 0) return DARK_SKY_PLACES;

  const placeNames = new Set(DARK_SKY_PLACES.map(p => p.name.toLowerCase()));
  const converted = apiSites
    .filter(s => !placeNames.has(s.name.toLowerCase()))
    .map(darkSiteToPlace);

  return [...DARK_SKY_PLACES, ...converted];
}

/** 按 name / nameEn / id 查找地点 */
export function findPlace(placeId: string): DarkSkyPlace | undefined {
  const all = getAllPlaces();
  return all.find(p => p.name === placeId || p.nameEn === placeId || (p as any)._apiId === placeId);
}

export function darkSkyTypeLabel(type: string): string {
  const map: Record<string,string> = { Park:'暗夜公园', Reserve:'暗夜保护区', Community:'暗夜社区', Sanctuary:'庇护所', Observatory:'天文台', Station:'观测站' };
  return map[type] || type;
}
