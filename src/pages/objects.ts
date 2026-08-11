// ===== Objects 页面 =====
// "我想看某个天体，怎么看、去哪里看"
import type { CelestialObject, CelestialPosition, CelestialCategory, EquipmentType } from '../types';
import { ctx, onContextChange, formatDateShort, equipmentSummary } from '../lib/context';
import { celestialCatalog } from '../lib/catalog';
import { computePosition, computeMoonPhase, computeSunInfo } from '../lib/astronomy';
import { fetchHourlyWeather, computeHourlyScore, findBestWindow } from '../lib/weather';
import { DARK_SKY_PLACES } from '../lib/dark-sky-places';

// ===== Filter chips =====
type ObjectFilter = 'all' | 'star' | 'planet' | 'deepSky' | 'moon' | 'milkyway' | 'meteor';
const FILTERS: { key: ObjectFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'star', label: 'Stars' },
  { key: 'planet', label: 'Planets' },
  { key: 'deepSky', label: 'Deep Sky' },
  { key: 'moon', label: 'Moon' },
  { key: 'milkyway', label: 'Milky Way' },
  { key: 'meteor', label: 'Meteor' },
];

// ===== Sort modes =====
type SortMode = 'altitude' | 'magnitude' | 'name';
const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'altitude', label: 'Altitude' },
  { key: 'magnitude', label: 'Brightness' },
  { key: 'name', label: 'Name' },
];

// ===== State =====
let currentFilter: ObjectFilter = 'all';
let currentSort: SortMode = 'altitude';
let searchQuery = '';
let computedPositions: Map<string, CelestialPosition> = new Map();
let overallWeatherScore = 0;
let moonPhaseName = '';
let bestWindow = '';

// ===== Season data (simplified visibility per month) =====
const SEASON_DATA: Record<string, number[]> = {
  // 12 months, 0=Jan, value 0-4 = visibility quality
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

// ===== Render =====
export function renderObjectsPage(): string {
  return `
    <div class="page-top">
      <div>
        <div class="page-sub">What is worth seeing?</div>
        <h1>Objects</h1>
      </div>
      <button class="icon-btn" id="objectsSortBtn">⇅</button>
    </div>

    <div class="date-bar">
      <button class="date-btn" id="objectsDateBtn">
        <strong>${formatDateShort()} · ${ctx.startTime}</strong>
        <span>Observation time</span>
      </button>
      <button class="date-btn" id="objectsEquipBtn">
        <strong>${equipmentSummary()}</strong>
        <span>Your equipment</span>
      </button>
    </div>

    <div class="hero-card">
      <h2>Plan your observation</h2>
      <p>Browse all visible objects tonight. Sort by altitude, brightness, or name. Filter by type or your equipment.</p>
      <div class="search">
        <input id="objectsSearch" placeholder="Search star, planet, nebula..." value="${searchQuery}">
        <button id="objectsSearchBtn">⌕</button>
      </div>
    </div>

    <div class="chips" id="objectsChips">
      ${FILTERS.map(f => `<button class="chip ${currentFilter === f.key ? 'active' : ''}" data-filter="${f.key}">${f.label}</button>`).join('')}
    </div>

    <!-- Sort mode indicator -->
    <div id="objectsSortIndicator" class="section" style="margin-bottom:0">
      <h3 style="font-size:14px">Sorted by ${SORT_OPTIONS.find(s => s.key === currentSort)?.label}</h3>
      <span class="page-sub" id="objectsCount">—</span>
    </div>

    <!-- Object list -->
    <div id="objectsList"></div>
  `;
}

export function initObjectsPage(): void {
  // Chip filter
  document.getElementById('objectsChips')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.chip') as HTMLElement;
    if (!btn) return;
    currentFilter = (btn.dataset.filter || 'all') as ObjectFilter;
    document.querySelectorAll('#objectsChips .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderObjectList();
  });

  // Sort button
  document.getElementById('objectsSortBtn')?.addEventListener('click', () => {
    const idx = SORT_OPTIONS.findIndex(s => s.key === currentSort);
    currentSort = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].key;
    const indicator = document.getElementById('objectsSortIndicator');
    if (indicator) {
      indicator.querySelector('h3')!.textContent = `Sorted by ${SORT_OPTIONS.find(s => s.key === currentSort)?.label}`;
    }
    renderObjectList();
  });

  // Date / Equipment buttons
  document.getElementById('objectsDateBtn')?.addEventListener('click', () => {
    (window as any).openModal?.('dateModal');
  });
  document.getElementById('objectsEquipBtn')?.addEventListener('click', () => {
    (window as any).openModal?.('equipmentModal');
  });

  // Search
  const searchInput = document.getElementById('objectsSearch') as HTMLInputElement;
  searchInput?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    renderObjectList();
  });

  // Context change
  onContextChange(() => {
    recalculateObjects();
  });

  // Initial calculation
  recalculateObjects();
}

