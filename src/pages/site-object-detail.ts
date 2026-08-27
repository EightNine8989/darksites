// ===== Site × Object 详情子页面 =====
// "在这个地点看这个天体，条件怎么样"
// 数据来源：后端 GET /observe/site/{site_id}/object/{obj_id}
import { fetchSiteObjectDetail, type BackendSiteObjectDetail } from '../lib/api';
import { ctx } from '../lib/context';

// ===== Render =====
export function renderSiteObjectDetailPage(siteId: string, objId: string): string {
  const isZh = (ctx.language || 'zh') === 'zh';

  return `
    <div class="page-top">
      <button class="back-btn" id="siteObjBack">‹</button>
      <div class="page-sub">${isZh ? '观测详情' : 'Observation detail'}</div>
    </div>

    <div id="siteObjContent">
      <div class="card">
        <div class="meta" style="text-align:center;padding:30px 0">${isZh ? '加载观测数据...' : 'Loading observation data...'}</div>
      </div>
    </div>
  `;
}

export function initSiteObjectDetailPage(): void {
  document.getElementById('siteObjBack')?.addEventListener('click', () => {
    (window as any).navigateBack?.();
  });

  loadData();
}

// ===== Async load =====
function loadData(): void {
  const route = ((window as any).getCurrentRoute?.()) as { type: string; siteId?: string; objId?: string } | undefined;
  if (route?.type !== 'site-object-detail' || !route.siteId || !route.objId) return;

  const isZh = (ctx.language || 'zh') === 'zh';
  const container = document.getElementById('siteObjContent');
  if (!container) return;

  fetchSiteObjectDetail(route.siteId, route.objId).then(detail => {
    if (!detail) {
      container.innerHTML = `
        <div class="card">
          <div class="meta" style="text-align:center;padding:30px 0">
            ${isZh ? '无法获取观测数据，请检查后端服务' : 'Failed to load observation data'}
          </div>
        </div>`;
      return;
    }
    container.innerHTML = renderDetail(detail, isZh);
    bindEvents();
  });
}

