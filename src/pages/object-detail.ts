// ===== 天体详情页 =====
// "我想看这个天体，怎么看、去哪里看"
import type { CelestialObject, CelestialPosition } from '../types';
import { ctx, onContextChange, formatDateShort } from '../lib/context';
import { celestialCatalog } from '../lib/catalog';
import { computePosition, computeMoonPhase } from '../lib/astronomy';
import { DARK_SKY_PLACES } from '../lib/dark-sky-places';

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

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ===== Render =====
export function renderObjectDetailPage(objectId: string): string {
  const obj = celestialCatalog.find(o => o.id === objectId);
  if (!obj) return '<div class="card"><div class="meta" style="text-align:center;padding:40px 0">Object not found</div></div>';

  const loc = { lat: ctx.location.lat, lon: ctx.location.lon };
  const [hh, mm] = ctx.startTime.split(':').map(Number);
  const obsDate = new Date(ctx.date);
  obsDate.setHours(hh || 22, mm || 0, 0, 0);

  const pos = computePosition(obj, loc, obsDate);
  const moonInfo = computeMoonPhase(obsDate, loc);
  const seasonData = SEASON_DATA[obj.id] || Array(12).fill(2);
  const currentMonth = new Date().getMonth();

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
    seasonText = start === end ? `Best in ${start}` : `Best from ${start} to ${end}`;
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

  // Moon conflict
  const moonConflict = moonInfo.altitude > 0 && moonInfo.illumination > 0.5
    ? `Moon in sky (${moonInfo.phaseName}, ${Math.round(moonInfo.illumination * 100)}%)`
    : 'No moon interference';

  // Visibility score
  const visible = pos.visible && pos.altitude > 0;
  const visScore = visible ? Math.round(Math.min(100, pos.altitude * 1.2 + (obj.magnitude < 0 ? 40 : obj.magnitude < 2 ? 25 : 10))) : 0;
  const scoreCls = visScore >= 70 ? 'great' : visScore >= 40 ? 'ok' : visScore >= 20 ? 'meh' : 'bad';
  const visLabel = visScore >= 70 ? 'Excellent' : visScore >= 40 ? 'Good' : visScore >= 20 ? 'Fair' : 'Poor';

  return `
    <div class="page-top">
      <button class="back-btn" id="objDetailBack">‹</button>
      <div class="page-sub">${obj.constellation !== '—' ? obj.constellation : 'Object'}</div>
      <button class="icon-btn" id="objDetailSave">♡</button>
    </div>

    <div class="hero-card">
      <div class="page-sub">Seasonal visibility</div>
      <h1 style="font-size:28px;margin:5px 0">${obj.name}</h1>
      <div class="meta">${obj.description || ''}</div>
      <div class="badges" style="margin-top:8px">
        ${(obj.equipment || []).map(e => `<span class="badge">${e}</span>`).join('')}
      </div>
    </div>

    <div class="date-bar">
      <button class="date-btn" id="objDetailDateBtn">
        <strong>${formatDateShort()} · ${ctx.startTime}</strong>
        <span>Change observing date</span>
      </button>
      <button class="date-btn" id="objDetailEquipBtn">
        <strong>Matched to your gear</strong>
        <span>Equipment suitability</span>
      </button>
    </div>

    <!-- Season -->
    <div class="section"><h3>Best season</h3><span class="page-sub">Relative visibility</span></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between"><span class="meta">Jan</span><span class="meta">Dec</span></div>
      <div class="season">${seasonChart}</div>
      <div class="meta" style="margin-top:8px">${seasonText ? seasonText + ' · ' : ''}For this latitude, ${obj.name} ${seasonData[currentMonth] >= 3 ? 'is well placed tonight.' : 'may be low tonight — try a different month.'}</div>
    </div>

    <!-- Visibility tonight -->
    <div class="section"><h3>Visibility tonight</h3><span class="page-sub">Time-sensitive</span></div>
    <div class="grid-2">
      <div class="fact">
        <div class="label">Direction</div>
        <div class="value">${visible ? pos.directionText : '—'}</div>
      </div>
      <div class="fact">
        <div class="label">Altitude</div>
        <div class="value">${visible ? `${pos.altitude.toFixed(0)}°` : 'Below horizon'}</div>
      </div>
      <div class="fact">
        <div class="label">Best time</div>
        <div class="value">${pos.bestTime}</div>
      </div>
      <div class="fact">
        <div class="label">Moon conflict</div>
        <div class="value" style="${moonInfo.altitude > 0 && moonInfo.illumination > 0.5 ? 'color:var(--warn)' : 'color:var(--good)'}">${moonConflict}</div>
      </div>
    </div>

    ${visible ? `
    <div style="margin:12px 0;text-align:center">
      <div class="score ${scoreCls}" style="width:64px;height:64px;font-size:28px;border-radius:20px;margin:0 auto">${visScore}</div>
      <div style="margin-top:6px;font-size:13px;color:var(--muted)">${visLabel} visibility</div>
    </div>` : `
    <div class="card"><div class="meta" style="text-align:center;padding:12px 0;color:var(--warn)">
      ${obj.name} is below the horizon at ${ctx.startTime}. Try changing the time or date.
    </div></div>`}

    <!-- Equipment -->
    <div class="section"><h3>Suitable equipment</h3><span class="page-sub">Recommended</span></div>
    <div class="card">
      ${equipRecs.map((eq, i) => {
        const badgeCls = eq.level === 'great' ? 'good' : eq.level === 'recommended' ? 'good' : '';
        const badgeLabel = eq.level === 'great' ? 'Great' : eq.level === 'recommended' ? 'Recommended' : 'Optional';
        return `<div class="list-line${i < equipRecs.length - 1 ? '' : ''}" style="padding:11px 0;${i < equipRecs.length - 1 ? 'border-bottom:1px solid rgba(92,110,140,.22)' : ''}">
          <div class="row">
            <div><strong>${eq.name}</strong><div class="meta">${eq.detail}</div></div>
            <span class="badge ${badgeCls}">${badgeLabel}</span>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- Best places -->
    <div class="section"><h3>Best places nearby</h3><span class="page-sub">For selected date</span></div>
    ${recSites.length > 0 ? recSites.map(s => `
      <div class="card clickable" data-place-lat="${s.lat}" data-place-lon="${s.lon}" data-place-name="${s.name}">
        <div class="row">
          <div>
            <div class="place">${s.name}</div>
            <div class="meta">${s.distKm} km · Bortle ${s.bortle} · ${s.type}${s.yearCert ? ' · Certified' : ''}</div>
          </div>
          <div class="score ${s.bortle <= 2 ? 'great' : s.bortle <= 4 ? 'ok' : 'meh'}" style="width:40px;height:40px;font-size:16px">${Math.max(10, 100 - s.bortle * 10)}</div>
        </div>
      </div>
    `).join('') : '<div class="card"><div class="meta" style="text-align:center;padding:12px 0">No dark sites nearby matching this object\'s requirements</div></div>'}
  `;
}

export function initObjectDetailPage(): void {
  document.getElementById('objDetailBack')?.addEventListener('click', () => {
    (window as any).navigateBack?.();
  });

  document.getElementById('objDetailDateBtn')?.addEventListener('click', () => {
    (window as any).openModal?.('dateModal');
  });

  document.getElementById('objDetailEquipBtn')?.addEventListener('click', () => {
    (window as any).openModal?.('equipmentModal');
  });

  document.getElementById('objDetailSave')?.addEventListener('click', () => {
    (window as any).toast?.('Saved to favorites');
  });
}
