// ===== Profile 页面 =====
// "我的设备、观测记录、贡献者权益"
import type { EquipmentItem, ObservationRecord } from '../types';
import { ctx, persistContext, onContextChange } from '../lib/context';
import { t, tCat } from '../lib/i18n';
import { loadContributions, getContributionStats, type ContributionRecord } from '../lib/contribution';

// ===== State =====
let profileTab: 'equipment' | 'records' | 'contributions' = 'equipment';

// ===== Sample observation records =====
const SAMPLE_RECORDS: ObservationRecord[] = [
  {
    id: 'rec-1', date: '2026-08-05', startTime: '22:30', endTime: '01:15',
    locationName: '西涌暗夜社区', bortle: 4,
    targets: [
      { id: 'milkyway', name: '银河', type: 'milkyway', completedAt: '22:45' },
      { id: 'saturn', name: '土星', type: 'planet', completedAt: '23:10' },
    ],
    notes: '银河核心清晰可见，海边条件不错',
    weatherScore: 78, moonPhase: '新月',
    createdAt: '2026-08-05T22:30:00'
  },
  {
    id: 'rec-2', date: '2026-07-28', startTime: '21:00', endTime: '23:30',
    locationName: '怀柔暗夜观测站', bortle: 4,
    targets: [
      { id: 'm31', name: '仙女座星系', type: 'deepSky' },
      { id: 'vega', name: '织女星', type: 'star' },
    ],
    notes: '双筒镜找到仙女座星系，模糊光斑',
    weatherScore: 65, moonPhase: '蛾眉月',
    createdAt: '2026-07-28T21:00:00'
  },
  {
    id: 'rec-3', date: '2026-07-12', startTime: '22:00', endTime: '00:30',
    locationName: '太行洪谷', bortle: 2,
    targets: [
      { id: 'milkyway', name: '银河', type: 'milkyway' },
      { id: 'perseids', name: '英仙座流星雨', type: 'meteor' },
    ],
    notes: '流星雨前哨夜，3小时内看到11颗',
    weatherScore: 88, moonPhase: '下弦月',
    createdAt: '2026-07-12T22:00:00'
  },
];

// ===== Persistence for records =====
const RECORDS_KEY = 'ds_observation_records';

function loadRecords(): ObservationRecord[] {
  try {
    const stored = localStorage.getItem(RECORDS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return SAMPLE_RECORDS;
}

function saveRecords(records: ObservationRecord[]) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {}
}

// ===== Render =====
export function renderProfilePage(): string {
  const records = loadRecords();
  const contribStats = getContributionStats(loadContributions());
  const contributionLevel = contribStats.level === 'founder'
    ? (ctx.language === 'zh' ? '创始探索者' : 'Founding Explorer')
    : contribStats.level === 'explorer'
      ? (ctx.language === 'zh' ? '探索者' : 'Explorer')
      : (ctx.language === 'zh' ? '观测者' : 'Observer');
  const lifetimeEligible = contribStats.lifetimeEligible;

  return `
    <div class="page-top">
      <div>
        <div class="page-sub">${t('profile.sub')}</div>
        <h1>${t('profile.title')}</h1>
      </div>
      <button class="icon-btn" id="profileSettings">⚙︎</button>
    </div>

    <div class="hero-card">
      <h2>${t('profile.heroTitle')}</h2>
      <p>${t('profile.heroDesc')}</p>
    </div>

    <!-- Language Switch -->
    <div class="card" style="padding:12px 14px;margin-bottom:12px">
      <div class="row">
        <div>
          <div class="place" style="font-size:14px">${t('profile.language')}</div>
          <div class="meta">${t('profile.languageDesc')}</div>
        </div>
        <div class="segment" id="languageSeg" style="margin:0;width:auto;min-width:140px">
          <button class="seg ${ctx.language === 'zh' ? 'active' : ''}" data-lang="zh">中文</button>
          <button class="seg ${ctx.language === 'en' ? 'active' : ''}" data-lang="en">EN</button>
        </div>
      </div>
    </div>

    <!-- Profile tabs -->
    <div class="chips" id="profileChips">
      <button class="chip ${profileTab === 'equipment' ? 'active' : ''}" data-ptab="equipment">${t('profile.equipment')}</button>
      <button class="chip ${profileTab === 'records' ? 'active' : ''}" data-ptab="records">${t('profile.records')}</button>
      <button class="chip ${profileTab === 'contributions' ? 'active' : ''}" data-ptab="contributions">${t('profile.contributions')}</button>
    </div>

    <div id="profileContent"></div>
  `;
}

export function initProfilePage(): void {
  // Profile tab chips
  document.getElementById('profileChips')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.chip') as HTMLElement;
    if (!btn) return;
    profileTab = (btn.dataset.ptab || 'equipment') as any;
    document.querySelectorAll('#profileChips .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderProfileContent();
  });

  // Language switch
  document.getElementById('languageSeg')?.addEventListener('click', (e) => {
    const seg = (e.target as HTMLElement).closest('.seg') as HTMLElement;
    if (!seg) return;
    const lang = seg.dataset.lang as 'zh' | 'en';
    if (lang && lang !== ctx.language) {
      ctx.language = lang;
      persistContext();
      // Full page re-render to apply language
      (window as any).reloadCurrentPage?.();
    }
  });

  // Settings
  document.getElementById('profileSettings')?.addEventListener('click', () => {
    (window as any).toast?.(ctx.language === 'zh' ? '设置功能开发中' : 'Settings coming soon');
  });

  renderProfileContent();
}

