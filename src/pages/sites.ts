// ===== Sites 页面 =====
// "我在这里，往哪个方向看、每个方向能看到什么"
import type { CelestialPosition, DirectionSky, CelestialCategory, CelestialObject } from '../types';
import { ctx, onContextChange, formatDateShort, equipmentSummary } from '../lib/context';
import { getCelestialCatalog } from '../lib/catalog';
import { computePosition, computeMoonPhase, computeSunInfo, groupByDirection } from '../lib/astronomy';
import { fetchHourlyWeather, computeHourlyScore, findBestWindow } from '../lib/weather';
import { getAllPlaces, type DarkSkyPlace } from '../lib/dark-sky-places';
import { t } from '../lib/i18n';
import { fetchBestObjects } from '../lib/api';
import { computeTonightSummary, type TonightSummary } from '../lib/recommendation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ===== 8 方位定义 =====
const DIRECTIONS = [
  { key: 'N',  labelZh: '北', labelEn: 'N', azimuth: 0 },
  { key: 'NE', labelZh: '东北', labelEn: 'NE', azimuth: 45 },
  { key: 'E',  labelZh: '东', labelEn: 'E', azimuth: 90 },
  { key: 'SE', labelZh: '东南', labelEn: 'SE', azimuth: 135 },
  { key: 'S',  labelZh: '南', labelEn: 'S', azimuth: 180 },
  { key: 'SW', labelZh: '西南', labelEn: 'SW', azimuth: 225 },
  { key: 'W',  labelZh: '西', labelEn: 'W', azimuth: 270 },
  { key: 'NW', labelZh: '西北', labelEn: 'NW', azimuth: 315 },
];

// ===== State =====
let directionSkies: DirectionSky[] = [];
let activeDirection: string | null = null;
let weatherData: any = null;
let overallScore = 0;
let moonPhaseName = '';
let bestWindow = '';
let tonightSummary: TonightSummary | null = null;
let upcomingData: Record<string, any[]> = {};
let mapInstance: L.Map | null = null;
let mapMarkers: L.Layer[] = [];
let mapRadiusCircle: L.Circle | null = null;

// ===== Context listener (unregistered on re-init to avoid duplicates) =====
let unsubSitesContext: (() => void) | null = null;

// ===== 500km radius selection =====
const RADIUS_KM = 500;

function placeInRange(p: { lat: number; lon: number }, loc: { lat: number; lon: number }): boolean {
  const dLat = (p.lat - loc.lat) * 111;
  const dLon = (p.lon - loc.lon) * 111 * Math.cos(loc.lat * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon) <= RADIUS_KM;
}

function siteMatchesTarget(site: { bortle: number; type: string }): boolean {
  const target = ctx.activeTarget;
  if (target === 'all') return true;
  if (target === 'milkyway') return site.bortle <= 3;   // 银河需要暗夜
  if (target === 'meteor') return site.bortle <= 4;     // 流星雨对光害稍宽容
  if (target === 'moon') return true;                   // 月亮任意地点
  if (target === 'planets') return true;                // 行星任意地点
  return true;
}

