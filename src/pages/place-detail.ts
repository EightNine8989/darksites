// ===== 地点详情页 =====
// "这个暗夜地点怎么样、天气条件如何、能看什么"
import { ctx, onContextChange, formatDateShort } from '../lib/context';
import { celestialCatalog } from '../lib/catalog';
import { computePosition, computeMoonPhase, computeSunInfo } from '../lib/astronomy';
import { fetchHourlyWeather, computeHourlyScore, findBestWindow } from '../lib/weather';
import { DARK_SKY_PLACES } from '../lib/dark-sky-places';
import { t, tCat } from '../lib/i18n';

// ===== Favorites Persistence (dark sites) =====
const PLACE_FAV_KEY = 'ds_favorite_places';
function loadPlaceFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(PLACE_FAV_KEY) || '[]'); } catch { return []; }
}
function savePlaceFavorites(names: string[]) {
  localStorage.setItem(PLACE_FAV_KEY, JSON.stringify(names));
}
function isPlaceFavorite(name: string): boolean {
  return loadPlaceFavorites().includes(name);
}

// ===== Weather tab state =====
let weatherNight: 'tonight' | 'tomorrow' = 'tonight';

// ===== Context listener (unregistered on re-init to avoid duplicates) =====
let unsubContext: (() => void) | null = null;

