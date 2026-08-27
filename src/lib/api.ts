// ===== 后端 API 客户端 =====
// 统一封装 Stargazing 后端所有 API 调用 + 类型映射
import type { CelestialObject, CelestialCategory, DarkSite } from '../types';

const API_BASE = 'http://localhost:8000/api/v1';

// ===== 后端原始类型（仅用于 API 层内部） =====
interface BackendObject {
  id: string;
  object_type: string;
  primary_name: string;
  catalog?: string | null;
  catalog_number?: string | null;
  constellation?: string | null;
  magnitude?: number | null;
  ra_j2000?: number | null;
  dec_j2000?: number | null;
  surface_brightness?: number | null;
  angular_size_major?: number | null;
  angular_size_minor?: number | null;
  naked_eye_possible?: boolean | null;
  metadata_?: Record<string, unknown> | null;
}

interface BackendSiteBrief {
  id: string;
  name: string;
  site_type?: string | null;
  state_code?: string | null;
  latitude: number;
  longitude: number;
  status: string;
  public_access: string;
}

interface BackendSiteDetail extends BackendSiteBrief {
  normalized_name?: string | null;
  aliases?: Record<string, unknown> | null;
  country_code?: string | null;
  county?: string | null;
  locality?: string | null;
  sources?: BackendSiteSource[];
  access?: BackendSiteAccess | null;
  static_conditions?: BackendSiteStaticConditions | null;
  area_memberships?: BackendSiteAreaMembership[];
}

interface BackendSiteSource {
  id: string;
  source_name: string;
  source_record_type: string;
  source_record_id: string;
  source_url?: string | null;
  is_primary: boolean;
}

interface BackendSiteAccess {
  night_access?: boolean | null;
  parking_available?: boolean | null;
  parking_distance_m?: number | null;
  parking_type?: string | null;
  parking_surface?: string | null;
  parking_lit?: boolean | null;
  toilet_available?: boolean | null;
  toilet_distance_m?: number | null;
  water_available?: boolean | null;
  water_distance_m?: number | null;
  car_accessible?: boolean | null;
  walking_required?: boolean | null;
  walking_distance_m?: number | null;
  gate_present?: boolean | null;
  fee_required?: boolean | null;
  fee_text?: string | null;
  opening_hours?: string | null;
  road_surface?: string | null;
  camping_allowed?: boolean | null;
  tripod_allowed?: boolean | null;
  access_notes?: string | null;
}

interface BackendSiteStaticConditions {
  elevation_m?: number | null;
  night_light_radiance?: number | null;
  night_light_year?: number | null;
  night_light_product?: string | null;
  bortle_estimated?: number | null;
  gan_observation_count?: number | null;
  gan_nearest_distance_m?: number | null;
  gan_latest_year?: number | null;
  gan_median_sqm?: number | null;
  gan_median_limiting_magnitude?: number | null;
}

interface BackendSiteAreaMembership {
  id: string;
  source_name: string;
  area_name: string;
  area_type: string;
  manager_name?: string | null;
  designation?: string | null;
  is_dark_sky_certified?: boolean | null;
}

// ===== 类型映射函数 =====

/** 后端 object_type → 前端 CelestialCategory */
export function mapObjectType(backendType: string): CelestialCategory {
  const map: Record<string, CelestialCategory> = {
    planet: 'planet',
    sun: 'planet',
    star: 'star',
    dso: 'deepSky',
    galaxy: 'galaxy',
    nebula: 'deepSky',
    open_cluster: 'deepSky',
    cluster: 'deepSky',
    planetary_nebula: 'deepSky',
    supernova_remnant: 'deepSky',
    asterism: 'deepSky',
    moon: 'moon',
    meteor_shower: 'meteor',
    milky_way: 'milkyway',
    comet: 'comet',
    asteroid: 'asteroid',
    double_star: 'doubleStar',
    multiple_star: 'multipleStar',
  };
  return map[backendType] || 'deepSky'; // 未知类型归为深空
}