// ===== Render =====
export function renderSitesPage(): string {
  const dateLabel = formatDateShort();
  const equipLabel = equipmentSummary();

  return `
    <div class="page-top">
      <div>
        <div class="page-sub">${t('sites.sub')}</div>
        <h1>${t('sites.title')}</h1>
      </div>
      <button class="icon-btn" id="sitesFavBtn">♥</button>
    </div>

    <div class="date-bar">
      <button class="date-btn" id="sitesDateBtn">
        <strong>${dateLabel}</strong>
        <span>${t('sites.changeDate')}</span>
      </button>
      <button class="date-btn" id="sitesEquipBtn">
        <strong>${equipLabel}</strong>
        <span>${t('sites.yourEquip')}</span>
      </button>
    </div>

    <div class="hero-card">
      <h2>${t('sites.heroTitle')}</h2>
      <p>${t('sites.heroDesc')}</p>
      <div class="search">
        <input id="sitesSearch" placeholder="${t('sites.search')}">
        <button id="sitesSearchBtn">⌕</button>
      </div>
      <div class="chips" id="sitesChips">
        <button class="chip ${ctx.activeTarget === 'all' ? 'active' : ''}" data-target="all">${t('filter.all')}</button>
        <button class="chip ${ctx.activeTarget === 'milkyway' ? 'active' : ''}" data-target="milkyway">${t('filter.milkyway')}</button>
        <button class="chip ${ctx.activeTarget === 'meteor' ? 'active' : ''}" data-target="meteor">${t('filter.meteor')}</button>
        <button class="chip ${ctx.activeTarget === 'moon' ? 'active' : ''}" data-target="moon">${t('filter.moon')}</button>
        <button class="chip ${ctx.activeTarget === 'planets' ? 'active' : ''}" data-target="planets">${t('filter.planets')}</button>
      </div>
    </div>

    <!-- Map -->
    <div id="sitesMap" class="sites-map"></div>

    <!-- Nearby dark sites (numbered to match map pins) -->
    <div class="section">
      <h3>${t('sites.nearby')}</h3>
      <span class="page-sub" id="nearbyDateSub">${t('sites.forDate')} ${dateLabel}${bestWindow ? ' · ' + bestWindow : ''}</span>
    </div>
    <div id="nearbySites"></div>

    <!-- Tonight Recommendation -->
    <div id="tonightRec"></div>

    <!-- Favorites Modal -->
    <div id="favoritesModal" class="modal">
      <div class="sheet">
        <div class="handle"></div>
        <div class="row">
          <div><div class="page-sub">${t('fav.sub')}</div><h2>${t('fav.title')}</h2></div>
          <button class="back-btn" id="favCloseBtn">✕</button>
        </div>
        <div class="segment" id="favTabs">
          <button class="seg active" data-favtab="places">${t('fav.tabPlaces')}</button>
          <button class="seg" data-favtab="objects">${t('fav.tabObjects')}</button>
        </div>
        <div id="favList"></div>
      </div>
    </div>
  `;
}

export function initSitesPage(): void {
  // Chip filter
  document.getElementById('sitesChips')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.chip') as HTMLElement;
    if (!btn) return;
    ctx.activeTarget = btn.dataset.target || 'all';
    document.querySelectorAll('#sitesChips .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    recalculate();
  });

  // Date / Equipment buttons
  document.getElementById('sitesDateBtn')?.addEventListener('click', () => {
    (window as any).openModal?.('dateModal');
  });
  document.getElementById('sitesEquipBtn')?.addEventListener('click', () => {
    (window as any).openModal?.('equipmentModal');
  });

  // Favorites button → open favorites modal
  document.getElementById('sitesFavBtn')?.addEventListener('click', () => {
    renderFavoritesList();
    const modal = document.getElementById('favoritesModal');
    if (modal) modal.classList.add('show');
  });
  document.getElementById('favCloseBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('favoritesModal');
    if (modal) modal.classList.remove('show');
  });
  document.getElementById('favTabs')?.addEventListener('click', (e) => {
    const seg = (e.target as HTMLElement).closest('.seg') as HTMLElement;
    if (!seg) return;
    renderFavoritesList(seg.dataset.favtab as 'places' | 'objects');
  });
  document.getElementById('favoritesModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('favoritesModal')) {
      document.getElementById('favoritesModal')?.classList.remove('show');
    }
  });

  // Search
  document.getElementById('sitesSearch')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    if (q) highlightSite(q);
  });

  // Context change listener (unregister previous to avoid duplicates)
  if (unsubSitesContext) unsubSitesContext();
  unsubSitesContext = onContextChange(() => {
    updateDateBar();
    recalculate();
  });

  // Initialize Leaflet map
  initSitesMap();

  // Initial calculation
  recalculate();
}

function destroySitesPage(): void {
  // cleanup handled by main.ts tab switch
}

