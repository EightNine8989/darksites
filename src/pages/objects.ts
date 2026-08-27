// ===== Objects 页面 =====
// "我想看某个天体，怎么看、去哪里看"
import type { CelestialObject, CelestialCategory, EquipmentType } from '../types';
import { ctx, onContextChange } from '../lib/context';
import { getCelestialCatalog } from '../lib/catalog';
import { t } from '../lib/i18n';

// ===== Filter chips =====
type ObjectFilter = 'all' | 'star' | 'planet' | 'deepSky' | 'galaxy' | 'moon' | 'meteor' | 'comet' | 'asteroid' | 'doubleStar' | 'multipleStar';
const FILTERS: { key: ObjectFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'filter.all' },
  { key: 'star', labelKey: 'filter.stars' },
  { key: 'planet', labelKey: 'filter.planets' },
  { key: 'deepSky', labelKey: 'filter.deepSky' },
  { key: 'galaxy', labelKey: 'filter.galaxy' },
  { key: 'doubleStar', labelKey: 'filter.doubleStar' },
  { key: 'multipleStar', labelKey: 'filter.multipleStar' },
  { key: 'moon', labelKey: 'filter.moon' },
  { key: 'meteor', labelKey: 'filter.meteor' },
  { key: 'comet', labelKey: 'filter.comet' },
  { key: 'asteroid', labelKey: 'filter.asteroid' },
];

// ===== Sort modes =====
type SortMode = 'magnitude' | 'name';
const SORT_OPTIONS: { key: SortMode; labelKey: string }[] = [
  { key: 'magnitude', labelKey: 'objects.sortMag' },
  { key: 'name', labelKey: 'objects.sortName' },
];

// ===== State =====
let currentFilter: ObjectFilter = 'all';
let currentSort: SortMode = 'magnitude';
let searchQuery = '';

// ===== Context listener =====
let unsubObjectsContext: (() => void) | null = null;