/** 前端 CelestialCategory → 后端 object_type */
export function unmapObjectType(cat: CelestialCategory): string {
  const map: Record<CelestialCategory, string> = {
    planet: 'planet',
    star: 'star',
    deepSky: 'dso',
    galaxy: 'galaxy',
    moon: 'moon',
    meteor: 'meteor_shower',
    milkyway: 'milky_way',
    comet: 'comet',
    asteroid: 'asteroid',
    doubleStar: 'double_star',
    multipleStar: 'multiple_star',
  };
  return map[cat] || 'dso';
}

/** 后端天体 → 前端 CelestialObject */
function mapObject(b: BackendObject): CelestialObject {
  const mag = b.magnitude ?? 99;
  let difficulty: 'easy' | 'moderate' | 'challenging' = 'challenging';
  if (b.object_type === 'planet' || b.object_type === 'moon' || b.object_type === 'milky_way') {
    difficulty = 'easy';
  } else if (mag < 3) {
    difficulty = 'easy';
  } else if (mag < 6) {
    difficulty = 'moderate';
  }

  return {
    id: b.id,
    name: b.primary_name,
    type: mapObjectType(b.object_type),
    constellation: b.constellation || '—',
    magnitude: b.magnitude ?? 99,
    ra: b.ra_j2000 != null ? b.ra_j2000 / 15 : 0, // 度→小时
    dec: b.dec_j2000 ?? 0,
    difficulty,
  };
}

/** 后端 SiteBrief → 前端 DarkSite（简要） */
function mapSiteBrief(s: BackendSiteBrief, distKm?: number): DarkSite {
  const status = s.public_access === 'open_access' ? 'official'
    : s.public_access === 'restricted_access' ? 'community_verified'
    : 'suggested';
  return {
    id: s.id,
    name: s.name,
    lat: s.latitude,
    lon: s.longitude,
    bortle: 4, // 默认值，详情接口才有真实 bortle
    status: status as 'official' | 'community_verified' | 'suggested',
    distKm: distKm ? Math.round(distKm) : undefined,
  };
}

/** 后端 SiteDetail → 前端 DarkSite（完整） */
function mapSiteDetail(d: BackendSiteDetail): DarkSite {
  const brief = mapSiteBrief(d);
  const sc = d.static_conditions;
  const access = d.access;

  // 暗夜认证
  const certified = d.area_memberships?.some(m => m.is_dark_sky_certified);

  return {
    ...brief,
    bortle: sc?.bortle_estimated ?? 4,
    elevation: sc?.elevation_m ?? undefined,
    status: certified ? 'official' : brief.status,
    parking: access?.parking_available == null ? 'unknown'
      : access.parking_available ? 'easy' : 'none',
    toilet: access?.toilet_available == null ? 'unknown'
      : access.toilet_available ? 'available' : 'none_seen',
    nightAccess: access?.night_access == null ? 'unknown'
      : access.night_access ? 'open' : 'closed',
    localLights: sc?.night_light_radiance == null ? 'unknown'
      : sc.night_light_radiance < 0.5 ? 'none'
      : sc.night_light_radiance < 2 ? 'minor'
      : sc.night_light_radiance < 10 ? 'moderate' : 'severe',
  };
}

// ===== API 调用函数 =====

/** 搜索天体（关键词 + 类型筛选） */
export async function fetchObjects(params?: {
  q?: string;
  object_type?: string;
  catalog?: string;
  limit?: number;
  offset?: number;
}): Promise<CelestialObject[]> {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.object_type) query.set('object_type', params.object_type);
  if (params?.catalog) query.set('catalog', params.catalog);
  query.set('limit', String(params?.limit ?? 200));
  if (params?.offset) query.set('offset', String(params.offset));

  try {
    const resp = await fetch(`${API_BASE}/objects?${query}`);
    if (!resp.ok) return [];
    const data: BackendObject[] = await resp.json();
    return data.map(mapObject);
  } catch {
    return [];
  }
}

/** 获取天体详情 */
export async function fetchObjectDetail(objId: string): Promise<CelestialObject | null> {
  try {
    const resp = await fetch(`${API_BASE}/objects/${objId}`);
    if (!resp.ok) return null;
    const data: BackendObject = await resp.json();
    return mapObject(data);
  } catch {
    return null;
  }
}

