// ===== 地点详情页 =====
// "这个暗夜地点怎么样、今晚条件如何、能看什么"
import { ctx, onContextChange, formatDateShort } from '../lib/context';
import { celestialCatalog } from '../lib/catalog';
import { computePosition, computeMoonPhase, computeSunInfo } from '../lib/astronomy';
import { fetchHourlyWeather, computeHourlyScore, findBestWindow } from '../lib/weather';
import { DARK_SKY_PLACES } from '../lib/dark-sky-places';

// ===== Render =====
export function renderPlaceDetailPage(siteId: string): string {
  // Find site by name or coordinates
  const site = DARK_SKY_PLACES.find(p => p.name === siteId || p.nameEn === siteId);
  if (!site) return '<div class="card"><div class="meta" style="text-align:center;padding:40px 0">Place not found</div></div>';

  const loc = { lat: site.lat, lon: site.lon };
  const [hh, mm] = ctx.startTime.split(':').map(Number);
  const obsDate = new Date(ctx.date);
  obsDate.setHours(hh || 22, mm || 0, 0, 0);

  // Compute all visible objects at this site
  const positions = celestialCatalog
    .map(obj => ({ obj, pos: computePosition(obj, loc, obsDate) }))
    .filter(({ pos }) => pos.visible && pos.altitude > 0)
    .sort((a, b) => b.pos.altitude - a.pos.altitude);

  // Moon info
  const moonInfo = computeMoonPhase(obsDate, loc);

  // Score
  const score = Math.max(10, 100 - site.bortle * 10);
  const scoreCls = score >= 70 ? 'great' : score >= 40 ? 'ok' : 'meh';
  const scoreLabel = score >= 70 ? 'Excellent' : score >= 40 ? 'Good' : score >= 20 ? 'Fair' : 'Poor';

  // Status badge
  const statusCls = site.yearCert ? 'official' : 'good';
  const statusLabel = site.yearCert ? 'Official certified' : 'Community suggested';

  // Moon conflict
  const moonImpact = moonInfo.altitude > 0 && moonInfo.illumination > 0.5
    ? `Moon up until ${moonInfo.setTime || '—'} (${moonInfo.phaseName})`
    : 'No moon interference tonight';

  // Distance from current location
  const distKm = Math.round(Math.sqrt((site.lat - ctx.location.lat) ** 2 + (site.lon - ctx.location.lon) ** 2) * 111);

  // Equipment suitable at this site
  const siteEquipSuitable = site.bortle <= 3
    ? 'Naked eye, binoculars, camera'
    : 'Binoculars, telescope recommended';

  return `
    <div class="page-top">
      <button class="back-btn" id="placeDetailBack">‹</button>
      <div class="page-sub">Dark Site</div>
      <button class="icon-btn" id="placeDetailSave">♡</button>
    </div>

    <div class="hero-card">
      <span class="badge ${statusCls}">${statusLabel}</span>
      <h1 style="font-size:28px;margin:10px 0 0">${site.name}</h1>
      <div style="display:flex;align-items:end;gap:8px;margin:10px 0">
        <strong style="font-size:48px;letter-spacing:-2px;color:var(--${scoreCls === 'great' ? 'good' : scoreCls === 'ok' ? 'blue' : scoreCls === 'meh' ? 'warn' : 'bad'})">${score}</strong>
        <span style="padding-bottom:8px;font-size:13px;color:var(--good)">${scoreLabel}</span>
      </div>
      <div class="meta">${distKm} km · Bortle ${site.bortle} · ${site.type}${site.yearCert ? ` · Certified ${site.yearCert}` : ''}${site.altitudeM ? ` · ${site.altitudeM}m elevation` : ''}</div>
      ${site.description ? `<div class="meta" style="margin-top:4px">${site.description}</div>` : ''}
    </div>

    <div class="date-bar">
      <button class="date-btn" id="placeDetailDateBtn">
        <strong>${formatDateShort()} · ${ctx.startTime}</strong>
        <span>Forecast & sky for selected time</span>
      </button>
      <button class="date-btn" id="placeDetailEquipBtn">
        <strong>Good for: ${siteEquipSuitable}</strong>
        <span>Equipment suitability</span>
      </button>
    </div>

    <!-- Tonight conditions -->
    <div class="section"><h3>Tonight</h3><span class="page-sub">Date-sensitive</span></div>
    <div class="grid-2">
      <div class="fact">
        <div class="label">Light pollution</div>
        <div class="value">Bortle ~${site.bortle}</div>
      </div>
      <div class="fact">
        <div class="label">Moon impact</div>
        <div class="value" style="${moonInfo.altitude > 0 && moonInfo.illumination > 0.5 ? 'color:var(--warn)' : 'color:var(--good)'};font-size:12px">${moonImpact}</div>
      </div>
      <div class="fact">
        <div class="label">Moon phase</div>
        <div class="value">${moonInfo.phaseName} (${Math.round(moonInfo.illumination * 100)}%)</div>
      </div>
      <div class="fact">
        <div class="label">Elevation</div>
        <div class="value">${site.altitudeM ? `${site.altitudeM}m` : '—'}</div>
      </div>
    </div>

    <!-- Best viewing window (placeholder — would need weather data) -->
    <div class="timeline">
      <div class="row">
        <strong>Best viewing window</strong>
        <span class="page-sub" id="placeBestWindow">Calculating...</span>
      </div>
      <div class="bar"></div>
      <div class="meta">Changes when date/time or target changes.</div>
    </div>

    <!-- Best objects here -->
    <div class="section"><h3>Best objects here</h3><span class="page-sub">For selected date</span></div>
    ${positions.slice(0, 5).map(({ obj, pos }) => {
      const typeBadge = typeToInfo(obj.type);
      return `
        <div class="card clickable" data-object-id="${obj.id}">
          <div class="row">
            <div>
              <div class="place">${obj.name}</div>
              <div class="meta">Best ${pos.bestTime} · ${pos.directionText} · Alt ${pos.altitude.toFixed(0)}°</div>
            </div>
            <span class="badge ${typeBadge.cls}">${typeBadge.label}</span>
          </div>
          ${obj.equipment ? `<div class="badges">${obj.equipment.map(e => `<span class="badge">${e}</span>`).join('')}</div>` : ''}
        </div>`;
    }).join('')}

    <!-- Facilities -->
    <div class="section"><h3>Facilities & field reports</h3><span class="page-sub">Community maintained</span></div>
    <div class="grid-2">
      <div class="fact">
        <div class="label">Parking</div>
        <div class="value">${site.bortle <= 2 ? 'Available' : 'Check locally'}</div>
      </div>
      <div class="fact">
        <div class="label">Night access</div>
        <div class="value">${site.type === 'Park' || site.type === 'Reserve' ? 'Open' : 'Verify hours'}</div>
      </div>
      <div class="fact">
        <div class="label">Local lights</div>
        <div class="value">${site.bortle <= 2 ? 'Minimal' : site.bortle <= 4 ? 'Minor' : 'Moderate'}</div>
      </div>
      <div class="fact">
        <div class="label">Contribute</div>
        <div class="value" style="color:var(--blue)">Report conditions</div>
      </div>
    </div>
  `;
}