// ===== Core Computation =====
async function recalculate() {
  try {
    const loc = { lat: ctx.location.lat, lon: ctx.location.lon };
    // Build observation date from ctx.date + ctx.startTime
    const [hh, mm] = ctx.startTime.split(':').map(Number);
    const obsDate = new Date(ctx.date);
    obsDate.setHours(hh || 22, mm || 0, 0, 0);

    // Compute positions for all objects at observation time (used by tonight recommendation)
    const catalog = getCelestialCatalog();
    const positions = catalog
      .filter(obj => filterByTarget(obj.type))
      .map(obj => computePosition(obj, loc, obsDate))
      .filter(p => p.visible && p.altitude > 0);

    // Group by direction (still used for tonight picks direction label)
    const dirMap = groupByDirection(positions);

    // Fetch weather for scoring
    weatherData = await fetchHourlyWeather(loc);
    const moonInfo = computeMoonPhase(obsDate, loc);
    const sunInfo = computeSunInfo(obsDate, loc);
    moonPhaseName = moonInfo.phaseName;

    // Build DirectionSky for each direction (used for tonight picks)
    directionSkies = DIRECTIONS.map(d => {
      const objs = (dirMap.get(d.key) || [])
        .sort((a, b) => b.altitude - a.altitude)
        .map(p => ({
          id: p.object.id, name: p.object.name, type: p.object.type,
          altitude: p.altitude, bestTime: p.bestTime, magnitude: p.magnitude, visible: true
        }));

      let score = 0;
      if (objs.length > 0) {
        const bestAlt = objs[0].altitude;
        const count = objs.length;
        score = Math.min(100, 30 + count * 15 + Math.min(bestAlt, 60));
      }

      if (weatherData) {
        const hourlyScores = buildHourlyScores(weatherData, moonInfo, sunInfo, ctx.location.bortle);
        const window = findBestWindow(hourlyScores);
        if (window) {
          bestWindow = `${window.start}–${window.end}`;
          overallScore = window.score;
          score = Math.round(score * (window.score / 100 + 0.3));
        }
      }

      if (moonInfo.altitude > 0 && moonInfo.illumination > 0.5) {
        const moonDir = Math.round(moonInfo.azimuth / 45) % 8;
        const dirIdx = DIRECTIONS.findIndex(dd => dd.key === d.key);
        const moonDist = Math.min(Math.abs(moonDir - dirIdx), 8 - Math.abs(moonDir - dirIdx));
        if (moonDist <= 1) score = Math.round(score * 0.6);
      }

      return {
        azimuth: d.azimuth, name: d.key,         label: ctx.language === 'zh' ? d.labelZh : d.labelEn,
        score: Math.max(0, Math.min(100, score)),
        objects: objs, horizonClear: objs.some(o => o.altitude > 10)
      };
    });

    renderNearbySites();
    renderTonightRecommendation();
    updateMapPins();
  } catch (err) {
    console.error('recalculate error:', err);
  }

  // Compute tonight summary + fetch upcoming from backend
  try {
    const [hh2, mm2] = ctx.startTime.split(':').map(Number);
    const obsDate2 = new Date(ctx.date);
    obsDate2.setHours(hh2 || 22, mm2 || 0, 0, 0);

    const catalog2 = getCelestialCatalog().filter(obj => filterByTarget(obj.type));
    const loc = { lat: ctx.location.lat, lon: ctx.location.lon };

    tonightSummary = await computeTonightSummary(catalog2, loc, obsDate2, ctx.equipment, ctx.location.bortle, ctx.language || 'zh');
    overallScore = tonightSummary.overallScore;
    bestWindow = tonightSummary.bestWindow;

    // Fetch upcoming (next 30 days) from backend — may return empty if API unavailable
    try {
      const result = await fetchBestObjects({
        latitude: loc.lat,
        longitude: loc.lon,
        perCategory: 5,
      });
      upcomingData = result.upcoming;
    } catch {
      upcomingData = {};
    }

    renderTonightRecommendation();
  } catch (err) {
    console.error('tonight summary error:', err);
  }
}