// ===== Render full detail =====
function renderDetail(d: BackendSiteObjectDetail, isZh: boolean): string {
  const pos = d.position;
  const obs = d.observability;
  const sky = d.sky_context;
  const w = d.weather;

  // -- Score circle (0-100) --
  const score = Math.round(Math.max(0, Math.min(100, obs.score)));
  const scoreCls = score >= 70 ? 'great' : score >= 40 ? 'ok' : 'meh';

  // -- Position info --
  const altText = `${pos.altitude_deg.toFixed(1)}°`;
  const azText = `${pos.azimuth_deg.toFixed(1)}°`;
  const dirText = azimuthToDirection(pos.azimuth_deg, isZh);
  const isVisible = pos.is_visible;

  // Rise / transit / set times
  const fmtTime = (t?: string | null) => {
    if (!t) return '—';
    const dt = new Date(t);
    return isZh
      ? `${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`
      : `${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;
  };

  // -- Weather --
  const cloudPct = w.cloud_cover_pct;
  const cloudLabel = cloudPct == null ? '—'
    : cloudPct > 60 ? (isZh ? '多云' : 'Cloudy')
    : cloudPct > 30 ? (isZh ? '部分多云' : 'Partly cloudy')
    : (isZh ? '晴朗' : 'Clear');

  const windLabel = w.wind_speed_kmh == null ? '—'
    : w.wind_speed_kmh > 15 ? (isZh ? '大风' : 'Windy')
    : w.wind_speed_kmh > 10 ? (isZh ? '有风' : 'Breezy')
    : (isZh ? '微风' : 'Calm');

  const visLabel = cloudPct == null ? '—'
    : cloudPct >= 90 ? (isZh ? '不适合观测' : 'Unobservable')
    : cloudPct >= 50 ? (isZh ? '一般' : 'Fair')
    : (isZh ? '良好' : 'Good');

  // -- Moon --
  const moonPct = Math.round(sky.moon_illumination_frac * 100);
  const moonAbove = sky.moon_is_above_horizon;
  const moonSep = d.moon_separation_deg != null ? `${d.moon_separation_deg.toFixed(1)}°` : '—';

  // -- Equipment --
  const equipmentHtml = d.recommended_equipment.length > 0
    ? d.recommended_equipment
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(eq => {
          const suitBadge = suitabilityBadge(eq.suitability, isZh);
          return `<div class="list-line" style="padding:10px 0;border-bottom:1px solid rgba(92,110,140,.18)">
            <div class="row">
              <div><strong>${eq.equipment_name}</strong><div class="meta">${eq.equipment_type}</div></div>
              ${suitBadge}
            </div>
          </div>`;
        }).join('')
    : `<div class="meta" style="padding:10px 0">${isZh ? '暂无设备推荐' : 'No equipment data'}</div>`;

  // -- Bortle / darkness --
  const bortle = d.bortle_estimated;
  const bortleText = bortle != null ? `Bortle ${bortle}` : '—';

  // -- Site info --
  const siteTypeLabel = d.site_type || '';
  const accessLabel = d.public_access === 'open_access'
    ? (isZh ? '开放通行' : 'Open access')
    : d.public_access === 'restricted_access'
    ? (isZh ? '限制通行' : 'Restricted')
    : d.public_access || '';

  return `
    <!-- Hero: site name + object name + score -->
    <div class="hero-card">
      <div class="page-sub">${isZh ? '观测地点' : 'Site'}</div>
      <h1 style="font-size:24px;margin:4px 0">${d.site_name || '—'}</h1>
      <div class="meta">${[siteTypeLabel, accessLabel, bortleText].filter(Boolean).join(' · ')}</div>
      <div class="page-sub" style="margin-top:12px">${isZh ? '目标天体' : 'Target'}</div>
      <div style="font-size:20px;font-weight:700;margin:2px 0">${d.primary_name}${d.constellation ? `<span class="const-sub" style="font-size:14px;color:var(--muted);font-weight:600">${isZh ? `（${d.constellation}）` : ` (${d.constellation})`}</span>` : ''}</div>
      <div class="meta">
        ${d.object_type}${d.magnitude != null ? ` · Mag ${d.magnitude > 0 ? '+' : ''}${d.magnitude.toFixed(1)}` : ''}${d.catalog && d.catalog_number ? ` · ${d.catalog} ${d.catalog_number}` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:12px">
        <div class="score ${scoreCls}" style="width:52px;height:52px;font-size:18px">${score}</div>
        <div>
          <div style="font-weight:700;font-size:15px">${isZh ? '观测评分' : 'Observability score'}</div>
          <div class="meta">${obs.visibility_note || ''}</div>
        </div>
      </div>
    </div>

    <!-- Position -->
    <div class="section"><h3>${isZh ? '天体位置' : 'Position'}</h3></div>
    <div class="card">
      <div class="grid-2">
        <div class="fact">
          <div class="label">${isZh ? '高度角' : 'Altitude'}</div>
          <div class="value">${altText}</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '方位角' : 'Azimuth'}</div>
          <div class="value">${azText} · ${dirText}</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '状态' : 'Status'}</div>
          <div class="value">${isVisible ? (isZh ? '地平线以上' : 'Above horizon') : (isZh ? '地平线以下' : 'Below horizon')}</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '中天高度' : 'Transit alt.'}</div>
          <div class="value">${pos.transit_altitude_deg != null ? pos.transit_altitude_deg.toFixed(1) + '°' : '—'}</div>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap" class="meta">
        <span>${isZh ? '升起' : 'Rise'}: ${fmtTime(pos.rise_time)}</span>
        <span>${isZh ? '中天' : 'Transit'}: ${fmtTime(pos.transit_time)}</span>
        <span>${isZh ? '落下' : 'Set'}: ${fmtTime(pos.set_time)}</span>
      </div>
      ${pos.is_circumpolar ? `<div class="meta" style="margin-top:4px;color:var(--blue)">${isZh ? '拱极星（永不落下）' : 'Circumpolar (never sets)'}</div>` : ''}
      ${pos.never_rises ? `<div class="meta" style="margin-top:4px;color:var(--warn)">${isZh ? '永不升起' : 'Never rises'}</div>` : ''}
    </div>

    <!-- Sky context (sun & moon) -->
    <div class="section"><h3>${isZh ? '天空状况' : 'Sky context'}</h3></div>
    <div class="card">
      <div class="grid-2">
        <div class="fact">
          <div class="label">${isZh ? '夜间' : 'Night'}</div>
          <div class="value">${sky.is_night ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No')}</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '深黑夜' : 'Dark night'}</div>
          <div class="value">${sky.is_dark_night ? (isZh ? '是' : 'Yes') : (isZh ? '否' : 'No')}</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '太阳高度' : 'Sun alt.'}</div>
          <div class="value">${sky.sun_altitude_deg.toFixed(1)}°</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '月相' : 'Moon phase'}</div>
          <div class="value">${sky.moon_phase_name} · ${moonPct}%</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '月亮高度' : 'Moon alt.'}</div>
          <div class="value">${sky.moon_altitude_deg.toFixed(1)}°${moonAbove ? '' : ` (${isZh ? '地平线下' : 'below'})`}</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '月天体角距' : 'Moon sep.'}</div>
          <div class="value">${moonSep}</div>
        </div>
      </div>
      ${moonPct > 50 && d.moon_separation_deg != null && d.moon_separation_deg < 45
        ? `<div class="meta" style="margin-top:8px;color:var(--warn)">${isZh ? '月光较强，可能影响观测' : 'Moonlight may affect observation'}</div>`
        : moonPct <= 30
        ? `<div class="meta" style="margin-top:8px;color:var(--good)">${isZh ? '月光弱，观测条件好' : 'Low moonlight, good conditions'}</div>`
        : ''
      }
    </div>

    <!-- Weather -->
    <div class="section"><h3>${isZh ? '当前天气' : 'Current weather'}</h3></div>
    <div class="card">
      <div class="grid-2">
        <div class="fact">
          <div class="label">${isZh ? '温度' : 'Temperature'}</div>
          <div class="value">${w.temperature_c != null ? Math.round(w.temperature_c) + '°C' : '—'}</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '湿度' : 'Humidity'}</div>
          <div class="value">${w.relative_humidity_pct != null ? Math.round(w.relative_humidity_pct) + '%' : '—'}</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '风速' : 'Wind'}</div>
          <div class="value">${w.wind_speed_kmh != null ? Math.round(w.wind_speed_kmh) + ' km/h · ' + windLabel : '—'}</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '云量' : 'Clouds'}</div>
          <div class="value">${cloudPct != null ? cloudPct + '% · ' + cloudLabel : '—'}</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '降水概率' : 'Precip. prob.'}</div>
          <div class="value">${w.precipitation_probability_max_24h != null ? Math.round(w.precipitation_probability_max_24h) + '%' : '—'}</div>
        </div>
        <div class="fact">
          <div class="label">${isZh ? '观测条件' : 'Conditions'}</div>
          <div class="value">${visLabel}</div>
        </div>
      </div>
      ${w.is_unobservable ? `<div class="meta" style="margin-top:8px;color:var(--warn)">${isZh ? '天气不适合观测' : 'Weather unsuitable for observation'}</div>` : ''}
    </div>

    <!-- Equipment recommendations -->
    <div class="section"><h3>${isZh ? '设备推荐' : 'Equipment'}</h3></div>
    <div class="card">${equipmentHtml}</div>

    <!-- Observability breakdown -->
    <div class="section"><h3>${isZh ? '评分明细' : 'Score breakdown'}</h3></div>
    <div class="card">
      <div class="list-line" style="padding:10px 0;border-bottom:1px solid rgba(92,110,140,.18)">
        <div class="row">
          <div>${isZh ? '高度评分' : 'Altitude score'}</div>
          <span class="meta">${obs.altitude_score.toFixed(1)}</span>
        </div>
      </div>
      <div class="list-line" style="padding:10px 0;border-bottom:1px solid rgba(92,110,140,.18)">
        <div class="row">
          <div>${isZh ? '亮度评分' : 'Brightness score'}</div>
          <span class="meta">${obs.brightness_score.toFixed(1)}</span>
        </div>
      </div>
      <div class="list-line" style="padding:10px 0;border-bottom:1px solid rgba(92,110,140,.18)">
        <div class="row">
          <div>${isZh ? '月光扣分' : 'Moon penalty'}</div>
          <span class="meta" style="color:var(--warn)">-${obs.moon_penalty.toFixed(1)}</span>
        </div>
      </div>
      <div class="list-line" style="padding:10px 0">
        <div class="row">
          <div><strong>${isZh ? '总分' : 'Total'}</strong></div>
          <span class="badge ${scoreCls}">${score}</span>
        </div>
      </div>
      <div class="meta" style="margin-top:6px">${obs.altitude_factor || ''}</div>
    </div>

    <div style="height:40px"></div>
  `;
}

// ===== Helpers =====
function azimuthToDirection(az: number, isZh: boolean): string {
  const dirs = isZh
    ? ['北','东北','东','东南','南','西南','西','西北']
    : ['N','NE','E','SE','S','SW','W','NW'];
  const idx = Math.round(az / 45) % 8;
  return dirs[idx];
}

function suitabilityBadge(suitability: string, isZh: boolean): string {
  const map: Record<string, { cls: string; label: string }> = {
    recommended: { cls: 'good', label: isZh ? '推荐' : 'Recommended' },
    suitable: { cls: 'good', label: isZh ? '适合' : 'Suitable' },
    possible: { cls: 'warn', label: isZh ? '可行' : 'Possible' },
    not_suitable: { cls: 'bad', label: isZh ? '不适合' : 'Not suitable' },
  };
  const info = map[suitability] || { cls: '', label: suitability };
  return `<span class="badge ${info.cls}">${info.label}</span>`;
}

function bindEvents(): void {
  // Currently no interactive elements beyond back button
}
