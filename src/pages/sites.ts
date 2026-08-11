// ===== Sites 页面 =====
// "我在这里，往哪个方向看、每个方向能看到什么"
import type { CelestialPosition, DirectionSky, CelestialCategory } from '../types';
import { ctx, onContextChange, formatDateShort, equipmentSummary } from '../lib/context';
import { celestialCatalog } from '../lib/catalog';
import { computePosition, computeMoonPhase, computeSunInfo, groupByDirection } from '../lib/astronomy';
import { fetchHourlyWeather, computeHourlyScore, findBestWindow } from '../lib/weather';
import { DARK_SKY_PLACES } from '../lib/dark-sky-places';

// ===== 8 方位定义 =====
const DIRECTIONS = [
  { key: 'N',  labelZh: '北', azimuth: 0 },
  { key: 'NE', labelZh: '东北', azimuth: 45 },
  { key: 'E',  labelZh: '东', azimuth: 90 },
  { key: 'SE', labelZh: '东南', azimuth: 135 },
  { key: 'S',  labelZh: '南', azimuth: 180 },
  { key: 'SW', labelZh: '西南', azimuth: 225 },
  { key: 'W',  labelZh: '西', azimuth: 270 },
  { key: 'NW', labelZh: '西北', azimuth: 315 },
];

// ===== State =====
let directionSkies: DirectionSky[] = [];
let activeDirection: string | null = null;
let weatherData: any = null;
let overallScore = 0;
let moonPhaseName = '';
let bestWindow = '';