function filterByTarget(type: CelestialCategory): boolean {
  const target = ctx.activeTarget;
  if (target === 'all') return true;
  if (target === 'milkyway') return type === 'milkyway';
  if (target === 'meteor') return type === 'meteor';
  if (target === 'moon') return type === 'moon';
  if (target === 'planets') return type === 'planet';
  return true;
}

function buildHourlyScores(weatherData: any[], moonInfo: any, sunInfo: any, bortle: number) {
  return weatherData.filter((_: any, i: number) => i % 2 === 0).map((h: any) => {
    const time = new Date(h.time);
    const r = computeHourlyScore({
      cloudCover: h.cloudCover, moonAltitude: moonInfo.altitude,
      moonIllumination: moonInfo.illumination, sunAltitude: sunInfo.altitude,
      windSpeed: h.windSpeed, bortle, visibility: h.visibility
    });
    return { time, score: r.score };
  });
}

// ===== Nearby Dark Sites (numbered to match map pins) =====
function renderNearbySites() {
  const container = document.getElementById('nearbySites');
  if (!container) return;

  const loc = ctx.location;
  const sites = getAllPlaces()
    .filter(p => placeInRange(p, loc))
    .filter(p => siteMatchesTarget(p))
    .map(p => ({
      ...p,
      distKm: Math.round(Math.sqrt((p.lat - loc.lat)**2 + (p.lon - loc.lon)**2) * 111),
    }))
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 5);

  if (sites.length === 0) {
    container.innerHTML = '<div class="card"><div class="meta" style="text-align:center;padding:20px 0">' + t('sites.noSites') + '</div></div>';
    return;
  }

  container.innerHTML = sites.map((s, i) => {
    const statusClass = s.yearCert ? 'official' : 'good';
    const statusLabel = s.yearCert ? t('status.official') : t('status.suggested');
    const scoreVal = Math.max(10, 100 - s.bortle * 10);
    const pinColor = scoreVal >= 70 ? '#7fdda9' : scoreVal >= 40 ? '#8bb5ff' : '#f0c96e';
    const navId = (s as any)._apiId || s.name;
    return `
      <div class="card clickable" data-site-name="${navId}">
        <div class="site-card">
          <div class="site-pin-num" style="background:${pinColor}">${i + 1}</div>
          <div class="site-card-body">
            <div class="row">
              <div style="flex:1;min-width:0">
                <div class="place">${s.name}</div>
                <div class="meta">${s.distKm} km · Bortle ~${s.bortle}</div>
              </div>
              <div class="score ${scoreClass(s.bortle)}">${scoreVal}</div>
            </div>
            <div class="badges">
              <span class="badge ${statusClass}">${statusLabel}</span>
              <span class="badge">${s.type}</span>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-site-name]').forEach(el => {
    el.addEventListener('click', () => {
      const name = (el as HTMLElement).dataset.siteName!;
      (window as any).navigateTo?.('place-detail', name);
    });
  });
}

function scoreClass(bortle: number): string {
  if (bortle <= 2) return 'great';
  if (bortle <= 4) return 'ok';
  if (bortle <= 6) return 'meh';
  return 'bad';
}

function typeToBadge(type: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    planet: { cls: 'warn', label: t('type.planet') },
    moon: { cls: '', label: t('type.moon') },
    star: { cls: 'good', label: t('type.star') },
    deepSky: { cls: 'official', label: t('type.deepSky') },
    galaxy: { cls: 'official', label: t('type.galaxy') },
    milkyway: { cls: 'good', label: t('type.milkyway') },
    meteor: { cls: 'warn', label: t('type.meteor') },
    comet: { cls: 'warn', label: t('type.comet') },
    asteroid: { cls: 'warn', label: t('type.asteroid') },
    doubleStar: { cls: 'good', label: t('type.doubleStar') },
    multipleStar: { cls: 'good', label: t('type.multipleStar') },
  };
  return map[type] || { cls: '', label: type };
}

function highlightSite(q: string) {
  // Highlight matching site in nearby list
  const cards = document.querySelectorAll('#nearbySites .card');
  let found = false;
  cards.forEach(card => {
    const name = (card as HTMLElement).dataset.siteName || '';
    if (name.toLowerCase().includes(q)) {
      (card as HTMLElement).style.borderColor = 'var(--blue)';
      if (!found) (card as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      found = true;
    } else {
      (card as HTMLElement).style.borderColor = '';
    }
  });
  if (!found) (window as any).toast?.(ctx.language === 'zh' ? '未找到地点' : 'Site not found');
}

function updateDateBar() {
  const dateBtn = document.getElementById('sitesDateBtn');
  const equipBtn = document.getElementById('sitesEquipBtn');
  if (dateBtn) dateBtn.querySelector('strong')!.textContent = `${formatDateShort()}`;
  if (equipBtn) equipBtn.querySelector('strong')!.textContent = equipmentSummary();
  const nearbySub = document.getElementById('nearbyDateSub');
  if (nearbySub) nearbySub.textContent = `${t('sites.forDate')} ${formatDateShort()}${bestWindow ? ' · ' + bestWindow : ''}`;
}

// ===== Tonight Recommendation =====
function renderFavoritesList(tab: 'places' | 'objects' = 'places') {
  const container = document.getElementById('favList');
  if (!container) return;

  // Track active tab on the segment buttons
  document.querySelectorAll('#favTabs .seg').forEach(s => {
    const seg = s as HTMLElement;
    seg.classList.toggle('active', seg.dataset.favtab === tab);
  });

  if (tab === 'places') {
    // Favorite dark sites
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem('ds_favorite_places') || '[]'); } catch { ids = []; }

    const allPlaces = getAllPlaces();
    const favs = ids.map(id => allPlaces.find(p => p.name === id || (p as any)._apiId === id)).filter(Boolean) as DarkSkyPlace[];

  if (favs.length === 0) {
      container.innerHTML = `<div class="card"><div class="meta" style="text-align:center;padding:20px 0">${t('fav.emptyPlaces')}</div></div>`;
      return;
    }

    container.innerHTML = favs.map(p => {
      const scoreVal = Math.max(10, 100 - p.bortle * 10);
      const scoreCls = scoreVal >= 70 ? 'great' : scoreVal >= 40 ? 'ok' : 'meh';
      return `
        <div class="card clickable fav-item" data-fav-place="${p.name}">
          <div class="row">
            <div style="flex:1;min-width:0">
              <div class="place">${p.name}</div>
              <div class="meta">${p.region} · Bortle ${p.bortle} · ${p.type}${p.yearCert ? ' · ' + t('status.official') : ''}</div>
            </div>
            <div class="score ${scoreCls}" style="width:40px;height:40px;font-size:16px">${scoreVal}</div>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('[data-fav-place]').forEach(el => {
      el.addEventListener('click', () => {
        const name = (el as HTMLElement).dataset.favPlace;
        const modal = document.getElementById('favoritesModal');
        if (modal) modal.classList.remove('show');
        if (name) (window as any).navigateTo?.('place-detail', name);
      });
    });
    return;
  }

  // === objects tab ===
  let objIds: string[] = [];
  try { objIds = JSON.parse(localStorage.getItem('ds_favorite_objects') || '[]'); } catch { objIds = []; }

  const favObjs = objIds.map(id => getCelestialCatalog().find(o => o.id === id)).filter(Boolean) as CelestialObject[];

  if (favObjs.length === 0) {
    container.innerHTML = `<div class="card"><div class="meta" style="text-align:center;padding:20px 0">${t('fav.empty')}</div></div>`;
    return;
  }

  container.innerHTML = favObjs.map(obj => {
    const constLabel = obj.constellation && obj.constellation !== '—'
      ? (ctx.language === 'zh' ? `（${obj.constellation}）` : ` (${obj.constellation})`)
      : '';
    const typeBadge = typeToBadge(obj.type);
    return `
      <div class="card clickable fav-item" data-fav-id="${obj.id}">
        <div class="row">
          <div style="flex:1;min-width:0">
            <div class="place">${obj.name}<span class="const-sub">${constLabel}</span></div>
            <div class="meta">${obj.description || ''}</div>
          </div>
          <span class="badge ${typeBadge.cls}">${typeBadge.label}</span>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-fav-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.favId;
      const modal = document.getElementById('favoritesModal');
      if (modal) modal.classList.remove('show');
      if (id) (window as any).navigateTo?.('object-detail', id);
    });
  });
}

function renderTonightRecommendation() {
  const container = document.getElementById('tonightRec');
  if (!container) return;

  if (!tonightSummary && !hasUpcomingData()) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    ${tonightSummary ? renderSummaryBlock(tonightSummary, 'tonight') : ''}
    ${renderUpcomingBlock()}
  `;

  // Click handlers for recommended objects
  container.querySelectorAll('[data-object]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.object;
      if (id) (window as any).navigateTo?.('object-detail', id);
    });
  });
}