function renderProfileContent() {
  const container = document.getElementById('profileContent');
  if (!container) return;

  switch (profileTab) {
    case 'equipment':
      container.innerHTML = renderEquipmentSection();
      initEquipmentSection();
      break;
    case 'records':
      container.innerHTML = renderRecordsSection();
      initRecordsSection();
      break;
    case 'contributions':
      container.innerHTML = renderContributionsSection();
      initContributionsSection();
      break;
  }
}

// ===== Equipment Section =====
function renderEquipmentSection(): string {
  const items = ctx.equipment.items;

  const equipmentCards = items.map(item => {
    const details = getEquipmentDetails(item);
    return `
      <div class="card clickable" data-equip-id="${item.id}">
        <div class="row">
          <div>
            <div class="place">${item.label}</div>
            <div class="meta">${details}</div>
          </div>
          <span style="color:var(--muted);font-size:18px">›</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="section"><h3>${t('profile.myEquip')}</h3><button style="color:var(--blue);font-size:12px;border:0;background:transparent" id="editEquipment">${t('profile.edit')}</button></div>
    ${equipmentCards.length > 0 ? equipmentCards : `
      <div class="card"><div class="meta" style="text-align:center;padding:20px 0">
        ${t('profile.noEquip')}
      </div></div>`}

    <div class="section"><h3>${t('profile.quickAdd')}</h3><span class="page-sub">${t('profile.commonPresets')}</span></div>
    <div class="grid-2">
      <div class="card clickable" style="text-align:center" data-preset="naked">
        <div style="font-size:28px;margin-bottom:4px">👁</div>
        <div style="font-size:13px;font-weight:800">${t('profile.nakedEye')}</div>
        <div class="meta">${t('profile.defaultMode')}</div>
      </div>
      <div class="card clickable" style="text-align:center" data-preset="binocular">
        <div style="font-size:28px;margin-bottom:4px">🔭</div>
        <div style="font-size:13px;font-weight:800">10×50</div>
        <div class="meta">${t('profile.mostVersatile')}</div>
      </div>
      <div class="card clickable" style="text-align:center" data-preset="camera">
        <div style="font-size:28px;margin-bottom:4px">📷</div>
        <div style="font-size:13px;font-weight:800">${ctx.language === 'zh' ? '广角相机' : 'Wide camera'}</div>
        <div class="meta">24mm f/1.8</div>
      </div>
      <div class="card clickable" style="text-align:center" data-preset="telescope">
        <div style="font-size:28px;margin-bottom:4px">🔭</div>
        <div style="font-size:13px;font-weight:800">8" Dob</div>
        <div class="meta">${t('profile.deepSkyKing')}</div>
      </div>
    </div>
  `;
}

function initEquipmentSection() {
  document.getElementById('editEquipment')?.addEventListener('click', () => {
    (window as any).openModal?.('equipmentModal');
  });

  document.querySelectorAll('[data-preset]').forEach(el => {
    el.addEventListener('click', () => {
      const preset = (el as HTMLElement).dataset.preset;
      let newItem: EquipmentItem | null = null;
      switch (preset) {
        case 'naked':
          newItem = { id: 'naked', type: 'naked_eye', label: t('profile.nakedEye') };
          break;
        case 'binocular':
          newItem = { id: 'binoc-1', type: 'binoculars', label: '10×50 binoculars', magnification: 10, apertureMm: 50 };
          break;
        case 'camera':
          newItem = { id: 'cam-1', type: 'camera', label: 'Wide camera', sensorType: 'full_frame', lensFocalLengthMm: 24, maxAperture: 1.8, tracking: 'none' };
          break;
        case 'telescope':
          newItem = { id: 'scope-1', type: 'telescope', label: '8" Dobsonian', telescopeType: 'reflector', apertureMm: 200, focalLengthMm: 1200 };
          break;
      }
      if (newItem) {
        if (!ctx.equipment.items.some(i => i.type === newItem!.type && i.label === newItem!.label)) {
          ctx.equipment.items.push(newItem);
          persistContext();
          (window as any).toast?.(`${newItem.label} ${ctx.language === 'zh' ? '已添加' : 'added'}`);
          renderProfileContent();
        } else {
          (window as any).toast?.(t('profile.alreadyAdded'));
        }
      }
    });
  });

  document.querySelectorAll('[data-equip-id]').forEach(el => {
    el.addEventListener('click', () => {
      (window as any).openModal?.('equipmentModal');
    });
  });
}

function getEquipmentDetails(item: EquipmentItem): string {
  const isZh = (ctx.language || 'zh') === 'zh';
  switch (item.type) {
    case 'naked_eye':
      return t('profile.defaultMode');
    case 'binoculars':
      return `${item.magnification || 10}× ${isZh ? '倍率' : 'magnification'} · ${item.apertureMm || 50}mm ${isZh ? '口径' : 'aperture'}`;
    case 'telescope':
      return `${item.telescopeType || 'Reflector'} · ${item.apertureMm || 150}mm · ${item.focalLengthMm || 750}mm`;
    case 'camera':
      const sensor = item.sensorType === 'full_frame' ? (isZh ? '全画幅' : 'Full frame') : item.sensorType === 'aps_c' ? 'APS-C' : 'MFT';
      return `${sensor} · ${item.lensFocalLengthMm || 24}mm · f/${item.maxAperture || 1.8}${item.tracking && item.tracking !== 'none' ? ` · ${item.tracking === 'star_tracker' ? (isZh ? '星迹仪' : 'Star tracker') : (isZh ? '赤道仪' : 'EQ mount')}` : ''}`;
    case 'phone':
      return item.phoneModel || (isZh ? '手机相机' : 'Smartphone camera');
    default:
      return isZh ? '观测设备' : 'Observation equipment';
  }
}

// ===== Records Section =====
function renderRecordsSection(): string {
  const records = loadRecords();
  const totalVisits = records.length;
  const totalTargets = records.reduce((sum, r) => sum + r.targets.length, 0);

  return `
    <div class="section"><h3>${t('profile.summary')}</h3><span class="page-sub">${t('profile.allTime')}</span></div>
    <div class="grid-2" style="margin-bottom:12px">
      <div class="fact">
        <div class="label">${t('profile.totalSessions')}</div>
        <div class="value">${totalVisits}</div>
      </div>
      <div class="fact">
        <div class="label">${t('profile.targetsObserved')}</div>
        <div class="value">${totalTargets}</div>
      </div>
    </div>

    <div class="section"><h3>${t('profile.obsLog')}</h3><button style="color:var(--blue);font-size:12px;border:0;background:transparent" id="addRecord">${t('profile.add')}</button></div>
    ${records.length > 0 ? records.map(r => {
      const targetBadges = r.targets.map(t2 => {
        const typeInfo = typeToInfo(t2.type);
        const name = ctx.language === 'en' ? (tCat(t2.id, 'name') || t2.name) : t2.name;
        return `<span class="badge ${typeInfo.cls}">${name}</span>`;
      }).join('');
      return `
        <div class="card clickable" data-record-id="${r.id}">
          <div class="row">
            <div>
              <div class="place">${r.locationName}</div>
              <div class="meta">${r.date} · ${r.startTime}–${r.endTime || '?'} · Bortle ${r.bortle}${r.weatherScore ? ` · ${ctx.language === 'zh' ? '天气' : 'Weather'} ${r.weatherScore}` : ''}</div>
            </div>
            <span style="color:var(--muted);font-size:18px">›</span>
          </div>
          <div class="badges">${targetBadges}</div>
          ${r.notes ? `<div class="meta" style="margin-top:6px">${r.notes}</div>` : ''}
        </div>`;
    }).join('') : `
      <div class="card"><div class="meta" style="text-align:center;padding:20px 0">
        ${t('profile.noRecords')}
      </div></div>`}
  `;
}

function initRecordsSection() {
  document.getElementById('addRecord')?.addEventListener('click', () => {
    const newRecord: ObservationRecord = {
      id: `rec-${Date.now()}`,
      date: ctx.date.toISOString().split('T')[0],
      startTime: ctx.startTime,
      locationName: ctx.location.name,
      bortle: ctx.location.bortle,
      targets: [],
      notes: '',
      createdAt: new Date().toISOString(),
    };
    const records = loadRecords();
    records.unshift(newRecord);
    saveRecords(records);
    (window as any).toast?.(t('profile.newSession'));
    renderProfileContent();
  });

  document.querySelectorAll('[data-record-id]').forEach(el => {
    el.addEventListener('click', () => {
      (window as any).toast?.(ctx.language === 'zh' ? '会话详情开发中' : 'Session detail coming soon');
    });
  });
}

// ===== Contributions Section =====
function renderContributionsSection(): string {
  const contribs = loadContributions();
  const stats = getContributionStats(contribs);
  const isZh = (ctx.language || 'zh') === 'zh';

  const level = stats.level === 'founder'
    ? (isZh ? '创始探索者' : 'Founding Explorer')
    : stats.level === 'explorer'
      ? (isZh ? '探索者' : 'Explorer')
      : (isZh ? '观测者' : 'Observer');

  const statusBadge = (c: ContributionRecord) => {
    if (c.status === 'verified') return `<span class="badge good">${t('status.verified')}</span>`;
    if (c.status === 'accepted') return `<span class="badge good">${t('status.accepted')}</span>`;
    return `<span class="badge warn">${c.independentConfirmations} / 3</span>`;
  };

  // Format date
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isZh
      ? `${d.getMonth() + 1}月${d.getDate()}日`
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return `
    <div class="section"><h3>${t('profile.contribStatus')}</h3><span class="page-sub">${level}</span></div>
    <div class="card">
      <div class="row">
        <div>
          <div class="place">${level}</div>
          <div class="meta">${stats.accepted} ${isZh ? '条已采纳贡献' : 'accepted contributions'} · ${stats.verified} ${isZh ? '次已验证访问' : 'verified visits'}</div>
        </div>
        ${stats.lifetimeEligible ? `<span class="badge official">${t('profile.lifetime')}</span>` : `<span class="badge">${t('profile.forLifetime')}</span>`}
      </div>
    </div>

    <div class="section"><h3>${t('profile.recentContrib')}</h3><span class="page-sub">${t('profile.community')}</span></div>
    ${contribs.length > 0 ? contribs.map(c => `
      <div class="card">
        <div class="row">
          <div>
            <div class="place">${c.siteName}</div>
            <div class="meta">${fmtDate(c.submitDate)} · ${c.visitType === 'onsite' ? (isZh ? '现场访问' : 'On-site') : (isZh ? '历史访问' : 'Past visit')}</div>
          </div>
          ${statusBadge(c)}
        </div>
      </div>
    `).join('') : `<div class="card"><div class="meta" style="text-align:center;padding:20px 0">${isZh ? '暂无贡献记录' : 'No contributions yet'}</div></div>`}

    <div class="section"><h3>${t('profile.howItWorks')}</h3></div>
    <div class="card">
      <div class="list-line" style="padding:11px 0;border-bottom:1px solid rgba(92,110,140,.22)">
        <div class="row"><strong>1</strong><div class="meta" style="margin-left:8px">${t('profile.step1')}</div></div>
      </div>
      <div class="list-line" style="padding:11px 0;border-bottom:1px solid rgba(92,110,140,.22)">
        <div class="row"><strong>2</strong><div class="meta" style="margin-left:8px">${t('profile.step2')}</div></div>
      </div>
      <div class="list-line" style="padding:11px 0">
        <div class="row"><strong>3</strong><div class="meta" style="margin-left:8px">${t('profile.step3')}</div></div>
      </div>
    </div>

    <div style="margin-top:16px">
      <button class="primary-btn" id="startContribute">${t('profile.contributeBtn')}</button>
    </div>
  `;
}

// ===== Contributions Section Init =====
function initContributionsSection() {
  document.getElementById('startContribute')?.addEventListener('click', () => {
    // Navigate to Sites page and let user pick a place
    // For MVP: open contribution modal with nearest site
    const nearestSite = ctx.location.name || 'Unknown';
    (window as any).openContributionModal?.(nearestSite);
  });
}

// ===== Helpers =====
function typeToInfo(type: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    planet:  { cls: 'warn', label: t('type.planet') },
    moon:    { cls: '', label: t('type.moon') },
    star:    { cls: 'good', label: t('type.star') },
    deepSky: { cls: 'official', label: t('type.deepSky') },
    milkyway:{ cls: 'good', label: t('type.milkyway') },
    meteor:  { cls: 'warn', label: t('type.meteor') },
  };
  return map[type] || { cls: '', label: type };
}