/** 搜索附近的暗夜站点 */
export async function fetchSitesNearby(
  lat: number,
  lon: number,
  radiusKm: number = 200,
): Promise<DarkSite[]> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      radius: String(radiusKm),
    });
    const resp = await fetch(`${API_BASE}/sites/nearby?${params}`);
    if (!resp.ok) return [];
    const data = await resp.json() as { sites: BackendSiteBrief[]; total: number };
    return data.sites.map(s => {
      // 后端未返回距离，前端用大圆距离估算
      const dist = haversineKm(lat, lon, s.latitude, s.longitude);
      return mapSiteBrief(s, dist);
    });
  } catch {
    return [];
  }
}

/** 获取站点详情（含设施、认证、溯源） */
export async function fetchSiteDetail(siteId: string): Promise<DarkSite | null> {
  try {
    const resp = await fetch(`${API_BASE}/sites/${siteId}`);
    if (!resp.ok) return null;
    const data: BackendSiteDetail = await resp.json();
    return mapSiteDetail(data);
  } catch {
    return null;
  }
}

/** 获取站点的可观测天体（今晚最佳） */
export async function fetchSiteObjects(siteId: string, perCategory: number = 5): Promise<Record<string, unknown> | null> {
  try {
    const params = new URLSearchParams({ per_category: String(perCategory) });
    const resp = await fetch(`${API_BASE}/sites/${siteId}/objects?${params}`);
    if (!resp.ok) return null;
    return await resp.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 获取天体附近可观测站点 */
export async function fetchObjectSites(
  objId: string,
  lat: number,
  lon: number,
  radiusKm: number = 200,
  limit: number = 5,
): Promise<DarkSite[]> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      radius: String(radiusKm),
      limit: String(limit),
    });
    const resp = await fetch(`${API_BASE}/objects/${objId}/sites?${params}`);
    if (!resp.ok) return [];
    const data = await resp.json() as { sites: Array<{ site_id: string; site_name: string; site_type?: string; latitude: number; longitude: number; distance_km: number; public_access: string; bortle_estimated?: number }> };
    return data.sites.map(s => mapSiteBrief({
      id: s.site_id,
      name: s.site_name,
      site_type: s.site_type,
      state_code: null,
      latitude: s.latitude,
      longitude: s.longitude,
      status: 'published',
      public_access: s.public_access,
    }, s.distance_km));
  } catch {
    return [];
  }
}

// ===== Observation API（/observe 端点） =====
// 彗星/小行星通过 JPL sbwobs 实时获取，不走 /objects 端点

/** 后端 observe/best-objects 返回的小天体条目 */
interface BackendObserveBody {
  primary_name: string;
  designation?: string | null;
  object_type: string;
  magnitude?: number | null;
  magnitude_type?: string | null;  // "T"=total, "N"=nuclear (彗星)
  ra?: string | null;              // JPL 返回的 RA 字符串
  dec?: string | null;
  rise_time?: string | null;
  transit_time?: string | null;
  set_time?: string | null;
  max_time_observable?: string | null;
  helio_range_au?: number | null;
  topo_range_au?: number | null;
  elongation_deg?: number | null;
  moon_angle_deg?: number | null;
  galactic_lat_deg?: number | null;
}

/** 后端 observe/best-objects 完整响应 */
interface BackendBestObjectsResponse {
  query_latitude: number;
  query_longitude: number;
  observable_tonight: {
    start: string;
    end: string;
    weather: Record<string, unknown>;
    moon: Record<string, unknown>;
    categories: Record<string, BackendObserveBody[]>;
    total: number;
  };
  upcoming: {
    start: string;
    end: string;
    categories: Record<string, unknown[]>;
  };
}