// ===== Render =====
export function renderObjectsPage(): string {
  return `
    <div class="page-top">
      <div>
        <div class="page-sub">${t('objects.sub')}</div>
        <h1>${t('objects.title')}</h1>
      </div>
      <button class="icon-btn" id="objectsSortBtn">⇅</button>
    </div>

    <div class="hero-card">
      <h2>${t('objects.heroTitle')}</h2>
      <p>${t('objects.heroDesc')}</p>
      <div class="search">
        <input id="objectsSearch" placeholder="${t('objects.search')}" value="${searchQuery}">
        <button id="objectsSearchBtn">⌕</button>
      </div>
    </div>

    <div class="chips" id="objectsChips">
      ${FILTERS.map(f => `<button class="chip ${currentFilter === f.key ? 'active' : ''}" data-filter="${f.key}">${t(f.labelKey)}</button>`).join('')}
    </div>

    <!-- Sort mode indicator -->
    <div id="objectsSortIndicator" class="section" style="margin-bottom:0">
      <h3 style="font-size:14px">${t('objects.sortedBy')}${t(SORT_OPTIONS.find(s => s.key === currentSort)?.labelKey || '')}</h3>
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
      indicator.querySelector('h3')!.textContent = `${t('objects.sortedBy')}${t(SORT_OPTIONS.find(s => s.key === currentSort)?.labelKey || '')}`;
    }
    renderObjectList();
  });

  // Search
  const searchInput = document.getElementById('objectsSearch') as HTMLInputElement;
  searchInput?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    renderObjectList();
  });

  // Context change (equipment etc.) → re-render list
  if (unsubObjectsContext) unsubObjectsContext();
  unsubObjectsContext = onContextChange(() => {
    renderObjectList();
  });

  // Initial render
  renderObjectList();
}

// ===== Render Object List =====
function renderObjectList() {
  const container = document.getElementById('objectsList');
  const countEl = document.getElementById('objectsCount');
  if (!container) return;

  // Filter objects
  let objects = getCelestialCatalog().filter(obj => {
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

  // Sort
  objects.sort((a, b) => {
    switch (currentSort) {
      case 'magnitude':
        return a.magnitude - b.magnitude;
      case 'name':
        return a.name.localeCompare(b.name, 'zh');
    }
  });

  // Update count
  if (countEl) countEl.textContent = `${objects.length} ${t('objects.objects')}`;

  if (objects.length === 0) {
    container.innerHTML = `
      <div class="card">
        <div class="meta" style="text-align:center;padding:30px 0">
          ${t('objects.noMatch')}
        </div>
      </div>`;
    return;
  }

  container.innerHTML = objects.map(obj => renderObjectCard(obj)).join('');

  // Bind click handlers → navigate to object detail page
  container.querySelectorAll('.object-card').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.id!;
      (window as any).navigateTo?.('object-detail', id);
    });
  });
}

function renderObjectCard(obj: CelestialObject): string {
  // Equipment match
  const equipMatch = getEquipmentMatch(obj);

  // Type badge
  const typeInfo = typeToInfo(obj.type);

  // Difficulty badge
  const diffInfo = difficultyInfo(obj.difficulty);

  return `
    <div class="card object-card clickable" data-id="${obj.id}">
      <div class="row">
        <div style="flex:1;min-width:0">
          <div class="place">${obj.name}${obj.constellation && obj.constellation !== '—' ? `<span class="const-sub">${ctx.language === 'zh' ? `（${obj.constellation}）` : ` (${obj.constellation})`}</span>` : ''}</div>
          <div class="meta">
            ${obj.constellation && obj.constellation !== '—' ? obj.constellation + ' · ' : ''}${obj.magnitude >= 99 ? 'Mag —' : `Mag ${obj.magnitude > 0 ? '+' : ''}${obj.magnitude.toFixed(1)}`}
          </div>
        </div>
      </div>
      <div class="badges">
        <span class="badge ${typeInfo.cls}">${typeInfo.label}</span>
        ${equipMatch ? `<span class="badge official">${equipMatch}</span>` : ''}
        <span class="badge ${diffInfo.cls}">${diffInfo.label}</span>
      </div>
      ${obj.description ? `<div class="meta" style="margin-top:8px">${obj.description}</div>` : ''}
    </div>`;
}

// ===== Helpers =====
function typeToInfo(type: CelestialCategory): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    planet:       { cls: 'warn', label: t('type.planet') },
    star:         { cls: 'good', label: t('type.star') },
    deepSky:      { cls: 'official', label: t('type.deepSky') },
    galaxy:       { cls: 'official', label: t('type.galaxy') },
    moon:         { cls: '', label: t('type.moon') },
    milkyway:     { cls: 'good', label: t('type.milkyway') },
    meteor:       { cls: 'warn', label: t('type.meteor') },
    comet:        { cls: 'warn', label: t('type.comet') },
    asteroid:     { cls: 'warn', label: t('type.asteroid') },
    doubleStar:   { cls: 'good', label: t('type.doubleStar') },
    multipleStar: { cls: 'good', label: t('type.multipleStar') },
  };
  return map[type] || { cls: '', label: type };
}

function difficultyInfo(diff?: string): { cls: string; label: string } {
  switch (diff) {
    case 'easy': return { cls: 'good', label: t('diff.easy') };
    case 'moderate': return { cls: 'warn', label: t('diff.moderate') };
    case 'challenging': return { cls: 'bad', label: t('diff.challenging') };
    default: return { cls: '', label: '—' };
  }
}

function getEquipmentMatch(obj: CelestialObject): string {
  const eq = ctx.equipment;
  const primaryItem = eq.items.find(i => i.id === eq.primary);
  if (!primaryItem) return '';

  if (obj.equipment) {
    const userEquip = equipmentTypeToLabel(primaryItem.type);
    if (obj.equipment.some(e => e.includes(userEquip) || userEquip.includes(e))) {
      return `${ctx.language === 'zh' ? '你的' : 'Your '}${userEquip}`;
    }
  }
  return '';
}

function equipmentTypeToLabel(type: EquipmentType): string {
  const map: Record<EquipmentType, string> = {
    naked_eye: ctx.language === 'zh' ? '肉眼' : 'Naked eye',
    binoculars: ctx.language === 'zh' ? '双筒镜' : 'Binoculars',
    telescope: ctx.language === 'zh' ? '望远镜' : 'Telescope',
    camera: ctx.language === 'zh' ? '相机' : 'Camera',
    phone: ctx.language === 'zh' ? '手机' : 'Phone',
  };
  return map[type] || type;
}
