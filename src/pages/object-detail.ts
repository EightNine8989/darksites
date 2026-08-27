// ===== 天体详情页 =====
// "我想看这个天体，怎么看、去哪里看"
// 数据来源：后端 /observe/objects/{id}（季节+设备+附近站点）+ 天体目录（基本信息）
import type { CelestialObject } from '../types';
import { ctx, onContextChange } from '../lib/context';
import { getCelestialCatalog } from '../lib/catalog';
import { fetchObserveObjectDetail } from '../lib/api';
import { t } from '../lib/i18n';

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

// ===== Context listener =====
let unsubContext: (() => void) | null = null;

// ===== Month labels =====
const MONTH_LABELS_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const MONTH_LABELS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ===== Render =====
export function renderObjectDetailPage(objectId: string): string {
  const obj = getCelestialCatalog().find(o => o.id === objectId);
  if (!obj) return '<div class="card"><div class="meta" style="text-align:center;padding:40px 0">' + (ctx.language === 'zh' ? '天体未找到' : 'Object not found') + '</div></div>';

  const isZh = (ctx.language || 'zh') === 'zh';
  const monthLabels = isZh ? MONTH_LABELS_ZH : MONTH_LABELS_EN;
  const favState = isFavorite(obj.id);

  // 类型标签
  const typeLabel = typeToLabel(obj.type, isZh);

  // 难度标签
  const diffInfo = difficultyInfo(obj.difficulty, isZh);

  return `
    <div class="page-top">
      <button class="back-btn" id="objDetailBack">‹</button>
      <div class="page-sub">${obj.constellation && obj.constellation !== '—' ? obj.constellation : (isZh ? '天体' : 'Object')}</div>
      <button class="icon-btn" id="objDetailSave" style="${favState ? 'color:#ff4d6d;border-color:#ff4d6d55' : ''}">${favState ? '♥' : '♡'}</button>
    </div>

    <div class="hero-card">
      <div class="page-sub">${isZh ? '天体详情' : 'Object detail'}</div>
      <h1 style="font-size:28px;margin:5px 0">${obj.name}${obj.constellation && obj.constellation !== '—' ? `<span class="const-sub" style="font-size:15px;color:var(--muted);font-weight:600">${isZh ? `（${obj.constellation}）` : ` (${obj.constellation})`}</span>` : ''}</h1>
      <div class="meta">${obj.description || ''}</div>
      <div class="badges" style="margin-top:8px">
        <span class="badge ${typeLabel.cls}">${typeLabel.label}</span>
        <span class="badge ${diffInfo.cls}">${diffInfo.label}</span>
        ${obj.magnitude < 99 ? `<span class="badge">Mag ${obj.magnitude > 0 ? '+' : ''}${obj.magnitude.toFixed(1)}</span>` : ''}
      </div>
    </div>

    <!-- Season (async loaded from backend) -->
    <div class="section"><h3>${t('objDetail.bestSeason')}</h3><span class="page-sub">${t('objDetail.relVis')}</span></div>
    <div class="card" id="seasonCard">
      <div class="meta" style="text-align:center;padding:8px 0">${isZh ? '加载中...' : 'Loading...'}</div>
    </div>

    <!-- Equipment (async loaded from backend) -->
    <div class="section"><h3>${t('objDetail.equipment')}</h3><span class="page-sub">${t('objDetail.recommended')}</span></div>
    <div id="equipmentCard" class="card">
      <div class="meta" style="text-align:center;padding:8px 0">${isZh ? '加载中...' : 'Loading...'}</div>
    </div>

    <!-- Best places (async loaded from backend) -->
    <div class="section"><h3>${t('objDetail.bestPlaces')}</h3><span class="page-sub">${t('objDetail.forDate')}</span></div>
    <div id="sitesCard">
      <div class="card">
        <div class="meta" style="text-align:center;padding:8px 0">${isZh ? '加载中...' : 'Loading...'}</div>
      </div>
    </div>
  `;
}