// ===== Computation =====
async function recalculateObjects() {
  const listContainer = document.getElementById('objectsList');
  if (!listContainer) return;

  try {
    const loc = { lat: ctx.location.lat, lon: ctx.location.lon };
    const [hh, mm] = ctx.startTime.split(':').map(Number);
    const obsDate = new Date(ctx.date);
    obsDate.setHours(hh || 22, mm || 0, 0, 0);

    // Compute positions for all catalog objects
    computedPositions.clear();
    for (const obj of celestialCatalog) {
      const pos = computePosition(obj, loc, obsDate);
      computedPositions.set(obj.id, pos);
    }

    // Weather + moon info
    const moonInfo = computeMoonPhase(obsDate, loc);
    const sunInfo = computeSunInfo(obsDate, loc);
    moonPhaseName = moonInfo.phaseName;

    try {
      const weatherData = await fetchHourlyWeather(loc);
      if (weatherData) {
        const hourlyScores = weatherData.filter((_: any, i: number) => i % 2 === 0).map((h: any) => {
          const r = computeHourlyScore({
            cloudCover: h.cloudCover, moonAltitude: moonInfo.altitude,
            moonIllumination: moonInfo.illumination, sunAltitude: sunInfo.altitude,
            windSpeed: h.windSpeed, bortle: ctx.location.bortle, visibility: h.visibility
          });
          return { time: new Date(h.time), score: r.score };
        });
        const window = findBestWindow(hourlyScores);
        if (window) {
          overallWeatherScore = window.score;
          bestWindow = `${window.start}–${window.end}`;
        }
      }
    } catch {
      // Weather fetch failed, continue without
    }

    renderObjectList();
  } catch (err) {
    console.error('recalculateObjects error:', err);
  }
}

// ===== Render Object List =====
function renderObjectList() {
  const container = document.getElementById('objectsList');
  const countEl = document.getElementById('objectsCount');
  if (!container) return;

  // Filter objects
  let objects = celestialCatalog.filter(obj => {
    // Category filter
    if (currentFilter !== 'all' && obj.type !== currentFilter) return false;
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return obj.name.toLowerCase().includes(q)
        || obj.id.toLowerCase().includes(q)
        || (obj.constellation && obj.constellation.toLowerCase().includes(q));
    }
    return true;
  });

  // Attach computed positions and sort
  const objectsWithPos = objects.map(obj => {
    const pos = computedPositions.get(obj.id);
    return { obj, pos: pos || null };
  });

  // Sort
  objectsWithPos.sort((a, b) => {
    switch (currentSort) {
      case 'altitude':
        return (b.pos?.altitude || -100) - (a.pos?.altitude || -100);
      case 'magnitude':
        return a.obj.magnitude - b.obj.magnitude;
      case 'name':
        return a.obj.name.localeCompare(b.obj.name, 'zh');
    }
  });

  // Update count
  if (countEl) countEl.textContent = `${objectsWithPos.length} objects`;

  if (objectsWithPos.length === 0) {
    container.innerHTML = `
      <div class="card">
        <div class="meta" style="text-align:center;padding:30px 0">
          No objects match your filter. Try a different category or search.
        </div>
      </div>`;
    return;
  }

  container.innerHTML = objectsWithPos.map(({ obj, pos }) => renderObjectCard(obj, pos)).join('');

  // Bind click handlers
  container.querySelectorAll('.object-card').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.id!;
      expandObjectDetail(id);
    });
  });

  // Bind expand collapse
  container.querySelectorAll('.object-detail-close').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (el as HTMLElement).dataset.id!;
      const detail = document.getElementById(`detail-${id}`);
      if (detail) detail.remove();
    });
  });
}