/** 后端 observe/objects/{id} 返回的天体详情 */
interface BackendObserveObjectDetail {
  object_id: string;
  primary_name: string;
  object_type: string;
  catalog?: string | null;
  constellation?: string | null;
  magnitude?: number | null;
  surface_brightness?: number | null;
  naked_eye_possible?: boolean | null;
  observation_geometry: {
    type: 'fixed' | 'dynamic';
    // fixed
    altitude_deg?: number;
    azimuth_deg?: number;
    transit_altitude_deg?: number;
    best_month?: number;
    is_in_season?: boolean;
    // dynamic
    altitude_start_deg?: number;
    altitude_end_deg?: number;
    azimuth_start_deg?: number;
    azimuth_end_deg?: number;
    window_start?: string;
    window_end?: string;
  };
  required_bortle: number;
  recommended_equipment: string[];
  nearby_sites: Array<{
    site_id: string;
    site_name: string;
    site_type?: string;
    latitude: number;
    longitude: number;
    distance_km: number;
    public_access: string;
    bortle_estimated?: number;
    dark_enough: boolean;
    weather_pass: boolean;
  }>;
  total_sites: number;
}

/** 后端 observe/nearby-sites 返回 */
interface BackendObserveNearbySites {
  query_latitude: number;
  query_longitude: number;
  radius_km: number;
  region_unobservable: boolean;
  hint?: string | null;
  sites: Array<{
    site_id: string;
    site_name: string;
    site_type?: string;
    latitude: number;
    longitude: number;
    distance_km: number;
    public_access: string;
    bortle_estimated?: number;
    weather: Record<string, unknown>;
    weather_pass: boolean;
  }>;
  total_sites: number;
}

/** 将 observe 端点的小天体条目转为前端 CelestialObject */
function mapObserveBody(b: BackendObserveBody): CelestialObject {
  const cat = mapObjectType(b.object_type);
  const mag = b.magnitude ?? 99;
  let difficulty: 'easy' | 'moderate' | 'challenging' = 'challenging';
  if (mag < 6) difficulty = 'moderate';
  if (mag < 3) difficulty = 'easy';

  // JPL 返回的 RA/Dec 是字符串，尝试解析为度数
  let ra = 0;
  let dec = 0;
  if (b.ra) {
    const raNum = parseFloat(b.ra);
    if (!isNaN(raNum)) ra = raNum / 15; // 度→小时
  }
  if (b.dec) {
    const decNum = parseFloat(b.dec);
    if (!isNaN(decNum)) dec = decNum;
  }

  return {
    id: b.designation || b.primary_name,
    name: b.primary_name,
    type: cat,
    constellation: '—',
    magnitude: mag,
    ra,
    dec,
    description: b.magnitude_type === 'T' ? '总星等' : b.magnitude_type === 'N' ? '核星等' : undefined,
    difficulty,
  };
}

/**
 * 获取今晚 + 未来 30 天最佳可观测天体（含彗星/小行星）。
 * 8 个行为类别：meteor_showers, comets, asteroids, planets, stars,
 * deep_sky, double_stars, milky_way
 */
export async function fetchBestObjects(params: {
  latitude: number;
  longitude: number;
  perCategory?: number;
  startDate?: string;  // ISO datetime
}): Promise<{
  tonight: Record<string, CelestialObject[]>;
  upcoming: Record<string, unknown[]>;
  raw: BackendBestObjectsResponse | null;
}> {
  const query = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
  });
  if (params.perCategory) query.set('per_category', String(params.perCategory));
  if (params.startDate) query.set('start_date', params.startDate);

  try {
    const resp = await fetch(`${API_BASE}/observe/best-objects?${query}`, {
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) return { tonight: {}, upcoming: {}, raw: null };
    const data = (await resp.json()) as BackendBestObjectsResponse;

    // 将每个类别的小天体条目转为 CelestialObject
    const tonight: Record<string, CelestialObject[]> = {};
    for (const [key, items] of Object.entries(data.observable_tonight.categories)) {
      tonight[key] = items.map(mapObserveBody);
    }

    return {
      tonight,
      upcoming: data.upcoming.categories,
      raw: data,
    };
  } catch {
    return { tonight: {}, upcoming: {}, raw: null };
  }
}

/**
 * 从 observe/best-objects 提取彗星和小行星，合并为 CelestialObject[]。
 * 供天体页 comet/asteroid tab 使用。
 */
export async function fetchCometsAndAsteroids(
  lat: number,
  lon: number,
  perCategory = 10,
): Promise<CelestialObject[]> {
  const { tonight } = await fetchBestObjects({
    latitude: lat,
    longitude: lon,
    perCategory,
  });

  const comets = tonight['comets'] || [];
  const asteroids = tonight['asteroids'] || [];
  return [...comets, ...asteroids];
}