function hasUpcomingData(): boolean {
  return !!upcomingData && Object.keys(upcomingData).length > 0 &&
    Object.values(upcomingData).some(arr => Array.isArray(arr) && arr.length > 0);
}

function formatTimeShort(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '—';
  }
}

function renderUpcomingBlock(): string {
  if (!hasUpcomingData()) return '';

  const isZh = (ctx.language || 'zh') === 'zh';
  const typeMap: Record<string, { cls: string; label: string }> = {
    meteor_shower: { cls: 'warn', label: t('type.meteor') },
    comet: { cls: 'warn', label: t('type.comet') },
    asteroid: { cls: 'warn', label: t('type.asteroid') },
    planet: { cls: 'warn', label: t('type.planet') },
    star: { cls: 'good', label: t('type.star') },
    deep_sky: { cls: 'official', label: t('type.deepSky') },
    double_star: { cls: 'good', label: t('type.doubleStar') },
    milky_way: { cls: 'good', label: t('type.milkyway') },
  };

  const categoryOrder = [
    'meteor_showers', 'planets', 'comets', 'asteroids',
    'stars', 'deep_sky', 'double_stars', 'milky_way'
  ];

  const catLabels: Record<string, { zh: string; en: string }> = {
    meteor_showers: { zh: '流星雨', en: 'Meteor Showers' },
    planets: { zh: '行星', en: 'Planets' },
    comets: { zh: '彗星', en: 'Comets' },
    asteroids: { zh: '小行星', en: 'Asteroids' },
    stars: { zh: '恒星', en: 'Stars' },
    deep_sky: { zh: '深空', en: 'Deep Sky' },
    double_stars: { zh: '双星', en: 'Double Stars' },
    milky_way: { zh: '银河', en: 'Milky Way' },
  };

  const sections = categoryOrder
    .filter(key => Array.isArray(upcomingData[key]) && upcomingData[key].length > 0)
    .map(key => {
      const items = upcomingData[key].slice(0, 5);
      const catLabel = isZh ? catLabels[key]?.zh : catLabels[key]?.en;
      const itemsHtml = items.map((item: any) => {
        const objType = item.object_type || '';
        const badge = typeMap[objType] || { cls: '', label: objType };
        const objectId = item.object_id || '';
        const clickAttr = objectId ? `clickable" data-object="${objectId}` : '';

        let info = '';
        if (key === 'meteor_showers') {
          info = `${isZh ? '高峰' : 'Peak'} ${item.peak_month || '?'}/${item.peak_day || '?'} · ZHR ${item.zhr || '—'}`;
        } else if (key === 'planets') {
          const start = item.best_observation_start ? formatTimeShort(item.best_observation_start) : '?';
          const end = item.best_observation_end ? formatTimeShort(item.best_observation_end) : '?';
          info = `${isZh ? '最佳' : 'Best'} ${start}–${end}`;
        } else if (key === 'milky_way') {
          info = `${isZh ? '最佳时间' : 'Best'} ${item.best_time || '—'}${item.visible_band ? ' · ' + item.visible_band : ''}`;
        } else {
          const parts: string[] = [];
          if (item.magnitude != null) parts.push(`Mag ${typeof item.magnitude === 'number' ? item.magnitude.toFixed(1) : item.magnitude}`);
          if (item.constellation) parts.push(item.constellation);
          if (item.best_month_name) parts.push(`${isZh ? '最佳' : 'Best'} ${item.best_month_name}`);
          if (item.designation && item.designation !== item.primary_name) parts.push(item.designation);
          info = parts.join(' · ') || '—';
        }

        const name = item.primary_name || item.designation || '—';
        return `
          <div class="card ${clickAttr}" style="margin-bottom:8px">
            <div class="row">
              <div style="flex:1;min-width:0">
                <div class="place">${name}</div>
                <div class="meta">${info}</div>
              </div>
              <span class="badge ${badge.cls}" style="flex:0 0 auto">${badge.label}</span>
            </div>
          </div>`;
      }).join('');

      return `<div class="section"><span class="page-sub">${catLabel}</span></div>${itemsHtml}`;
    }).join('');

  if (!sections) return '';

  return `
    <div class="section">
      <h3>${t('tonight.tomorrowPicks')}</h3>
    </div>
    ${sections}
  `;
}