function renderObjectCard(obj: CelestialObject, pos: CelestialPosition | null): string {
  const visible = pos?.visible && (pos.altitude > 0);
  const altText = pos ? `${pos.altitude.toFixed(0)}°` : '—';
  const dirText = pos?.directionText || '—';
  const bestTime = pos?.bestTime || '—';

  // Season indicator
  const month = new Date().getMonth();
  const seasonData = SEASON_DATA[obj.id];
  const seasonScore = seasonData ? seasonData[month] : 2;
  const seasonLabel = ['—', 'Low', 'Mid', 'High', 'Best'][seasonScore];

  // Equipment match
  const equipMatch = getEquipmentMatch(obj);

  // Type badge
  const typeInfo = typeToInfo(obj.type);

  // Difficulty badge
  const diffInfo = difficultyInfo(obj.difficulty);

  // Score based on altitude + magnitude + season
  let score = 0;
  if (visible && pos) {
    score = Math.round(Math.min(100, pos.altitude * 1.2 + (obj.magnitude < 0 ? 40 : obj.magnitude < 2 ? 25 : 10)));
  }
  const scoreCls = score >= 70 ? 'great' : score >= 40 ? 'ok' : score >= 20 ? 'meh' : 'bad';

  return `
    <div class="card object-card clickable" data-id="${obj.id}">
      <div class="row">
        <div style="flex:1;min-width:0">
          <div class="place">${obj.name}</div>
          <div class="meta">
            ${obj.constellation !== '—' ? obj.constellation : ''} · Mag ${obj.magnitude > 0 ? '+' : ''}${obj.magnitude.toFixed(1)}
            ${visible ? ` · <span style="color:var(--good)">${altText} ${dirText}</span>` : ' · <span style="color:var(--dim)">Below horizon</span>'}
          </div>
        </div>
        <div style="text-align:right;flex:0 0 auto">
          <div class="score ${scoreCls}">${visible ? score : '—'}</div>
        </div>
      </div>
      <div class="badges">
        <span class="badge ${typeInfo.cls}">${typeInfo.label}</span>
        ${visible ? `<span class="badge">${bestTime}</span>` : ''}
        ${seasonScore >= 3 ? `<span class="badge good">${seasonLabel} season</span>` : seasonScore === 1 ? `<span class="badge warn">Low season</span>` : ''}
        ${equipMatch ? `<span class="badge official">${equipMatch}</span>` : ''}
        <span class="badge ${diffInfo.cls}">${diffInfo.label}</span>
      </div>
      ${obj.description ? `<div class="meta" style="margin-top:8px">${obj.description}</div>` : ''}
    </div>`;
}