export function initPlaceDetailPage(): void {
  document.getElementById('placeDetailBack')?.addEventListener('click', () => {
    (window as any).navigateBack?.();
  });

  document.getElementById('placeDetailDateBtn')?.addEventListener('click', () => {
    (window as any).openModal?.('dateModal');
  });

  document.getElementById('placeDetailEquipBtn')?.addEventListener('click', () => {
    (window as any).openModal?.('equipmentModal');
  });

  document.getElementById('placeDetailSave')?.addEventListener('click', () => {
    (window as any).toast?.('Saved to favorites');
  });

  // Object card click → navigate to object detail
  document.querySelectorAll('[data-object-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.objectId;
      if (id) (window as any).navigateTo?.('object-detail', id);
    });
  });

  // Fetch weather for best window
  const siteName = document.querySelector('.hero-card h1')?.textContent;
  if (siteName) {
    const site = DARK_SKY_PLACES.find(p => p.name === siteName);
    if (site) {
      fetchHourlyWeather({ lat: site.lat, lon: site.lon }).then(weatherData => {
        if (!weatherData) return;
        const obsDate = new Date(ctx.date);
        const [hh, mm] = ctx.startTime.split(':').map(Number);
        obsDate.setHours(hh || 22, mm || 0, 0, 0);
        const moonInfo = computeMoonPhase(obsDate, { lat: site.lat, lon: site.lon });
        const sunInfo = computeSunInfo(obsDate, { lat: site.lat, lon: site.lon });
        const hourlyScores = weatherData.filter((_: any, i: number) => i % 2 === 0).map((h: any) => {
          const r = computeHourlyScore({
            cloudCover: h.cloudCover, moonAltitude: moonInfo.altitude,
            moonIllumination: moonInfo.illumination, sunAltitude: sunInfo.altitude,
            windSpeed: h.windSpeed, bortle: site.bortle, visibility: h.visibility
          });
          return { time: new Date(h.time), score: r.score };
        });
        const window = findBestWindow(hourlyScores);
        const el = document.getElementById('placeBestWindow');
        if (el && window) el.textContent = `${window.start}–${window.end}`;
      }).catch(() => {});
    }
  }
}

// ===== Helpers =====
function typeToInfo(type: string): { cls: string; label: string } {
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
