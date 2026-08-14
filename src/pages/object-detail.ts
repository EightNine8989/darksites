// ===== 天体详情页 =====
// "我想看这个天体，怎么看、去哪里看"
import type { CelestialObject } from '../types';
import { ctx, onContextChange, formatDateShort } from '../lib/context';
import { celestialCatalog } from '../lib/catalog';
import { computeMoonPhase } from '../lib/astronomy';
import { fetchHourlyWeather } from '../lib/weather';
import { DARK_SKY_PLACES } from '../lib/dark-sky-places';
import { t, tCat } from '../lib/i18n';

// ===== Favorites Persistence =====
const FAVORITES_KEY = 'ds_favorite_objects';
function loadFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { return []; }
}
function saveFavorites(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}
function isFavorite(id: string): boolean {
  return loadFavorites().includes(id);
}
function toggleFavorite(id: string): boolean {
  const favs = loadFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) { favs.splice(idx, 1); saveFavorites(favs); return false; }
  favs.push(id); saveFavorites(favs); return true;
}

// ===== Context listener (unregistered on re-init to avoid duplicates) =====
let unsubContext: (() => void) | null = null;

// ===== Season data (shared with objects.ts) =====
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

const EQUIPMENT_RECS: Record<string, { name: string; detail: string; level: 'recommended' | 'great' | 'optional' }[]> = {
  milkyway: [
    { name: 'Naked eye', detail: 'Good at Bortle 3 or darker', level: 'recommended' },
    { name: 'Binoculars', detail: '8×42 to 15×70', level: 'recommended' },
    { name: 'Camera', detail: '14–35 mm · f/2.8 or faster', level: 'great' },
    { name: 'Telescope', detail: 'Not required for wide Milky Way viewing', level: 'optional' },
  ],
  perseids: [
    { name: 'Naked eye', detail: 'Best method — lie back and look up', level: 'great' },
    { name: 'Camera', detail: 'Wide-angle · 15-30s exposures', level: 'recommended' },
  ],
  m31: [
    { name: 'Binoculars', detail: '7×50 or 10×50 — best for beginners', level: 'great' },
    { name: 'Telescope', detail: '80mm+ low power — find the fuzzy patch', level: 'recommended' },
    { name: 'Naked eye', detail: 'Bortle 2 or darker only', level: 'optional' },
  ],
  m42: [
    { name: 'Binoculars', detail: '10×50 — reveals nebula shape', level: 'recommended' },
    { name: 'Telescope', detail: '4"+ for Trapezium detail', level: 'great' },
  ],
  m45: [
    { name: 'Naked eye', detail: 'Visible as a misty patch', level: 'recommended' },
    { name: 'Binoculars', detail: 'Best view — 7×50 ideal', level: 'great' },
  ],
  _planet: [
    { name: 'Naked eye', detail: 'Bright planets easily visible', level: 'recommended' },
    { name: 'Binoculars', detail: '10×50 — shows planet disk', level: 'recommended' },
    { name: 'Telescope', detail: '4"+ for rings/surface detail', level: 'great' },
  ],
  _star: [
    { name: 'Naked eye', detail: 'All listed stars are naked-eye visible', level: 'great' },
    { name: 'Binoculars', detail: 'For double star / color detail', level: 'optional' },
  ],
  _moon: [
    { name: 'Naked eye', detail: 'Easy target any night', level: 'great' },
    { name: 'Binoculars', detail: '10×50 — craters and maria', level: 'great' },
    { name: 'Telescope', detail: 'Any size — lunar detail', level: 'great' },
  ],
};

  const MONTH_LABELS = ctx.language === 'zh'
    ? ['1','2','3','4','5','6','7','8','9','10','11','12']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ===== Render =====