// ===== Expanded Detail =====
function expandObjectDetail(id: string) {
  // Remove existing detail
  const existing = document.getElementById(`detail-${id}`);
  if (existing) { existing.remove(); return; }

  const obj = celestialCatalog.find(o => o.id === id);
  if (!obj) return;

  const pos = computedPositions.get(id);
  const card = document.querySelector(`.object-card[data-id="${id}"]`);

  const visible = pos?.visible && (pos.altitude > 0);
  const altText = pos ? `${pos.altitude.toFixed(1)}°` : '—';
  const azText = pos ? `${pos.azimuth}°` : '—';
  const dirText = pos?.directionText || '—';
  const bestTime = pos?.bestTime || '—';

  // Season chart
  const seasonData = SEASON_DATA[id] || Array(12).fill(2);
  const monthNames = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  const currentMonth = new Date().getMonth();
  const seasonChart = monthNames.map((m, i) => {
    const v = seasonData[i];
    const height = v * 6 + 4;
    const isCurrent = i === currentMonth;
    const color = v >= 3 ? 'var(--good)' : v >= 2 ? 'var(--blue)' : v >= 1 ? 'var(--warn)' : 'var(--dim)';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
      <div style="width:14px;height:${height}px;background:${color};border-radius:3px;opacity:${isCurrent ? 1 : 0.6}"></div>
      <span style="font-size:9px;color:${isCurrent ? 'var(--text)' : 'var(--dim)'};font-weight:${isCurrent ? 800 : 400}">${m}</span>
    </div>`;
  }).join('');

  // Recommended dark sites for this object type
  const recSites = getRecommendedSites(obj);

  // Equipment recommendation
  const equipRec = getEquipmentRecommendation(obj);

  const detail = document.createElement('div');
  detail.id = `detail-${id}`;
  detail.className = 'card';
  detail.style.cssText = 'border-color:var(--blue);margin-top:2px;';

  detail.innerHTML = `
    <div class="row" style="margin-bottom:8px">
      <div><div class="page-sub">Object detail</div></div>
      <button class="object-detail-close" data-id="${id}" style="color:var(--muted);font-size:18px">✕</button>
    </div>

    ${visible ? `
    <div class="grid-2" style="margin-bottom:10px">
      <div class="fact">
        <div class="label">Altitude / Azimuth</div>
        <div class="value">${altText} / ${azText}</div>
      </div>
      <div class="fact">
        <div class="label">Direction / Best time</div>
        <div class="value">${dirText} · ${bestTime}</div>
      </div>
    </div>` : `
    <div class="meta" style="text-align:center;padding:8px 0;color:var(--warn)">
      Below horizon at selected time. Try a different date or time.
    </div>`}

    <div class="page-sub" style="margin-bottom:6px">Seasonal visibility</div>
    <div style="display:flex;gap:3px;align-items:flex-end;margin-bottom:12px">${seasonChart}</div>

    ${equipRec ? `
    <div class="page-sub" style="margin-bottom:6px">Equipment</div>
    <div class="meta" style="margin-bottom:12px">${equipRec}</div>` : ''}

    ${recSites.length > 0 ? `
    <div class="page-sub" style="margin-bottom:6px">Recommended dark sites</div>
    ${recSites.map(s => `
      <div class="card" style="padding:10px;margin:6px 0">
        <div class="row">
          <div>
            <div class="place" style="font-size:14px">${s.name}</div>
            <div class="meta">${s.distKm} km · Bortle ${s.bortle} · ${s.type}</div>
          </div>
          <div class="score ${s.bortle <= 2 ? 'great' : s.bortle <= 4 ? 'ok' : 'meh'}" style="width:40px;height:40px;font-size:16px">${Math.max(10, 100 - s.bortle * 10)}</div>
        </div>
      </div>
    `).join('')}` : ''}
  `;

  // Insert after the card
  if (card) {
    card.after(detail);
    // Re-bind close handler
    detail.querySelector('.object-detail-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      detail.remove();
    });
  }
}

// ===== Helpers =====
function typeToInfo(type: CelestialCategory): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    planet:  { cls: 'warn', label: 'Planet' },
    star:    { cls: 'good', label: 'Star' },
    deepSky: { cls: 'official', label: 'Deep Sky' },
    moon:    { cls: '', label: 'Moon' },
    milkyway:{ cls: 'good', label: 'Milky Way' },
    meteor:  { cls: 'warn', label: 'Meteor' },
  };
  return map[type] || { cls: '', label: type };
}

function difficultyInfo(diff?: string): { cls: string; label: string } {
  switch (diff) {
    case 'easy': return { cls: 'good', label: 'Easy' };
    case 'moderate': return { cls: 'warn', label: 'Moderate' };
    case 'challenging': return { cls: 'bad', label: 'Hard' };
    default: return { cls: '', label: '—' };
  }
}

function getEquipmentMatch(obj: CelestialObject): string {
  const eq = ctx.equipment;
  const primaryItem = eq.items.find(i => i.id === eq.primary);
  if (!primaryItem) return '';

  // Check if user's equipment is listed in the object's equipment array
  if (obj.equipment) {
    const eqLabels = obj.equipment;
    const userEquip = equipmentTypeToLabel(primaryItem.type);
    if (eqLabels.some(e => e.includes(userEquip) || userEquip.includes(e))) {
      return `Your ${userEquip} works`;
    }
  }
  return '';
}

function equipmentTypeToLabel(type: EquipmentType): string {
  const map: Record<EquipmentType, string> = {
    naked_eye: '肉眼',
    binoculars: '双筒镜',
    telescope: '望远镜',
    camera: '相机',
    phone: '手机',
  };
  return map[type] || type;
}

function getEquipmentRecommendation(obj: CelestialObject): string {
  if (!obj.equipment || obj.equipment.length === 0) return '';
  const tips: Record<string, string> = {
    '肉眼': 'Visible to naked eye — just look up!',
    '双筒镜': 'Binoculars recommended — 7×50 or 10×50 ideal',
    '望远镜': 'Telescope recommended — 80mm+ aperture for best view',
    '广角相机': 'Wide-angle camera on tripod — long exposure 15-30s',
    '相机': 'Camera with tripod — try 15-30s exposures at high ISO',
  };
  return obj.equipment.map(e => tips[e] || e).join(' · ');
}

function getRecommendedSites(obj: CelestialObject): { name: string; distKm: number; bortle: number; type: string }[] {
  const loc = ctx.location;
  // Deep sky and challenging objects need darker sites
  const needsDarkSky = obj.type === 'deepSky' || obj.type === 'milkyway' || obj.difficulty === 'challenging';
  const maxBortle = needsDarkSky ? 3 : 6;

  return DARK_SKY_PLACES
    .filter(p => p.bortle <= maxBortle)
    .map(p => ({
      name: p.name,
      distKm: Math.round(Math.sqrt((p.lat - loc.lat) ** 2 + (p.lon - loc.lon) ** 2) * 111),
      bortle: p.bortle,
      type: p.type,
    }))
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 3);
}