export function initObjectDetailPage(): void {
  document.getElementById('objDetailBack')?.addEventListener('click', () => {
    (window as any).navigateBack?.();
  });

  document.getElementById('objDetailSave')?.addEventListener('click', () => {
    const btn = document.getElementById('objDetailSave');
    if (!btn) return;
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

  // Async load backend observation data (season + equipment + nearby sites)
  loadObserveData();

  // Context change → re-render
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

// ===== Async: load observe data from backend =====
function loadObserveData(): void {
  const route = ((window as any).getCurrentRoute?.()) as { type: string; id?: string } | undefined;
  const objectId = route?.type === 'object-detail' ? route.id : undefined;
  if (!objectId) return;

  const obj = getCelestialCatalog().find(o => o.id === objectId);
  if (!obj) return;

  const isZh = (ctx.language || 'zh') === 'zh';
  const lat = ctx.location.lat;
  const lon = ctx.location.lon;

  fetchObserveObjectDetail(objectId, lat, lon, 200, 5).then(detail => {
    if (!detail) {
      renderSeasonFallback(obj, isZh);
      renderEquipmentFallback(obj, isZh);
      renderSitesFallback(isZh);
      return;
    }

    renderSeason(detail, isZh);
    renderEquipment(detail, isZh);
    renderSites(detail, isZh);
  });
}

// ===== Season rendering (from backend observation_geometry) =====
function renderSeason(detail: { observation_geometry: any }, isZh: boolean): void {
  const card = document.getElementById('seasonCard');
  if (!card) return;

  const geom = detail.observation_geometry;
  const monthLabels = isZh ? MONTH_LABELS_ZH : MONTH_LABELS_EN;
  const currentMonth = new Date().getMonth();

  // For fixed objects: use best_month to build season curve
  // For dynamic objects: no seasonal data, show visibility window
  if (geom.type === 'fixed' && geom.best_month) {
    const bestMonth = geom.best_month; // 1-12
    const bestIdx = bestMonth - 1; // 0-11
    const isInSeason = geom.is_in_season;

    // Build a simple season curve: peak at best_month, tapering off
    const seasonData = monthLabels.map((_, i) => {
      const dist = Math.min(Math.abs(i - bestIdx), 12 - Math.abs(i - bestIdx));
      if (dist === 0) return 4;       // best
      if (dist <= 1) return 3;        // high
      if (dist <= 3) return 2;        // mid
      return 0;                       // low
    });

    const seasonChart = monthLabels.map((m, i) => {
      const v = seasonData[i];
      const cls = v >= 4 ? 'best' : v >= 3 ? 'high' : v >= 2 ? 'mid' : 'low';
      const isCurrent = i === currentMonth;
      return `<div class="month ${cls}" style="${isCurrent ? 'outline:2px solid var(--text);outline-offset:1px' : ''}"></div>`;
    }).join('');

    const bestMonthLabel = monthLabels[bestIdx];
    const seasonText = isZh
      ? `${bestMonthLabel}最佳` + (geom.transit_altitude_deg ? ` · 最高${geom.transit_altitude_deg.toFixed(0)}°` : '')
      : `Best in ${bestMonthLabel}` + (geom.transit_altitude_deg ? ` · transit ${geom.transit_altitude_deg.toFixed(0)}°` : '');

    const statusText = isInSeason
      ? (isZh ? '当前正值观测季' : 'Currently in season')
      : (isZh ? '当前非最佳季节' : 'Not in best season');

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between"><span class="meta">${monthLabels[0]}</span><span class="meta">${monthLabels[11]}</span></div>
      <div class="season">${seasonChart}</div>
      <div class="meta" style="margin-top:8px">${seasonText} · ${statusText}</div>
    `;
  } else if (geom.type === 'dynamic' && geom.window_start) {
    // Dynamic objects (planets/moon): show visibility window
    const ws = new Date(geom.window_start);
    const we = geom.window_end ? new Date(geom.window_end) : null;
    const fmt = (d: Date) => isZh
      ? `${d.getMonth()+1}月${d.getDate()}日 ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
      : `${d.toLocaleDateString('en-US', {month:'short', day:'numeric'})} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;

    const altInfo = geom.altitude_start_deg != null
      ? (isZh ? `高度角 ${geom.altitude_start_deg.toFixed(0)}°` : `Altitude ${geom.altitude_start_deg.toFixed(0)}°`)
      : '';

    card.innerHTML = `
      <div class="meta" style="margin:4px 0">${isZh ? '可见窗口' : 'Visibility window'}</div>
      <div style="font-size:16px;font-weight:700">${fmt(ws)}${we ? ' → ' + fmt(we) : ''}</div>
      ${altInfo ? `<div class="meta" style="margin-top:8px">${altInfo}${geom.altitude_end_deg != null ? ' → ' + geom.altitude_end_deg.toFixed(0) + '°' : ''}</div>` : ''}
    `;
  } else {
    card.innerHTML = `<div class="meta" style="text-align:center;padding:8px 0">${isZh ? '暂无季节数据' : 'No seasonal data'}</div>`;
  }
}

// ===== Equipment rendering (from backend recommended_equipment) =====
function renderEquipment(detail: { recommended_equipment?: string[]; required_bortle?: number }, isZh: boolean): void {
  const card = document.getElementById('equipmentCard');
  if (!card) return;

  const recs = detail.recommended_equipment || [];

  if (recs.length === 0) {
    card.innerHTML = `<div class="meta" style="text-align:center;padding:8px 0">${isZh ? '暂无设备推荐' : 'No equipment data'}</div>`;
    return;
  }

  // Required Bortle badge
  const bortleInfo = detail.required_bortle
    ? `<div class="meta" style="margin-bottom:8px">${isZh ? `所需暗度：Bortle ≤ ${detail.required_bortle}` : `Required darkness: Bortle ≤ ${detail.required_bortle}`}</div>`
    : '';

  card.innerHTML = bortleInfo + recs.map((eq, i) => {
    const isLast = i === recs.length - 1;
    // Equipment strings from backend are plain text descriptions
    return `<div class="list-line" style="padding:11px 0;${isLast ? '' : 'border-bottom:1px solid rgba(92,110,140,.22)'}">
      <div class="row">
        <div><strong>${eq}</strong></div>
        <span class="badge good">${isZh ? '推荐' : 'Recommended'}</span>
      </div>
    </div>`;
  }).join('');
}

// ===== Sites rendering (from backend nearby_sites) =====
function renderSites(detail: { nearby_sites?: any[]; total_sites?: number }, isZh: boolean): void {
  const container = document.getElementById('sitesCard');
  if (!container) return;

  const sites = detail.nearby_sites || [];

  if (sites.length === 0) {
    container.innerHTML = `<div class="card"><div class="meta" style="text-align:center;padding:12px 0">${t('objDetail.noSites')}</div></div>`;
    return;
  }

  container.innerHTML = sites.map(s => {
    const score = s.bortle_estimated ? Math.max(10, 100 - s.bortle_estimated * 10) : 50;
    const scoreCls = s.bortle_estimated <= 2 ? 'great' : s.bortle_estimated <= 4 ? 'ok' : 'meh';
    const distText = s.distance_km != null ? `${Math.round(s.distance_km)} km` : '';
    const bortleText = s.bortle_estimated ? `Bortle ${s.bortle_estimated}` : '';
    const darkBadge = s.dark_enough === false
      ? `<span class="badge bad">${isZh ? '不够暗' : 'Too bright'}</span>`
      : s.dark_enough === true
      ? `<span class="badge good">${isZh ? '够暗' : 'Dark enough'}</span>`
      : '';
    const weatherBadge = s.weather_pass === false
      ? `<span class="badge warn">${isZh ? '天气不佳' : 'Weather poor'}</span>`
      : s.weather_pass === true
      ? `<span class="badge good">${isZh ? '天气良好' : 'Weather OK'}</span>`
      : '';

    return `
      <div class="card clickable obj-site-card" data-site-id="${s.site_id}">
        <div class="row">
          <div>
            <div class="place">${s.site_name || '—'}</div>
            <div class="meta">${[distText, bortleText, s.site_type].filter(Boolean).join(' · ')}</div>
          </div>
          <div class="score ${scoreCls}" style="width:40px;height:40px;font-size:16px">${score}</div>
        </div>
        ${darkBadge || weatherBadge ? `<div class="badges" style="margin-top:6px">${darkBadge}${weatherBadge}</div>` : ''}
      </div>
    `;
  }).join('');

  // Bind click → navigate to site-object-detail
  container.querySelectorAll('.obj-site-card').forEach(el => {
    el.addEventListener('click', () => {
      const siteId = (el as HTMLElement).dataset.siteId;
      const route = ((window as any).getCurrentRoute?.()) as { type: string; id?: string } | undefined;
      const objId = route?.type === 'object-detail' ? route.id : undefined;
      if (siteId && objId) {
        (window as any).navigateTo?.('site-object-detail', siteId, objId);
      }
    });
  });
}

// ===== Fallback renderers (when API fails) =====
function renderSeasonFallback(obj: CelestialObject, isZh: boolean): void {
  const card = document.getElementById('seasonCard');
  if (!card) return;
  // Simple fallback: no season data
  card.innerHTML = `<div class="meta" style="text-align:center;padding:8px 0">${isZh ? '暂无季节数据' : 'No seasonal data'}</div>`;
}

function renderEquipmentFallback(obj: CelestialObject, isZh: boolean): void {
  const card = document.getElementById('equipmentCard');
  if (!card) return;
  // Use obj.equipment if available
  const eqs = obj.equipment || [];
  if (eqs.length === 0) {
    card.innerHTML = `<div class="meta" style="text-align:center;padding:8px 0">${isZh ? '暂无设备推荐' : 'No equipment data'}</div>`;
    return;
  }
  card.innerHTML = eqs.map((eq, i) => {
    const isLast = i === eqs.length - 1;
    return `<div class="list-line" style="padding:11px 0;${isLast ? '' : 'border-bottom:1px solid rgba(92,110,140,.22)'}">
      <div class="row"><div><strong>${eq}</strong></div>
      <span class="badge good">${isZh ? '推荐' : 'Recommended'}</span></div>
    </div>`;
  }).join('');
}

function renderSitesFallback(isZh: boolean): void {
  const container = document.getElementById('sitesCard');
  if (!container) return;
  container.innerHTML = `<div class="card"><div class="meta" style="text-align:center;padding:12px 0">${isZh ? '暂无附近站点数据' : 'No nearby site data'}</div></div>`;
}

// ===== Helpers =====
function typeToLabel(type: string, isZh: boolean): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    planet:       { cls: 'warn', label: isZh ? '行星' : 'Planet' },
    star:         { cls: 'good', label: isZh ? '恒星' : 'Star' },
    deepSky:      { cls: 'official', label: isZh ? '深空' : 'Deep Sky' },
    galaxy:       { cls: 'official', label: isZh ? '星系' : 'Galaxy' },
    moon:         { cls: '', label: isZh ? '月亮' : 'Moon' },
    milkyway:     { cls: 'good', label: isZh ? '银河' : 'Milky Way' },
    meteor:       { cls: 'warn', label: isZh ? '流星' : 'Meteor' },
    comet:        { cls: 'warn', label: isZh ? '彗星' : 'Comet' },
    asteroid:     { cls: 'warn', label: isZh ? '小行星' : 'Asteroid' },
    doubleStar:   { cls: 'good', label: isZh ? '双星' : 'Double Star' },
    multipleStar: { cls: 'good', label: isZh ? '聚星' : 'Multiple Star' },
  };
  return map[type] || { cls: '', label: type };
}

function difficultyInfo(diff?: string, isZh = true): { cls: string; label: string } {
  switch (diff) {
    case 'easy': return { cls: 'good', label: isZh ? '简单' : 'Easy' };
    case 'moderate': return { cls: 'warn', label: isZh ? '中等' : 'Moderate' };
    case 'challenging': return { cls: 'bad', label: isZh ? '困难' : 'Hard' };
    default: return { cls: '', label: '—' };
  }
}