export function renderObjectDetailPage(objectId: string): string {
  const obj = celestialCatalog.find(o => o.id === objectId);
  if (!obj) return '<div class="card"><div class="meta" style="text-align:center;padding:40px 0">' + (ctx.language === 'zh' ? '天体未找到' : 'Object not found') + '</div></div>';

  const loc = { lat: ctx.location.lat, lon: ctx.location.lon };

  const seasonData = SEASON_DATA[obj.id] || Array(12).fill(2);
  const currentMonth = new Date().getMonth();
  const favState = isFavorite(obj.id);

  // Season chart
  const seasonChart = MONTH_LABELS.map((m, i) => {
    const v = seasonData[i];
    const cls = v >= 4 ? 'best' : v >= 3 ? 'high' : v >= 2 ? 'mid' : 'low';
    const isCurrent = i === currentMonth;
    return `<div class="month ${cls}" style="${isCurrent ? 'outline:2px solid var(--text);outline-offset:1px' : ''}"></div>`;
  }).join('');

  // Best season text
  const bestMonths = seasonData.map((v, i) => v >= 3 ? i : -1).filter(i => i >= 0);
  let seasonText = '';
  if (bestMonths.length > 0) {
    const start = MONTH_LABELS[bestMonths[0]];
    const end = MONTH_LABELS[bestMonths[bestMonths.length - 1]];
    seasonText = start === end ? (ctx.language === 'zh' ? `${start}月最佳` : `Best in ${start}`) : (ctx.language === 'zh' ? `${start}–${end}月最佳` : `Best from ${start} to ${end}`);
  }

  // Equipment recommendations
  let equipRecs = EQUIPMENT_RECS[obj.id] || EQUIPMENT_RECS[`_${obj.type}`] || [];
  if (equipRecs.length === 0) {
    equipRecs = [{ name: 'Naked eye', detail: 'Always available', level: 'recommended' as const }];
  }

  // Recommended dark sites
  const needsDarkSky = obj.type === 'deepSky' || obj.type === 'milkyway' || obj.difficulty === 'challenging';
  const maxBortle = needsDarkSky ? 3 : 6;
  const recSites = DARK_SKY_PLACES
    .filter(p => p.bortle <= maxBortle)
    .map(p => ({
      ...p,
      distKm: Math.round(Math.sqrt((p.lat - loc.lat) ** 2 + (p.lon - loc.lon) ** 2) * 111),
    }))
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 3);

  return `
    <div class="page-top">
      <button class="back-btn" id="objDetailBack">‹</button>
      <div class="page-sub">${obj.constellation !== '—' ? obj.constellation : (ctx.language === 'zh' ? '天体' : 'Object')}</div>
      <button class="icon-btn" id="objDetailSave" style="${favState ? 'color:#ff4d6d;border-color:#ff4d6d55' : ''}">${favState ? '♥' : '♡'}</button>
    </div>

    <div class="hero-card">
      <div class="page-sub">${t('objDetail.seasonVis')}</div>
      <h1 style="font-size:28px;margin:5px 0">${tCat(obj.id, 'name') || obj.name}${obj.constellation && obj.constellation !== '—' ? `<span class="const-sub" style="font-size:15px;color:var(--muted);font-weight:600">${ctx.language === 'zh' ? `（${obj.constellation}）` : ` (${obj.constellation})`}</span>` : ''}</h1>
      <div class="meta">${tCat(obj.id, 'desc') || obj.description || ''}</div>
      <div class="badges" style="margin-top:8px">
        ${(obj.equipment || []).map(e => `<span class="badge">${e}</span>`).join('')}
      </div>
    </div>

    <!-- Season -->
    <div class="section"><h3>${t('objDetail.bestSeason')}</h3><span class="page-sub">${t('objDetail.relVis')}</span></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between"><span class="meta">${ctx.language === 'zh' ? '1月' : 'Jan'}</span><span class="meta">${ctx.language === 'zh' ? '12月' : 'Dec'}</span></div>
      <div class="season">${seasonChart}</div>
      <div class="meta" style="margin-top:8px">${seasonText ? seasonText + ' · ' : ''}${ctx.language === 'zh' ? '在此纬度，' : 'For this latitude, '}${tCat(obj.id, 'name') || obj.name} ${seasonData[currentMonth] >= 3 ? t('objDetail.wellPlaced') : t('objDetail.lowTonight')}</div>
    </div>

    <!-- Weather conditions (6 metrics for selected date) -->
    <div class="section"><h3>${t('placeDetail.forecast')}</h3></div>
    <div class="grid-2" id="objWeatherGrid">
      <div class="fact">
        <div class="label">${t('placeDetail.temp')}</div>
        <div class="value" id="objTemp">—</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.humidity')}</div>
        <div class="value" id="objHumidity">—</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.wind')}</div>
        <div class="value" id="objWind">—</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.visibility')}</div>
        <div class="value" id="objVisibility">—</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.clouds')}</div>
        <div class="value" id="objClouds">—</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.moonLight')}</div>
        <div class="value" id="objMoonLight">—</div>
      </div>
    </div>

    <!-- Equipment -->
    <div class="section"><h3>${t('objDetail.equipment')}</h3><span class="page-sub">${t('objDetail.recommended')}</span></div>
    <div class="card">
      ${equipRecs.map((eq, i) => {
        const badgeCls = eq.level === 'great' ? 'good' : eq.level === 'recommended' ? 'good' : '';
        const badgeLabel = eq.level === 'great' ? t('equip.great') : eq.level === 'recommended' ? t('equip.recommended') : t('equip.optional');
        return `<div class="list-line${i < equipRecs.length - 1 ? '' : ''}" style="padding:11px 0;${i < equipRecs.length - 1 ? 'border-bottom:1px solid rgba(92,110,140,.22)' : ''}">
          <div class="row">
            <div><strong>${eq.name}</strong><div class="meta">${eq.detail}</div></div>
            <span class="badge ${badgeCls}">${badgeLabel}</span>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- Best places -->
    <div class="section"><h3>${t('objDetail.bestPlaces')}</h3><span class="page-sub">${t('objDetail.forDate')}</span></div>
    ${recSites.length > 0 ? recSites.map(s => `
      <div class="card clickable" data-place-lat="${s.lat}" data-place-lon="${s.lon}" data-place-name="${s.name}">
        <div class="row">
          <div>
            <div class="place">${s.name}</div>
            <div class="meta">${s.distKm} km · Bortle ${s.bortle} · ${s.type}${s.yearCert ? ' · ' + t('status.official') : ''}</div>
          </div>
          <div class="score ${s.bortle <= 2 ? 'great' : s.bortle <= 4 ? 'ok' : 'meh'}" style="width:40px;height:40px;font-size:16px">${Math.max(10, 100 - s.bortle * 10)}</div>
        </div>
      </div>
    `).join('') : '<div class="card"><div class="meta" style="text-align:center;padding:12px 0">' + t('objDetail.noSites') + '</div></div>'}
  `;
}

export function initObjectDetailPage(): void {
  document.getElementById('objDetailBack')?.addEventListener('click', () => {
    (window as any).navigateBack?.();
  });

  document.getElementById('objDetailSave')?.addEventListener('click', () => {
    const btn = document.getElementById('objDetailSave');
    if (!btn) return;
    // Find current object id from the rendered page title / back stack
    const route = ((window as any).getCurrentRoute?.()) as { type: string; id?: string } | undefined;
    const id = route?.type === 'object-detail' ? route.id : undefined;
    if (!id) return;

    const nowFav = toggleFavorite(id);
    if (nowFav) {
      btn.textContent = '♥';
      btn.style.color = '#ff4d6d';
      btn.style.borderColor = '#ff4d6d55';
      (window as any).toast?.(ctx.language === 'zh' ? '已收藏' : 'Added to favorites');
    } else {
      btn.textContent = '♡';
      btn.style.color = '';
      btn.style.borderColor = '';
      (window as any).toast?.(ctx.language === 'zh' ? '已取消收藏' : 'Removed from favorites');
    }
  });

  // Fetch weather for condition cards
  loadObjectWeather();

  // Context change (date/time) → re-render the whole page
  if (unsubContext) unsubContext();
  unsubContext = onContextChange(() => {
    const route = ((window as any).getCurrentRoute?.()) as { type: string; id?: string } | undefined;
    const objectId = route?.type === 'object-detail' ? route.id : undefined;
    if (!objectId) return;
    const container = document.getElementById('pageContainer');
    if (!container) return;
    container.innerHTML = renderObjectDetailPage(objectId);
    initObjectDetailPage();
  });
}

// ===== Object Weather (6 metrics, mirroring place-detail) =====
function loadObjectWeather() {
  const route = ((window as any).getCurrentRoute?.()) as { type: string; id?: string } | undefined;
  const objectId = route?.type === 'object-detail' ? route.id : undefined;
  if (!objectId) return;
  const obj = celestialCatalog.find(o => o.id === objectId);
  if (!obj) return;

  const loc = { lat: ctx.location.lat, lon: ctx.location.lon };
  const isZh = (ctx.language || 'zh') === 'zh';

  fetchHourlyWeather(loc).then(weatherData => {
    if (!weatherData) {
      showObjWeatherUnavailable(isZh);
      return;
    }

    const [hh, mm] = ctx.startTime.split(':').map(Number);
    const baseDate = new Date(ctx.date);
    baseDate.setHours(hh || 22, mm || 0, 0, 0);
    const targetDate = new Date(baseDate.getTime());

    // Out of the 15-day forecast window → hide the section
    const now = Date.now();
    const maxTime = now + 15 * 24 * 3600_000;
    if (targetDate.getTime() < now - 3600_000 || targetDate.getTime() > maxTime) {
      hideObjWeatherGrid(isZh);
      return;
    }

    const moonInfo = computeMoonPhase(targetDate, loc);

    const targetHour = targetDate.getTime();
    let bestIdx = -1;
    let bestDiff = Infinity;
    weatherData.forEach((h: any, i: number) => {
      const diff = Math.abs(new Date(h.time).getTime() - targetHour);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    });
    const hw = bestIdx >= 0 ? weatherData[bestIdx] : undefined;
    if (!hw) {
      showObjWeatherUnavailable(isZh);
      return;
    }
    if (hw) {
      const setVal = (id: string, v: string) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      setVal('objTemp', `${Math.round(hw.temperature)}°C`);
      setVal('objHumidity', `${Math.round(hw.humidity)}%`);
      const windLabel = hw.windSpeed > 15 ? (isZh ? '大风' : 'Windy')
        : hw.windSpeed > 10 ? (isZh ? '有风' : 'Breezy')
        : (isZh ? '微风' : 'Calm');
      setVal('objWind', `${Math.round(hw.windSpeed)} km/h · ${windLabel}`);
      const visLabel = hw.visibility < 5 ? (isZh ? '较差' : 'Poor')
        : hw.visibility < 10 ? (isZh ? '一般' : 'Fair')
        : (isZh ? '良好' : 'Good');
      setVal('objVisibility', `${hw.visibility} km · ${visLabel}`);
      const cloudLabel = hw.cloudCover > 60 ? (isZh ? '多云' : 'Cloudy')
        : hw.cloudCover > 30 ? (isZh ? '部分多云' : 'Partly cloudy')
        : (isZh ? '晴朗' : 'Clear');
      setVal('objClouds', `${hw.cloudCover}% · ${cloudLabel}`);
      const moonPct = Math.round(moonInfo.illumination * 100);
      setVal('objMoonLight', `${moonPct}%`);
    }
  }).catch(() => {
    showObjWeatherUnavailable(isZh);
  });
}

// ===== Weather fallback helpers =====
function hideObjWeatherGrid(isZh: boolean): void {
  const grid = document.getElementById('objWeatherGrid');
  if (!grid) return;
  grid.innerHTML = `<div class="fact" style="grid-column:1/-1"><div class="label"></div><div class="value">${isZh ? '所选日期超出15天预报范围，暂无天气数据' : 'No weather data for dates beyond the 15-day forecast'}</div></div>`;
}

function showObjWeatherUnavailable(isZh: boolean): void {
  const grid = document.getElementById('objWeatherGrid');
  if (!grid) return;
  grid.innerHTML = `<div class="fact" style="grid-column:1/-1"><div class="label"></div><div class="value">${isZh ? '暂无天气数据' : 'No weather data'}</div></div>`;
}