/** 获取天体观测详情（含几何信息 + 设备推荐 + 附近站点） */
export async function fetchObserveObjectDetail(
  objectId: string,
  lat: number,
  lon: number,
  radiusKm = 100,
  numSites = 5,
): Promise<BackendObserveObjectDetail | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    radius: String(radiusKm),
    num_sites: String(numSites),
  });
  try {
    const resp = await fetch(`${API_BASE}/observe/objects/${objectId}?${params}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as BackendObserveObjectDetail;
  } catch {
    return null;
  }
}

/** 后端 observe/site/{id}/object/{obj_id} 返回的 site×object 详情 */
export interface BackendSiteObjectDetail {
  site_id: string;
  site_name: string;
  site_type?: string | null;
  latitude: number;
  longitude: number;
  public_access: string;
  bortle_estimated?: number | null;
  weather: {
    cloud_cover_pct?: number | null;
    temperature_c?: number | null;
    wind_speed_kmh?: number | null;
    relative_humidity_pct?: number | null;
    precipitation_mm?: number | null;
    weather_code?: number | null;
    cloud_cover_mean_24h?: number | null;
    cloud_cover_min_24h?: number | null;
    precipitation_probability_max_24h?: number | null;
    source?: string;
    fetched_at?: string | null;
    timezone?: string | null;
    is_unobservable?: boolean;
  };
  object_id: string;
  object_type: string;
  primary_name: string;
  catalog?: string | null;
  catalog_number?: string | null;
  constellation?: string | null;
  magnitude?: number | null;
  surface_brightness?: number | null;
  position: {
    altitude_deg: number;
    azimuth_deg: number;
    is_visible: boolean;
    is_circumpolar?: boolean;
    never_rises?: boolean;
    rise_time?: string | null;
    transit_time?: string | null;
    transit_altitude_deg?: number | null;
    set_time?: string | null;
  };
  observability: {
    score: number;
    altitude_score: number;
    brightness_score: number;
    moon_penalty: number;
    altitude_factor: string;
    visibility_note: string;
  };
  moon_separation_deg?: number | null;
  recommended_equipment: Array<{
    equipment_id: string;
    equipment_code: string;
    equipment_name: string;
    equipment_type: string;
    suitability: string;
    sort_order: number;
  }>;
  sky_context: {
    observation_time: string;
    is_night: boolean;
    is_dark_night: boolean;
    sun_altitude_deg: number;
    sun_is_twilight: boolean;
    moon_illumination_frac: number;
    moon_phase_name: string;
    moon_altitude_deg: number;
    moon_azimuth_deg: number;
    moon_is_above_horizon: boolean;
  };
  extra: Record<string, unknown>;
}

/** 获取附近暗夜站点（轻量端点，无天文计算） */
export async function fetchObserveNearbySites(
  lat: number,
  lon: number,
  radiusKm = 50,
  numSites = 5,
): Promise<BackendObserveNearbySites | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    radius: String(radiusKm),
    num_sites: String(numSites),
  });
  try {
    const resp = await fetch(`${API_BASE}/observe/nearby-sites?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as BackendObserveNearbySites;
  } catch {
    return null;
  }
}

/** 获取 site×object 完整观测详情（位置/可观测性/天气/设备/天空上下文） */
export async function fetchSiteObjectDetail(
  siteId: string,
  objId: string,
  startDate?: string,
): Promise<BackendSiteObjectDetail | null> {
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  try {
    const resp = await fetch(`${API_BASE}/observe/site/${siteId}/object/${objId}?${params}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as BackendSiteObjectDetail;
  } catch {
    return null;
  }
}

// ===== 工具函数 =====

/** Haversine 大圆距离（公里） */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 测试 API 是否可用 */
export async function pingApi(): Promise<boolean> {
  try {
    const resp = await fetch(`${API_BASE.replace('/api/v1', '')}/health`, { signal: AbortSignal.timeout(3000) });
    return resp.ok;
  } catch {
    return false;
  }
}