// ===== Render =====
export function renderPlaceDetailPage(siteId: string): string {
  // Find site by name or coordinates
  const site = DARK_SKY_PLACES.find(p => p.name === siteId || p.nameEn === siteId);
  if (!site) return '<div class="card"><div class="meta" style="text-align:center;padding:40px 0">' + (ctx.language === 'zh' ? '地点未找到' : 'Place not found') + '</div></div>';

  const loc = { lat: site.lat, lon: site.lon };
  const [hh, mm] = ctx.startTime.split(':').map(Number);
  const obsDate = new Date(ctx.date);
  obsDate.setHours(hh || 22, mm || 0, 0, 0);

  // Compute all visible objects at this site
  const positions = celestialCatalog
    .map(obj => ({ obj, pos: computePosition(obj, loc, obsDate) }))
    .filter(({ pos }) => pos.visible && pos.altitude > 0)
    .sort((a, b) => b.pos.altitude - a.pos.altitude);

  // Score
  const score = Math.max(10, 100 - site.bortle * 10);
  const scoreCls = score >= 70 ? 'great' : score >= 40 ? 'ok' : 'meh';
  const scoreLabel = score >= 70 ? t('vis.excellent') : score >= 40 ? t('vis.good') : score >= 20 ? t('vis.fair') : t('vis.poor');

  // Status badge
  const statusCls = site.yearCert ? 'official' : 'good';
  const statusLabel = site.yearCert ? t('status.official') : t('status.suggested');

  // Distance from current location
  const distKm = Math.round(Math.sqrt((site.lat - ctx.location.lat) ** 2 + (site.lon - ctx.location.lon) ** 2) * 111);

  // Favorite state
  const favState = isPlaceFavorite(site.name);

  return `
    <div class="page-top">
      <button class="back-btn" id="placeDetailBack">‹</button>
      <div class="page-sub">${t('placeDetail.darkSite')}</div>
      <button class="icon-btn" id="placeDetailSave" style="${favState ? 'color:#ff4d6d;border-color:#ff4d6d55' : ''}">${favState ? '♥' : '♡'}</button>
    </div>

    <div class="hero-card">
      <span class="badge ${statusCls}">${statusLabel}</span>
      <h1 style="font-size:28px;margin:10px 0 0">${site.name}</h1>
      <div style="display:flex;align-items:end;gap:8px;margin:10px 0">
        <strong style="font-size:48px;letter-spacing:-2px;color:var(--${scoreCls === 'great' ? 'good' : scoreCls === 'ok' ? 'blue' : scoreCls === 'meh' ? 'warn' : 'bad'})">${score}</strong>
        <span style="padding-bottom:8px;font-size:13px;color:var(--good)">${scoreLabel}</span>
      </div>
      <div class="meta">${distKm} km · Bortle ${site.bortle} · ${site.type}${site.yearCert ? ` · ${t('status.official')} ${site.yearCert}` : ''}${site.altitudeM ? ` · ${site.altitudeM}m ${ctx.language === 'zh' ? '海拔' : 'elevation'}` : ''}</div>
      ${site.description ? `<div class="meta" style="margin-top:4px">${site.description}</div>` : ''}
    </div>

    <div class="date-bar">
      <button class="date-btn" id="placeDetailDateBtn">
        <strong>${formatDateShort()} · ${ctx.startTime}</strong>
        <span>${t('placeDetail.forecast')}</span>
      </button>
    </div>

    <!-- Weather conditions (6 metrics) with tonight/tomorrow toggle -->
    <div class="segment" id="placeNightSeg" style="margin:12px 0 0">
      <button class="seg active" data-night="tonight">${t('placeDetail.tonight')}</button>
      <button class="seg" data-night="tomorrow">${t('placeDetail.tomorrow')}</button>
    </div>
    <div class="grid-2" id="placeWeatherGrid">
      <div class="fact">
        <div class="label">${t('placeDetail.temp')}</div>
        <div class="value" id="placeTemp">—</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.humidity')}</div>
        <div class="value" id="placeHumidity">—</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.wind')}</div>
        <div class="value" id="placeWind">—</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.visibility')}</div>
        <div class="value" id="placeVisibility">—</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.clouds')}</div>
        <div class="value" id="placeClouds">—</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.moonLight')}</div>
        <div class="value" id="placeMoonLight">—</div>
      </div>
    </div>

    <!-- Best viewing window (placeholder — would need weather data) -->
    <div class="timeline">
      <div class="row">
        <strong>${t('placeDetail.bestWindow')}</strong>
        <span class="page-sub" id="placeBestWindow">${ctx.language === 'zh' ? '计算中...' : 'Calculating...'}</span>
      </div>
      <div class="bar"></div>
      <div class="meta">${ctx.language === 'zh' ? '日期/时间或目标变化时更新' : 'Changes when date/time or target changes.'}</div>
    </div>

    <!-- Best objects here -->
    <div class="section"><h3>${t('placeDetail.bestObj')}</h3><span class="page-sub">${t('objDetail.forDate')}</span></div>
    ${positions.slice(0, 5).map(({ obj, pos }) => {
      const typeBadge = typeToInfo(obj.type);
      const constLabel = obj.constellation && obj.constellation !== '—'
        ? (ctx.language === 'zh' ? `（${obj.constellation}）` : ` (${obj.constellation})`)
        : '';
      return `
        <div class="card clickable" data-object-id="${obj.id}">
          <div class="row">
            <div>
              <div class="place">${tCat(obj.id, 'name') || obj.name}<span class="const-sub">${constLabel}</span></div>
              <div class="meta">${ctx.language === 'zh' ? '最佳' : 'Best'} ${pos.bestTime} · ${pos.directionText} · ${ctx.language === 'zh' ? '高度' : 'Alt'} ${pos.altitude.toFixed(0)}°</div>
            </div>
            <span class="badge ${typeBadge.cls}">${typeBadge.label}</span>
          </div>
          ${obj.equipment ? `<div class="badges">${obj.equipment.map(e => `<span class="badge">${e}</span>`).join('')}</div>` : ''}
        </div>`;
    }).join('')}

    <!-- Facilities -->
    <div class="section"><h3>${t('placeDetail.facilities')}</h3><span class="page-sub">${t('placeDetail.community')}</span></div>
    <div class="grid-2">
      <div class="fact">
        <div class="label">${t('placeDetail.parking')}</div>
        <div class="value">${site.bortle <= 2 ? (ctx.language === 'zh' ? '有' : 'Available') : (ctx.language === 'zh' ? '需确认' : 'Check locally')}</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.nightAccess')}</div>
        <div class="value">${site.type === 'Park' || site.type === 'Reserve' ? (ctx.language === 'zh' ? '开放' : 'Open') : (ctx.language === 'zh' ? '确认时间' : 'Verify hours')}</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.localLights')}</div>
        <div class="value">${site.bortle <= 2 ? (ctx.language === 'zh' ? '极少' : 'Minimal') : site.bortle <= 4 ? (ctx.language === 'zh' ? '轻微' : 'Minor') : (ctx.language === 'zh' ? '中等' : 'Moderate')}</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.contribute')}</div>
        <div class="value" style="color:var(--blue);cursor:pointer" id="placeContributeBtn">${ctx.language === 'zh' ? '报告状况' : 'Report conditions'}</div>
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

  // Favorite toggle (dark site)
  document.getElementById('placeDetailSave')?.addEventListener('click', () => {
    const btn = document.getElementById('placeDetailSave');
    if (!btn) return;
    const siteName = document.querySelector('.hero-card h1')?.textContent;
    if (!siteName) return;

    const favs = loadPlaceFavorites();
    const idx = favs.indexOf(siteName);
    if (idx >= 0) {
      favs.splice(idx, 1);
      btn.textContent = '♡';
      btn.style.color = '';
      btn.style.borderColor = '';
      (window as any).toast?.(ctx.language === 'zh' ? '已取消收藏' : 'Removed from favorites');
    } else {
      favs.push(siteName);
      btn.textContent = '♥';
      btn.style.color = '#ff4d6d';
      btn.style.borderColor = '#ff4d6d55';
      (window as any).toast?.(ctx.language === 'zh' ? '已收藏' : 'Added to favorites');
    }
    savePlaceFavorites(favs);
  });

  // Tonight / Tomorrow weather toggle
  document.getElementById('placeNightSeg')?.addEventListener('click', (e) => {
    const seg = (e.target as HTMLElement).closest('.seg') as HTMLElement;
    if (!seg) return;
    weatherNight = (seg.dataset.night as 'tonight' | 'tomorrow') || 'tonight';
    document.querySelectorAll('#placeNightSeg .seg').forEach(s => s.classList.remove('active'));
    seg.classList.add('active');
    loadWeather();
  });

  // Contribute button → open contribution modal
  document.getElementById('placeContributeBtn')?.addEventListener('click', () => {
    const siteName = document.querySelector('.hero-card h1')?.textContent;
    if (siteName) (window as any).openContributionModal?.(siteName);
  });

  // Object card click → navigate to object detail
  document.querySelectorAll('[data-object-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.objectId;
      if (id) (window as any).navigateTo?.('object-detail', id);
    });
  });

  // Fetch weather for best window + condition cards
  loadWeather();

  // Context change (date/time) → re-render the whole page
  // Unregister previous listener first (context.ts uses a Set — listeners accumulate on re-init)
  if (unsubContext) unsubContext();
  unsubContext = onContextChange(() => {
    const route = ((window as any).getCurrentRoute?.()) as { type: string; id?: string } | undefined;
    const siteId = route?.type === 'place-detail' ? route.id : undefined;
    if (!siteId) return;
    const container = document.getElementById('pageContainer');
    if (!container) return;
    container.innerHTML = renderPlaceDetailPage(siteId);
    initPlaceDetailPage();
  });
}

// ===== Weather =====
function loadWeather() {
  const siteName = document.querySelector('.hero-card h1')?.textContent;
  if (!siteName) return;
  const site = DARK_SKY_PLACES.find(p => p.name === siteName);
  if (!site) return;

  const isZh = (ctx.language || 'zh') === 'zh';

  fetchHourlyWeather({ lat: site.lat, lon: site.lon }).then(weatherData => {
    if (!weatherData) return;

    const [hh, mm] = ctx.startTime.split(':').map(Number);
    // Base date for "tonight"; tomorrow = +1 day
    const baseDate = new Date(ctx.date);
    baseDate.setHours(hh || 22, mm || 0, 0, 0);
    const targetDate = new Date(baseDate.getTime());
    if (weatherNight === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);

    const loc = { lat: site.lat, lon: site.lon };
    const moonInfo = computeMoonPhase(targetDate, loc);
    const sunInfo = computeSunInfo(targetDate, loc);

    // Fill weather condition cards — pick hour closest to observation start time
    const targetHour = targetDate.getTime();
    let bestIdx = 0;
    let bestDiff = Infinity;
    weatherData.forEach((h: any, i: number) => {
      const diff = Math.abs(new Date(h.time).getTime() - targetHour);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    });
    const hw = weatherData[bestIdx];
    if (hw) {
      const setVal = (id: string, v: string) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      setVal('placeTemp', `${Math.round(hw.temperature)}°C`);
      setVal('placeHumidity', `${Math.round(hw.humidity)}%`);
      const windLabel = hw.windSpeed > 15 ? (isZh ? '大风' : 'Windy')
        : hw.windSpeed > 10 ? (isZh ? '有风' : 'Breezy')
        : (isZh ? '微风' : 'Calm');
      setVal('placeWind', `${Math.round(hw.windSpeed)} km/h · ${windLabel}`);
      const visLabel = hw.visibility < 5 ? (isZh ? '较差' : 'Poor')
        : hw.visibility < 10 ? (isZh ? '一般' : 'Fair')
        : (isZh ? '良好' : 'Good');
      setVal('placeVisibility', `${hw.visibility} km · ${visLabel}`);
      const cloudLabel = hw.cloudCover > 60 ? (isZh ? '多云' : 'Cloudy')
        : hw.cloudCover > 30 ? (isZh ? '部分多云' : 'Partly cloudy')
        : (isZh ? '晴朗' : 'Clear');
      setVal('placeClouds', `${hw.cloudCover}% · ${cloudLabel}`);
      const moonPct = Math.round(moonInfo.illumination * 100);
      setVal('placeMoonLight', `${moonPct}%`);
    }

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

// ===== Helpers =====
function typeToInfo(type: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    planet:  { cls: 'warn', label: t('type.planet') },
    star:    { cls: 'good', label: t('type.star') },
    deepSky: { cls: 'official', label: t('type.deepSky') },
    moon:    { cls: '', label: t('type.moon') },
    milkyway:{ cls: 'good', label: t('type.milkyway') },
    meteor:  { cls: 'warn', label: t('type.meteor') },
  };
  return map[type] || { cls: '', label: type };
}