function renderSummaryBlock(s: TonightSummary, night: 'tonight' | 'tomorrow'): string {
  const isZh = (ctx.language || 'zh') === 'zh';
  const scoreClass = s.overallScore >= 70 ? 'great' : s.overallScore >= 40 ? 'ok' : s.overallScore >= 20 ? 'meh' : 'bad';

  const topPicksHtml = s.topPicks.map(pick => {
    const obj = getCelestialCatalog().find(o => o.id === pick.objectId);
    const objName = obj?.name || pick.objectId;
    const constLabel = obj && obj.constellation && obj.constellation !== '—'
      ? (ctx.language === 'zh' ? `（${obj.constellation}）` : ` (${obj.constellation})`)
      : '';
    const typeBadge = typeToBadge(obj?.type || '');
    const pickScoreClass = pick.totalScore >= 70 ? 'great' : pick.totalScore >= 40 ? 'ok' : pick.totalScore >= 20 ? 'meh' : 'bad';
    return `
      <div class="card clickable" data-object="${pick.objectId}" style="margin-bottom:8px">
        <div class="row">
          <div style="flex:1;min-width:0">
            <div class="place">${objName}<span class="const-sub">${constLabel}</span></div>
            <div class="meta">${pick.direction} · ${isZh ? '高度' : 'Alt'} ${pick.altitude.toFixed(0)}° · ${isZh ? '最佳' : 'Best'} ${pick.bestTime}</div>
          </div>
          <div style="text-align:right;flex:0 0 auto">
            <div class="score ${pickScoreClass}" style="width:36px;height:36px;font-size:15px;border-radius:11px">${pick.totalScore}</div>
          </div>
        </div>
        <div class="badges">
          <span class="badge ${typeBadge.cls}">${typeBadge.label}</span>
          ${pick.reasons.length > 0 ? `<span class="badge good">${pick.reasons[0]}</span>` : ''}
          ${pick.warnings.length > 0 ? `<span class="badge warn">${pick.warnings[0]}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  const title = night === 'tonight' ? t('tonight.picks') : t('tonight.tomorrowPicks');
  const scoreLabel = night === 'tonight' ? t('tonight.score') : t('tonight.tomorrowScore');

  return `
    <div class="section">
      <h3>${title}</h3>
      <span class="page-sub">${s.moonPhase}${s.bestWindow ? ' · ' + s.bestWindow : ''}</span>
    </div>
    <div class="hero-card" style="margin-bottom:12px">
      <div style="display:flex;align-items:end;gap:8px;margin-bottom:8px">
        <div class="score ${scoreClass}" style="width:56px;height:56px;font-size:24px;border-radius:17px">${s.overallScore}</div>
        <div>
          <div style="font-weight:800;font-size:16px">${scoreLabel}</div>
          <div class="meta">${s.moonImpact}</div>
        </div>
      </div>
      ${s.cloudCover > 0 ? `<div class="meta">${isZh ? '云量' : 'Clouds'} ${s.cloudCover}%${s.bestWindow ? ' · ' + (isZh ? '最佳时段 ' : 'Best window ') + s.bestWindow : ''}</div>` : ''}
      ${s.astroDusk !== '—' ? `<div class="meta">${isZh ? '天文昏影终' : 'Astro dusk'} ${s.astroDusk} · ${isZh ? '日出' : 'Dawn'} ${s.astroDawn}</div>` : ''}
    </div>
    ${topPicksHtml}
  `;
}

// ===== Leaflet Map =====
function initSitesMap() {
  const container = document.getElementById('sitesMap');
  if (!container) return;

  // Destroy previous instance if any
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  mapInstance = L.map(container, {
    center: [ctx.location.lat, ctx.location.lon],
    zoom: 6,
    zoomControl: false,
    attributionControl: false,
  });

  // Dark-themed tiles (CartoDB dark matter, free & no key needed)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    subdomains: 'abcd',
  }).addTo(mapInstance);

  // User location pin
  const youIcon = L.divIcon({
    className: '',
    html: '<div class="map-pin-dot you"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  L.marker([ctx.location.lat, ctx.location.lon], { icon: youIcon }).addTo(mapInstance);

  // 500km radius circle around user
  mapRadiusCircle = L.circle([ctx.location.lat, ctx.location.lon], {
    radius: RADIUS_KM * 1000,
    color: '#4d8cff',
    weight: 1,
    opacity: 0.5,
    fillColor: '#4d8cff',
    fillOpacity: 0.05,
    interactive: false,
  }).addTo(mapInstance);

  // Nearby dark site pins
  updateMapPins();

  // Invalidate size after DOM paint
  requestAnimationFrame(() => {
    mapInstance?.invalidateSize();
  });
}

function updateMapPins() {
  if (!mapInstance) return;

  // Remove old markers
  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];

  const loc = ctx.location;
  const sites = getAllPlaces()
    .filter(p => placeInRange(p, loc))
    .filter(p => siteMatchesTarget(p))
    .map(p => ({
      ...p,
      distKm: Math.round(Math.sqrt((p.lat - loc.lat) ** 2 + (p.lon - loc.lon) ** 2) * 111),
    }))
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 5);

  sites.forEach((s, i) => {
    const scoreVal = Math.max(10, 100 - s.bortle * 10);
    const color = scoreVal >= 70 ? '#7fdda9' : scoreVal >= 40 ? '#8bb5ff' : '#f0c96e';
    const navId = (s as any)._apiId || s.name;

    const pinIcon = L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};color:#050811;display:grid;place-items:center;font-size:11px;font-weight:900;border:2px solid rgba(255,255,255,.7);box-shadow:0 2px 6px rgba(0,0,0,.5)">${i + 1}</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const marker = L.marker([s.lat, s.lon], { icon: pinIcon }).addTo(mapInstance!);
    marker.bindTooltip(s.name, {
      permanent: true,
      direction: 'top',
      offset: [0, -14],
      className: 'map-site-label',
    });

    marker.on('click', () => {
      (window as any).navigateTo?.('place-detail', navId);
    });

    mapMarkers.push(marker);
  });

  // Fit map to always show the full 500km radius area centered on user
  // 500km ≈ 4.5° of latitude; widen longitude by cos(lat) for accuracy
  const latSpan = 4.5;
  const lonSpan = 4.5 / Math.max(0.2, Math.cos(loc.lat * Math.PI / 180));
  const bounds = L.latLngBounds(
    [loc.lat - latSpan, loc.lon - lonSpan],
    [loc.lat + latSpan, loc.lon + lonSpan]
  );
  mapInstance.fitBounds(bounds, { padding: [10, 10], maxZoom: 6 });
}
