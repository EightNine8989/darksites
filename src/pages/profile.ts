// ===== Profile 页面 =====
// "我的设备、观测记录、贡献者权益"
import type { EquipmentItem, ObservationRecord, Contribution } from '../types';
import { ctx, persistContext, onContextChange } from '../lib/context';

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

// ===== Contribution data =====
interface ContributionRecord {
  siteName: string;
  date: string;
  type: string;
  status: 'accepted' | 'pending' | 'verified';
  confirmCount?: number;
}

const SAMPLE_CONTRIBUTIONS: ContributionRecord[] = [
  { siteName: '西涌暗夜社区', date: 'Aug 5', type: 'Verified visit', status: 'accepted' },
  { siteName: '太行洪谷', date: 'Jul 28', type: 'Parking update', status: 'pending', confirmCount: 2 },
  { siteName: '怀柔暗夜观测站', date: 'Jul 12', type: 'Local light report', status: 'verified' },
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
  const acceptedCount = SAMPLE_CONTRIBUTIONS.filter(c => c.status === 'accepted' || c.status === 'verified').length;
  const verifiedCount = SAMPLE_CONTRIBUTIONS.filter(c => c.status === 'verified').length;
  const contributionLevel = acceptedCount >= 5 ? 'Founding Explorer' : acceptedCount >= 3 ? 'Explorer' : 'Observer';
  const lifetimeEligible = acceptedCount >= 3;

  return `
    <div class="page-top">
      <div>
        <div class="page-sub">Your observing profile</div>
        <h1>Profile</h1>
      </div>
      <button class="icon-btn" id="profileSettings">⚙︎</button>
    </div>

    <div class="hero-card">
      <h2>Observer profile</h2>
      <p>Your equipment and history improve object recommendations and keep your contributions organized.</p>
    </div>

    <!-- Profile tabs -->
    <div class="chips" id="profileChips">
      <button class="chip ${profileTab === 'equipment' ? 'active' : ''}" data-ptab="equipment">Equipment</button>
      <button class="chip ${profileTab === 'records' ? 'active' : ''}" data-ptab="records">Records</button>
      <button class="chip ${profileTab === 'contributions' ? 'active' : ''}" data-ptab="contributions">Contributions</button>
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

  // Settings
  document.getElementById('profileSettings')?.addEventListener('click', () => {
    (window as any).toast?.('Settings coming soon');
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
    <div class="section"><h3>My equipment</h3><button style="color:var(--blue);font-size:12px;border:0;background:transparent" id="editEquipment">Edit</button></div>
    ${equipmentCards.length > 0 ? equipmentCards : `
      <div class="card"><div class="meta" style="text-align:center;padding:20px 0">
        No equipment configured. Tap Edit to add your gear.
      </div></div>`}

    <div class="section"><h3>Quick add</h3><span class="page-sub">Common presets</span></div>
    <div class="grid-2">
      <div class="card clickable" style="text-align:center" data-preset="naked">
        <div style="font-size:28px;margin-bottom:4px">👁</div>
        <div style="font-size:13px;font-weight:800">Naked eye</div>
        <div class="meta">Default mode</div>
      </div>
      <div class="card clickable" style="text-align:center" data-preset="binocular">
        <div style="font-size:28px;margin-bottom:4px">🔭</div>
        <div style="font-size:13px;font-weight:800">10×50 binoculars</div>
        <div class="meta">Most versatile</div>
      </div>
      <div class="card clickable" style="text-align:center" data-preset="camera">
        <div style="font-size:28px;margin-bottom:4px">📷</div>
        <div style="font-size:13px;font-weight:800">Wide camera</div>
        <div class="meta">24mm f/1.8</div>
      </div>
      <div class="card clickable" style="text-align:center" data-preset="telescope">
        <div style="font-size:28px;margin-bottom:4px">🔭</div>
        <div style="font-size:13px;font-weight:800">8" Dobsonian</div>
        <div class="meta">Deep sky king</div>
      </div>
    </div>
  `;
}

function initEquipmentSection() {
  document.getElementById('editEquipment')?.addEventListener('click', () => {
    (window as any).openModal?.('equipmentModal');
  });

  // Preset quick-add
  document.querySelectorAll('[data-preset]').forEach(el => {
    el.addEventListener('click', () => {
      const preset = (el as HTMLElement).dataset.preset;
      let newItem: EquipmentItem | null = null;
      switch (preset) {
        case 'naked':
          newItem = { id: 'naked', type: 'naked_eye', label: 'Naked eye' };
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
        // Don't add duplicate
        if (!ctx.equipment.items.some(i => i.type === newItem!.type && i.label === newItem!.label)) {
          ctx.equipment.items.push(newItem);
          persistContext();
          (window as any).toast?.(`${newItem.label} added`);
          renderProfileContent();
        } else {
          (window as any).toast?.('Already in your equipment');
        }
      }
    });
  });

  // Click equipment card → edit via modal
  document.querySelectorAll('[data-equip-id]').forEach(el => {
    el.addEventListener('click', () => {
      (window as any).openModal?.('equipmentModal');
    });
  });
}

function getEquipmentDetails(item: EquipmentItem): string {
  switch (item.type) {
    case 'naked_eye':
      return 'Default observation mode';
    case 'binoculars':
      return `${item.magnification || 10}× magnification · ${item.apertureMm || 50} mm aperture`;
    case 'telescope':
      return `${item.telescopeType || 'Reflector'} · ${item.apertureMm || 150}mm · ${item.focalLengthMm || 750}mm`;
    case 'camera':
      return `${item.sensorType === 'full_frame' ? 'Full frame' : item.sensorType === 'aps_c' ? 'APS-C' : 'MFT'} · ${item.lensFocalLengthMm || 24}mm · f/${item.maxAperture || 1.8}${item.tracking && item.tracking !== 'none' ? ` · ${item.tracking === 'star_tracker' ? 'Star tracker' : 'EQ mount'}` : ''}`;
    case 'phone':
      return item.phoneModel || 'Smartphone camera';
    default:
      return 'Observation equipment';
  }
}

