// ===== 地点详情页 =====
// "这个暗夜地点怎么样、今晚条件如何、能看什么"
import { ctx, onContextChange, formatDateShort } from '../lib/context';
import { celestialCatalog } from '../lib/catalog';
import { computePosition, computeMoonPhase, computeSunInfo } from '../lib/astronomy';
import { fetchHourlyWeather, computeHourlyScore, findBestWindow } from '../lib/weather';
import { DARK_SKY_PLACES } from '../lib/dark-sky-places';
import { t, tCat } from '../lib/i18n';

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

  // Moon info
  const moonInfo = computeMoonPhase(obsDate, loc);

  // Score
  const score = Math.max(10, 100 - site.bortle * 10);
  const scoreCls = score >= 70 ? 'great' : score >= 40 ? 'ok' : 'meh';
  const scoreLabel = score >= 70 ? t('vis.excellent') : score >= 40 ? t('vis.good') : score >= 20 ? t('vis.fair') : t('vis.poor');

  // Status badge
  const statusCls = site.yearCert ? 'official' : 'good';
  const statusLabel = site.yearCert ? t('status.official') : t('status.suggested');

  // Moon conflict
  const moonImpact = moonInfo.altitude > 0 && moonInfo.illumination > 0.5
    ? (ctx.language === 'zh' ? `月光至 ${moonInfo.setTime || '—'} (${moonInfo.phaseName})` : `Moon up until ${moonInfo.setTime || '—'} (${moonInfo.phaseName})`)
    : t('placeDetail.noMoonInterf');

  // Distance from current location
  const distKm = Math.round(Math.sqrt((site.lat - ctx.location.lat) ** 2 + (site.lon - ctx.location.lon) ** 2) * 111);

  // Equipment suitable at this site
  const siteEquipSuitable = site.bortle <= 3
    ? (ctx.language === 'zh' ? '肉眼、双筒镜、相机' : 'Naked eye, binoculars, camera')
    : (ctx.language === 'zh' ? '推荐双筒镜、望远镜' : 'Binoculars, telescope recommended');

  return `
    <div class="page-top">
      <button class="back-btn" id="placeDetailBack">‹</button>
      <div class="page-sub">${t('placeDetail.darkSite')}</div>
      <button class="icon-btn" id="placeDetailSave">♡</button>
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
      <button class="date-btn" id="placeDetailEquipBtn">
        <strong>${t('placeDetail.equipSuit')}: ${siteEquipSuitable}</strong>
        <span>${t('placeDetail.equipSuitLabel')}</span>
      </button>
    </div>

    <!-- Tonight conditions -->
    <div class="section"><h3>${t('placeDetail.tonight')}</h3><span class="page-sub">${t('placeDetail.dateSensitive')}</span></div>
    <div class="grid-2">
      <div class="fact">
        <div class="label">${t('placeDetail.lightPoll')}</div>
        <div class="value">Bortle ~${site.bortle}</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.moonImpact')}</div>
        <div class="value" style="${moonInfo.altitude > 0 && moonInfo.illumination > 0.5 ? 'color:var(--warn)' : 'color:var(--good)'};font-size:12px">${moonImpact}</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.moonPhase')}</div>
        <div class="value">${moonInfo.phaseName} (${Math.round(moonInfo.illumination * 100)}%)</div>
      </div>
      <div class="fact">
        <div class="label">${t('placeDetail.elevation')}</div>
        <div class="value">${site.altitudeM ? `${site.altitudeM}m` : '—'}</div>
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
      return `
        <div class="card clickable" data-object-id="${obj.id}">
          <div class="row">
            <div>
              <div class="place">${tCat(obj.id, 'name') || obj.name}</div>
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

  document.getElementById('placeDetailEquipBtn')?.addEventListener('click', () => {
    (window as any).openModal?.('equipmentModal');
  });

  document.getElementById('placeDetailSave')?.addEventListener('click', () => {
    (window as any).toast?.(t('general.saved'));
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
    planet:  { cls: 'warn', label: t('type.planet') },
    star:    { cls: 'good', label: t('type.star') },
    deepSky: { cls: 'official', label: t('type.deepSky') },
    moon:    { cls: '', label: t('type.moon') },
    milkyway:{ cls: 'good', label: t('type.milkyway') },
    meteor:  { cls: 'warn', label: t('type.meteor') },
  };
  return map[type] || { cls: '', label: type };
}