// ===== Render =====
export function renderSitesPage(): string {
  const dateLabel = formatDateShort();
  const equipLabel = equipmentSummary();

  return `
    <div class="page-top">
      <div>
        <div class="page-sub">Where to look tonight</div>
        <h1>Sites</h1>
      </div>
      <button class="icon-btn" id="sitesContribute">＋</button>
    </div>

    <div class="date-bar">
      <button class="date-btn" id="sitesDateBtn">
        <strong>${dateLabel} · ${ctx.startTime}</strong>
        <span>Change date & time</span>
      </button>
      <button class="date-btn" id="sitesEquipBtn">
        <strong>${equipLabel}</strong>
        <span>Your equipment</span>
      </button>
    </div>

    <div class="hero-card">
      <h2>Look this way</h2>
      <p>Each direction shows what's visible tonight. Scores change with date, Moon, weather and your equipment.</p>
      <div class="search">
        <input id="sitesSearch" placeholder="Search object">
        <button id="sitesSearchBtn">⌕</button>
      </div>
      <div class="chips" id="sitesChips">
        <button class="chip ${ctx.activeTarget === 'all' ? 'active' : ''}" data-target="all">All</button>
        <button class="chip ${ctx.activeTarget === 'milkyway' ? 'active' : ''}" data-target="milkyway">Milky Way</button>
        <button class="chip ${ctx.activeTarget === 'meteor' ? 'active' : ''}" data-target="meteor">Meteor Shower</button>
        <button class="chip ${ctx.activeTarget === 'moon' ? 'active' : ''}" data-target="moon">Moon</button>
        <button class="chip ${ctx.activeTarget === 'planets' ? 'active' : ''}" data-target="planets">Planets</button>
      </div>
    </div>

    <!-- Compass -->
    <div id="compassContainer"></div>

    <!-- Direction Detail (shown when a direction is tapped) -->
    <div id="directionDetail"></div>

    <!-- Nearby dark sites -->
    <div class="section">
      <h3>Nearby dark sites</h3>
      <span class="page-sub">For ${dateLabel}</span>
    </div>
    <div id="nearbySites"></div>
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

  // Contribute button
  document.getElementById('sitesContribute')?.addEventListener('click', () => {
    (window as any).toast?.('Contribution flow coming soon');
  });

  // Search
  document.getElementById('sitesSearch')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    if (q) highlightDirectionForObject(q);
  });

  // Context change listener
  onContextChange(() => {
    updateDateBar();
    recalculate();
  });

  // Initial calculation
  recalculate();
}

function destroySitesPage(): void {
  // cleanup handled by main.ts tab switch
}

// ===== Core Computation =====
async function recalculate() {
  const container = document.getElementById('compassContainer');
  if (!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div><span>Calculating sky...</span></div>';

  try {
    const loc = { lat: ctx.location.lat, lon: ctx.location.lon };
    // Build observation date from ctx.date + ctx.startTime
    const [hh, mm] = ctx.startTime.split(':').map(Number);
    const obsDate = new Date(ctx.date);
    obsDate.setHours(hh || 22, mm || 0, 0, 0);

    // Compute positions for all objects at observation time
    const positions = celestialCatalog
      .filter(obj => filterByTarget(obj.type))
      .map(obj => computePosition(obj, loc, obsDate))
      .filter(p => p.visible && p.altitude > 0);

    // Group by direction
    const dirMap = groupByDirection(positions);

    // Fetch weather for scoring
    weatherData = await fetchHourlyWeather(loc);
    const moonInfo = computeMoonPhase(obsDate, loc);
    const sunInfo = computeSunInfo(obsDate, loc);
    moonPhaseName = moonInfo.phaseName;

    // Build DirectionSky for each direction
    directionSkies = DIRECTIONS.map(d => {
      const objs = (dirMap.get(d.key) || [])
        .sort((a, b) => b.altitude - a.altitude)
        .map(p => ({
          id: p.object.id, name: p.object.name, type: p.object.type,
          altitude: p.altitude, bestTime: p.bestTime, magnitude: p.magnitude, visible: true
        }));

      // Score: base from objects count/quality, modulated by weather/moon
      let score = 0;
      if (objs.length > 0) {
        const bestAlt = objs[0].altitude;
        const count = objs.length;
        score = Math.min(100, 30 + count * 15 + Math.min(bestAlt, 60));
      }

      // Weather penalty
      if (weatherData) {
        const hourlyScores = buildHourlyScores(weatherData, moonInfo, sunInfo, ctx.location.bortle);
        const window = findBestWindow(hourlyScores);
        if (window) {
          bestWindow = `${window.start}–${window.end}`;
          overallScore = window.score;
          // If weather is bad in this direction's time, reduce score
          score = Math.round(score * (window.score / 100 + 0.3));
        }
      }

      // Moon penalty for directions near moon
      if (moonInfo.altitude > 0 && moonInfo.illumination > 0.5) {
        const moonDir = Math.round(moonInfo.azimuth / 45) % 8;
        const dirIdx = DIRECTIONS.findIndex(dd => dd.key === d.key);
        const moonDist = Math.min(Math.abs(moonDir - dirIdx), 8 - Math.abs(moonDir - dirIdx));
        if (moonDist <= 1) score = Math.round(score * 0.6);
      }

      return {
        azimuth: d.azimuth, name: d.key, labelZh: d.labelZh,
        score: Math.max(0, Math.min(100, score)),
        objects: objs, horizonClear: objs.some(o => o.altitude > 10)
      };
    });

    renderCompass();
    renderNearbySites();
  } catch (err) {
    console.error('recalculate error:', err);
    container.innerHTML = '<div class="loading"><span>Calculation failed, retrying...</span></div>';
  }
}

function filterByTarget(type: CelestialCategory): boolean {
  const t = ctx.activeTarget;
  if (t === 'all') return true;
  if (t === 'milkyway') return type === 'milkyway';
  if (t === 'meteor') return type === 'meteor';
  if (t === 'moon') return type === 'moon';
  if (t === 'planets') return type === 'planet';
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

// ===== Compass Rendering =====
function renderCompass() {
  const container = document.getElementById('compassContainer');
  if (!container) return;

  const dirsHtml = directionSkies.map(d => {
    const scoreClass = d.score >= 70 ? 'great' : d.score >= 40 ? 'ok' : d.score >= 20 ? 'meh' : 'bad';
    const objCount = d.objects.length;
    const topObj = d.objects[0]?.name || '';
    return `
      <div class="compass-dir ${activeDirection === d.name ? 'active' : ''}" data-dir="${d.name}">
        <span class="dir-label">${d.labelZh}</span>
        <span class="dir-score score ${scoreClass}">${d.score}</span>
        <span class="dir-objects">${objCount > 0 ? topObj + (objCount > 1 ? ` +${objCount - 1}` : '') : '—'}</span>
      </div>`;
  }).join('');

  // Overall score ring
  const overallClass = overallScore >= 70 ? 'great' : overallScore >= 40 ? 'ok' : 'meh';
  const summaryHtml = `
    <div style="text-align:center;margin:0 0 4px;">
      <span class="score ${overallClass}" style="width:56px;height:56px;font-size:24px;border-radius:17px;">${overallScore}</span>
    </div>
    <div style="text-align:center;margin-bottom:4px;">
      <span class="badge good">${moonPhaseName}</span>
      ${bestWindow ? `<span class="badge">${bestWindow}</span>` : ''}
    </div>`;

  container.innerHTML = `
    ${summaryHtml}
    <div class="compass">
      <div class="compass-ring"></div>
      <div class="compass-center"></div>
      ${dirsHtml}
    </div>`;

  // Click handlers for direction
  container.querySelectorAll('.compass-dir').forEach(el => {
    el.addEventListener('click', () => {
      const dir = (el as HTMLElement).dataset.dir!;
      activeDirection = activeDirection === dir ? null : dir;
      renderCompass();
      renderDirectionDetail();
    });
  });
}

// ===== Direction Detail =====
function renderDirectionDetail() {
  const container = document.getElementById('directionDetail');
  if (!container) return;

  if (!activeDirection) {
    container.innerHTML = '';
    return;
  }

  const sky = directionSkies.find(d => d.name === activeDirection);
  if (!sky) return;

  const objCards = sky.objects.map(o => {
    const typeBadge = typeToBadge(o.type);
    return `
      <div class="card clickable" data-object="${o.id}">
        <div class="row">
          <div>
            <div class="place">${o.name}</div>
            <div class="meta">Alt ${o.altitude.toFixed(0)}° · Best ${o.bestTime}</div>
          </div>
          <span class="badge ${typeBadge.cls}">${typeBadge.label}</span>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="section">
      <h3>${sky.labelZh} direction</h3>
      <span class="page-sub">${sky.objects.length} object${sky.objects.length !== 1 ? 's' : ''} visible</span>
    </div>
    ${sky.objects.length > 0 ? objCards : '<div class="card"><div class="meta" style="text-align:center;padding:20px 0">No bright objects in this direction tonight</div></div>'}
  `;

  // Object card click
  container.querySelectorAll('[data-object]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.object;
      (window as any).toast?.(`Opening ${id} detail...`);
    });
  });
}

// ===== Nearby Dark Sites =====
function renderNearbySites() {
  const container = document.getElementById('nearbySites');
  if (!container) return;

  // Use dark sky places as nearby sites
  // Filter by distance (simple lat/lon distance)
  const loc = ctx.location;
  const sites = DARK_SKY_PLACES
    .map(p => ({
      ...p,
      distKm: Math.round(Math.sqrt((p.lat - loc.lat)**2 + (p.lon - loc.lon)**2) * 111),
    }))
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 5);

  if (sites.length === 0) {
    container.innerHTML = '<div class="card"><div class="meta" style="text-align:center;padding:20px 0">No known dark sites nearby</div></div>';
    return;
  }

  container.innerHTML = sites.map(s => {
    const statusClass = s.yearCert ? 'official' : 'good';
    const statusLabel = s.yearCert ? 'Official' : 'Suggested';
    return `
      <div class="card clickable" data-site-lat="${s.lat}" data-site-lon="${s.lon}">
        <div class="row">
          <div>
            <div class="place">${s.name}</div>
            <div class="meta">${s.distKm} km · Bortle ~${s.bortle}</div>
          </div>
          <div class="score ${scoreClass(s.bortle)}">${Math.max(10, 100 - s.bortle * 10)}</div>
        </div>
        <div class="badges">
          <span class="badge ${statusClass}">${statusLabel}</span>
          <span class="badge">${s.type}</span>
        </div>
      </div>`;
  }).join('');
}

function scoreClass(bortle: number): string {
  if (bortle <= 2) return 'great';
  if (bortle <= 4) return 'ok';
  if (bortle <= 6) return 'meh';
  return 'bad';
}

function typeToBadge(type: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    planet: { cls: 'warn', label: 'Planet' },
    moon: { cls: '', label: 'Moon' },
    star: { cls: 'good', label: 'Star' },
    deepSky: { cls: 'official', label: 'Deep Sky' },
    milkyway: { cls: 'good', label: 'Milky Way' },
    meteor: { cls: 'warn', label: 'Meteor' },
  };
  return map[type] || { cls: '', label: type };
}

function highlightDirectionForObject(q: string) {
  // Find which direction the searched object is in
  for (const sky of directionSkies) {
    if (sky.objects.some(o => o.name.toLowerCase().includes(q))) {
      activeDirection = sky.name;
      renderCompass();
      renderDirectionDetail();
      return;
    }
  }
  (window as any).toast?.('Object not found in current view');
}

function updateDateBar() {
  const dateBtn = document.getElementById('sitesDateBtn');
  const equipBtn = document.getElementById('sitesEquipBtn');
  if (dateBtn) dateBtn.querySelector('strong')!.textContent = `${formatDateShort()} · ${ctx.startTime}`;
  if (equipBtn) equipBtn.querySelector('strong')!.textContent = equipmentSummary();
}