// ===== Records Section =====
function renderRecordsSection(): string {
  const records = loadRecords();
  const totalVisits = records.length;
  const totalTargets = records.reduce((sum, r) => sum + r.targets.length, 0);

  return `
    <div class="section"><h3>Summary</h3><span class="page-sub">All time</span></div>
    <div class="grid-2" style="margin-bottom:12px">
      <div class="fact">
        <div class="label">Total sessions</div>
        <div class="value">${totalVisits}</div>
      </div>
      <div class="fact">
        <div class="label">Targets observed</div>
        <div class="value">${totalTargets}</div>
      </div>
    </div>

    <div class="section"><h3>Observation log</h3><button style="color:var(--blue);font-size:12px;border:0;background:transparent" id="addRecord">＋ Add</button></div>
    ${records.length > 0 ? records.map(r => {
      const targetBadges = r.targets.map(t => {
        const typeInfo = typeToInfo(t.type);
        return `<span class="badge ${typeInfo.cls}">${t.name}</span>`;
      }).join('');
      return `
        <div class="card clickable" data-record-id="${r.id}">
          <div class="row">
            <div>
              <div class="place">${r.locationName}</div>
              <div class="meta">${r.date} · ${r.startTime}–${r.endTime || '?'} · Bortle ${r.bortle}${r.weatherScore ? ` · Weather ${r.weatherScore}` : ''}</div>
            </div>
            <span style="color:var(--muted);font-size:18px">›</span>
          </div>
          <div class="badges">${targetBadges}</div>
          ${r.notes ? `<div class="meta" style="margin-top:6px">${r.notes}</div>` : ''}
        </div>`;
    }).join('') : `
      <div class="card"><div class="meta" style="text-align:center;padding:20px 0">
        No observation records yet. Start your first session!
      </div></div>`}
  `;
}

function initRecordsSection() {
  document.getElementById('addRecord')?.addEventListener('click', () => {
    // Create a new record from current context
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
    (window as any).toast?.('New session started');
    renderProfileContent();
  });

  // Record card click → view detail (future: expand inline)
  document.querySelectorAll('[data-record-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.recordId;
      (window as any).toast?.(`Session detail coming soon`);
    });
  });
}

// ===== Contributions Section =====
function renderContributionsSection(): string {
  const acceptedCount = SAMPLE_CONTRIBUTIONS.filter(c => c.status === 'accepted' || c.status === 'verified').length;
  const verifiedCount = SAMPLE_CONTRIBUTIONS.filter(c => c.status === 'verified').length;
  const level = acceptedCount >= 5 ? 'Founding Explorer' : acceptedCount >= 3 ? 'Explorer' : 'Observer';
  const lifetimeEligible = acceptedCount >= 3;

  return `
    <div class="section"><h3>Contribution status</h3><span class="page-sub">${level}</span></div>
    <div class="card">
      <div class="row">
        <div>
          <div class="place">${level}</div>
          <div class="meta">${acceptedCount} accepted contributions · ${verifiedCount} verified visits</div>
        </div>
        ${lifetimeEligible ? '<span class="badge official">Lifetime eligible</span>' : '<span class="badge">3+ for lifetime</span>'}
      </div>
    </div>

    <div class="section"><h3>Recent contributions</h3><span class="page-sub">Community maintained</span></div>
    ${SAMPLE_CONTRIBUTIONS.map(c => {
      const statusBadge = c.status === 'verified'
        ? '<span class="badge good">Verified</span>'
        : c.status === 'accepted'
          ? '<span class="badge good">Accepted</span>'
          : `<span class="badge warn">${c.confirmCount || 0} / 3</span>`;
      return `
        <div class="card">
          <div class="row">
            <div>
              <div class="place">${c.siteName}</div>
              <div class="meta">${c.date} · ${c.type}</div>
            </div>
            ${statusBadge}
          </div>
        </div>`;
    }).join('')}

    <div class="section"><h3>How it works</h3></div>
    <div class="card">
      <div class="list-line" style="padding:11px 0;border-bottom:1px solid rgba(92,110,140,.22)">
        <div class="row"><strong>1</strong><div class="meta" style="margin-left:8px">Visit a dark site and report conditions</div></div>
      </div>
      <div class="list-line" style="padding:11px 0;border-bottom:1px solid rgba(92,110,140,.22)">
        <div class="row"><strong>2</strong><div class="meta" style="margin-left:8px">Get 3 independent confirmations → Verified</div></div>
      </div>
      <div class="list-line" style="padding:11px 0">
        <div class="row"><strong>3</strong><div class="meta" style="margin-left:8px">3+ accepted → Lifetime founding status</div></div>
      </div>
    </div>

    <div style="margin-top:16px">
      <button class="primary-btn" id="startContribute">＋ Contribute to a site</button>
    </div>
  `;
}

// ===== Helpers =====
function typeToInfo(type: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    planet:  { cls: 'warn', label: 'Planet' },
    moon:    { cls: '', label: 'Moon' },
    star:    { cls: 'good', label: 'Star' },
    deepSky: { cls: 'official', label: 'Deep Sky' },
    milkyway:{ cls: 'good', label: 'MW' },
    meteor:  { cls: 'warn', label: 'Meteor' },
  };
  return map[type] || { cls: '', label: type };
}
