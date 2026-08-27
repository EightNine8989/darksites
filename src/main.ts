// ===== Dark Sites 2.0 Main Entry =====
import './styles/global.css';
import { ctx, restoreContext, persistContext, updateContext, onContextChange } from './lib/context';
import { getCurrentLocation, getGPSLocation } from './lib/location';
import { t } from './lib/i18n';
import { renderSitesPage, initSitesPage } from './pages/sites';
import { renderObjectsPage, initObjectsPage } from './pages/objects';
import { renderObjectDetailPage, initObjectDetailPage } from './pages/object-detail';
import { renderSiteObjectDetailPage, initSiteObjectDetailPage } from './pages/site-object-detail';
import { renderPlaceDetailPage, initPlaceDetailPage } from './pages/place-detail';
import { renderObservePage, initObservePage } from './pages/observe';
import { renderProfilePage, initProfilePage } from './pages/profile';
import { CONTRIBUTION_FIELDS, submitContribution, validateContribution, loadContributions } from './lib/contribution';
import { DARK_SKY_PLACES, getAllPlaces } from './lib/dark-sky-places';
import { loadCelestialCatalog } from './lib/catalog';
import { loadApiSites } from './lib/dark-sky-places';

// ===== Navigation Stack =====
type PageRoute = { type: 'tab'; tab: TabId } | { type: 'object-detail'; id: string } | { type: 'place-detail'; id: string } | { type: 'site-object-detail'; siteId: string; objId: string };
let navStack: PageRoute[] = [{ type: 'tab', tab: 'sites' }];

function pushRoute(route: PageRoute) {
  navStack.push(route);
  renderRoute(route);
  updateTabBarVisibility();
}

function popRoute() {
  if (navStack.length <= 1) return;
  navStack.pop();
  const route = navStack[navStack.length - 1];
  renderRoute(route);
  updateTabBarVisibility();
}

function navigateTo(type: string, id: string, id2?: string) {
  if (type === 'object-detail') pushRoute({ type: 'object-detail', id });
  else if (type === 'place-detail') pushRoute({ type: 'place-detail', id });
  else if (type === 'site-object-detail' && id2) pushRoute({ type: 'site-object-detail', siteId: id, objId: id2 });
}

function navigateBack() {
  popRoute();
}

// Expose globally for detail pages
(window as any).navigateTo = navigateTo;
(window as any).navigateBack = navigateBack;
(window as any).getCurrentRoute = () => navStack[navStack.length - 1];

// ===== Tab Routing =====
type TabId = 'sites' | 'objects' | 'observe' | 'profile';
let currentTab: TabId = 'sites';
let tabInited: Record<TabId, boolean> = { sites: false, objects: false, observe: false, profile: false };

function switchTab(tab: TabId) {
  currentTab = tab;
  navStack = [{ type: 'tab', tab }]; // reset stack on tab switch
  renderCurrentPage();
  updateTabBarLabels();
  document.querySelectorAll('.tab').forEach(el => {
    el.classList.toggle('active', (el as HTMLElement).dataset.tab === tab);
  });
  updateTabBarVisibility();
}

function updateTabBarLabels() {
  document.querySelectorAll('.tab').forEach(el => {
    const tabEl = el as HTMLElement;
    const tabId = tabEl.dataset.tab as TabId;
    const labelMap: Record<TabId, string> = {
      sites: t('tab.sites'),
      objects: t('tab.objects'),
      observe: t('tab.observe'),
      profile: t('tab.profile'),
    };
    // Update only the text node (after the <i> icon)
    const textNode = tabEl.childNodes[1];
    if (textNode) textNode.textContent = labelMap[tabId] || tabId;
  });
}

function updateTabBarVisibility() {
  const tabBar = document.getElementById('tabBar');
  if (!tabBar) return;
  const route = navStack[navStack.length - 1];
  const isTabPage = route.type === 'tab';
  tabBar.style.display = isTabPage ? 'flex' : 'none';
}

// Reload current page (used after language switch)
function reloadCurrentPage() {
  updateTabBarLabels();
  renderCurrentPage();
}
(window as any).reloadCurrentPage = reloadCurrentPage;

function renderCurrentPage() {
  const route = navStack[navStack.length - 1];
  renderRoute(route);
}

function renderRoute(route: PageRoute) {
  const container = document.getElementById('pageContainer');
  if (!container) return;
  container.scrollTop = 0;

  switch (route.type) {
    case 'tab':
      switch (route.tab) {
        case 'sites':
          container.innerHTML = renderSitesPage();
          initSitesPage();
          tabInited.sites = true;
          break;
        case 'objects':
          container.innerHTML = renderObjectsPage();
          initObjectsPage();
          tabInited.objects = true;
          break;
        case 'observe':
          container.innerHTML = renderObservePage();
          initObservePage();
          tabInited.observe = true;
          break;
        case 'profile':
          container.innerHTML = renderProfilePage();
          initProfilePage();
          break;
      }
      break;

    case 'object-detail':
      container.innerHTML = renderObjectDetailPage(route.id);
      initObjectDetailPage();
      break;

    case 'place-detail':
      container.innerHTML = renderPlaceDetailPage(route.id);
      initPlaceDetailPage();
      break;

    case 'site-object-detail':
      container.innerHTML = renderSiteObjectDetailPage(route.siteId, route.objId);
      initSiteObjectDetailPage();
      break;
  }
}

// ===== Modal System =====
/** 本地时区的 YYYY-MM-DD（避免 toISOString 的 UTC 偏移导致日期差一天） */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function openModal(id: string) {
  const modal = document.getElementById(id);
  if (!modal) return;
  // Date modal: rebuild calendar to current context before showing
  if (id === 'dateModal') {
    dateModalState.selectedDate = new Date(ctx.date.getTime());
    dateModalState.viewYear = ctx.date.getFullYear();
    dateModalState.viewMonth = ctx.date.getMonth();
    dateModalState.planningMode = ctx.planningMode;
    renderDateModalContent();
  }
  modal.classList.add('show');
}

function closeModal(id: string) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('show');
}

// ===== Toast =====
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function toast(msg: string) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// Expose globally
(window as any).openModal = openModal;
(window as any).toast = toast;
(window as any).switchToProfile = () => switchTab('profile');

// ===== Date Modal (custom calendar — no native input) =====
const isZhCtx = () => (ctx.language || 'zh') === 'zh';

const dateModalState = {
  selectedDate: new Date(ctx.date.getTime()),
  viewYear: ctx.date.getFullYear(),
  viewMonth: ctx.date.getMonth(),
  planningMode: ctx.planningMode,
};

const WEEK_ZH = ['一', '二', '三', '四', '五', '六', '日'];
const WEEK_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function createDateModal(): string {
  return `
  <div id="dateModal" class="modal">
    <div class="sheet" style="padding-bottom:24px">
      <div class="handle"></div>
      <div class="row">
        <div><div class="page-sub">${t('general.obsTime')}</div><h2>${t('general.dateAndTime')}</h2></div>
        <button class="back-btn" id="dateModalClose">✕</button>
      </div>
      <div id="dateModalContent"></div>
    </div>
  </div>`;
}

function renderDateModalContent(): void {
  const container = document.getElementById('dateModalContent');
  if (!container) return;
  container.innerHTML = `
    ${renderCalendarGrid()}
    <button class="primary-btn" id="applyDate" style="margin-top:14px">${t('general.apply')}</button>
  `;
  bindCalendarEvents();
}

function renderCalendarGrid(): string {
  const zh = isZhCtx();
  const { viewYear, viewMonth, selectedDate } = dateModalState;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // First day of month; shift so Monday = 0
  const firstDay = new Date(viewYear, viewMonth, 1);
  let startWeekday = firstDay.getDay() - 1; // JS: 0=Sun → shift to Mon=0
  if (startWeekday < 0) startWeekday = 6; // Sunday → 6
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Prev month tail
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { day: number; date: Date; current: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ day: prevDays - i, date: new Date(viewYear, viewMonth - 1, prevDays - i), current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: new Date(viewYear, viewMonth, d), current: true });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    cells.push({ day: next.getDate(), date: next, current: false });
    if (cells.length >= 42) break;
  }

  const weekLabels = zh ? WEEK_ZH : WEEK_EN;
  const monthLabel = zh
    ? `${viewYear}年 ${MONTH_ZH[viewMonth]}`
    : `${MONTH_EN[viewMonth]} ${viewYear}`;

  const selDateStr = toLocalDateStr(selectedDate);
  const todayStr = toLocalDateStr(today);

  const cellsHtml = cells.map(c => {
    const dateStr = toLocalDateStr(c.date);
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selDateStr;
    const classes = ['dp-day'];
    if (!c.current) classes.push('other-month');
    if (isToday) classes.push('today');
    if (isSelected) classes.push('selected');
    return `<button class="${classes.join(' ')}" data-date="${dateStr}">${c.day}</button>`;
  }).join('');

  return `
    <div class="dp-nav">
      <button class="dp-arrow" id="dpPrevMonth">‹</button>
      <span class="dp-month-label">${monthLabel}</span>
      <button class="dp-arrow" id="dpNextMonth">›</button>
    </div>
    <div class="dp-weekrow">${weekLabels.map(w => `<div class="dp-weekday">${w}</div>`).join('')}</div>
    <div class="dp-grid">${cellsHtml}</div>
  `;
}

function bindCalendarEvents(): void {
  const container = document.getElementById('dateModalContent');
  // Close button
  document.getElementById('dateModalClose')?.addEventListener('click', () => closeModal('dateModal'));

  // Prev / next month
  document.getElementById('dpPrevMonth')?.addEventListener('click', () => {
    dateModalState.viewMonth--;
    if (dateModalState.viewMonth < 0) { dateModalState.viewMonth = 11; dateModalState.viewYear--; }
    renderDateModalContent();
  });
  document.getElementById('dpNextMonth')?.addEventListener('click', () => {
    dateModalState.viewMonth++;
    if (dateModalState.viewMonth > 11) { dateModalState.viewMonth = 0; dateModalState.viewYear++; }
    renderDateModalContent();
  });

  // Day click
  container?.querySelectorAll('.dp-day').forEach(el => {
    el.addEventListener('click', () => {
      const dateStr = (el as HTMLElement).dataset.date!;
      dateModalState.selectedDate = new Date(dateStr + 'T00:00:00');

      // If clicked a grey-out (other-month) day, jump the calendar view to that month
      const wasOtherMonth = (el as HTMLElement).classList.contains('other-month');
      if (wasOtherMonth) {
        dateModalState.viewYear = dateModalState.selectedDate.getFullYear();
        dateModalState.viewMonth = dateModalState.selectedDate.getMonth();
        renderDateModalContent();
        return;
      }

      // Same-month click: only update selected highlight, keep the apply button alive
      container?.querySelectorAll('.dp-day').forEach(d => d.classList.remove('selected'));
      el.classList.add('selected');
    });
  });

  // Apply button
  document.getElementById('applyDate')?.addEventListener('click', () => {
    updateContext({
      date: new Date(dateModalState.selectedDate.getTime()),
    });
    persistContext();
    closeModal('dateModal');
    toast(t('general.dateApplied'));
  });
}

// Backdrop click to close
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).id === 'dateModal') closeModal('dateModal');
});

// ===== Equipment Modal =====
function createEquipmentModal(): string {
  const isZh = (ctx.language || 'zh') === 'zh';
  return `
  <div id="equipmentModal" class="modal">
    <div class="sheet">
      <div class="handle"></div>
      <div class="row">
        <div><div class="page-sub">${t('general.equipProfile')}</div><h2>${t('general.obsEquipment')}</h2></div>
        <button class="back-btn" onclick="document.getElementById('equipmentModal').classList.remove('show')">✕</button>
      </div>
      <div class="field">
        <label>${isZh ? '设备类型' : 'Equipment types'}</label>
        <div class="chips" id="equipTypes">
          <button class="chip active" data-type="naked">${isZh ? '肉眼' : 'Naked eye'}</button>
          <button class="chip" data-type="binocular">${isZh ? '双筒镜' : 'Binoculars'}</button>
          <button class="chip" data-type="telescope">${isZh ? '望远镜' : 'Telescope'}</button>
          <button class="chip" data-type="camera">${isZh ? '相机' : 'Camera'}</button>
          <button class="chip" data-type="phone">${isZh ? '手机' : 'Phone'}</button>
        </div>
      </div>
      <div id="binocularFields" style="display:none">
        <div class="page-sub" style="margin:8px 0 4px">${isZh ? '双筒镜' : 'Binoculars'}</div>
        <div class="grid-2">
          <div class="field"><label>${isZh ? '倍率' : 'Magnification'}</label><input value="10×"></div>
          <div class="field"><label>${isZh ? '口径' : 'Aperture'}</label><input value="50 mm"></div>
        </div>
      </div>
      <div id="telescopeFields" style="display:none">
        <div class="page-sub" style="margin:8px 0 4px">${isZh ? '望远镜' : 'Telescope'}</div>
        <div class="field"><label>${isZh ? '类型' : 'Type'}</label>
          <select><option>${isZh ? '折射式' : 'Refractor'}</option><option>${isZh ? '反射/道布森' : 'Reflector / Dobsonian'}</option><option>SCT / Maksutov</option><option>${isZh ? '智能望远镜' : 'Smart telescope'}</option></select>
        </div>
        <div class="grid-2">
          <div class="field"><label>${isZh ? '口径' : 'Aperture'}</label><input placeholder="150 mm"></div>
          <div class="field"><label>${isZh ? '焦距' : 'Focal length'}</label><input placeholder="750 mm"></div>
        </div>
      </div>
      <div id="cameraFields" style="display:none">
        <div class="page-sub" style="margin:8px 0 4px">${isZh ? '相机' : 'Camera'}</div>
        <div class="field"><label>${isZh ? '传感器' : 'Sensor'}</label>
          <select><option>${isZh ? '全画幅' : 'Full frame'}</option><option>APS-C</option><option>${isZh ? 'M4/3' : 'Micro Four Thirds'}</option><option>1-inch</option></select>
        </div>
        <div class="grid-2">
          <div class="field"><label>${isZh ? '镜头焦距' : 'Lens focal length'}</label><input value="24 mm"></div>
          <div class="field"><label>${isZh ? '最大光圈' : 'Max aperture'}</label><input value="f/1.8"></div>
        </div>
        <div class="segment" id="trackingSeg">
          <button class="seg active" data-track="none">${isZh ? '无' : 'None'}</button>
          <button class="seg" data-track="tracker">${isZh ? '星迹仪' : 'Star tracker'}</button>
          <button class="seg" data-track="eq">${isZh ? '赤道仪' : 'Equatorial mount'}</button>
        </div>
      </div>
      <button class="primary-btn" id="saveEquipment">${isZh ? '保存设备' : 'Save equipment'}</button>
    </div>
  </div>`;
}

function initEquipmentModal() {
  document.getElementById('equipTypes')?.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('.chip') as HTMLElement;
    if (!chip) return;
    chip.classList.toggle('active');
    const type = chip.dataset.type;
    if (type === 'binocular') toggle('binocularFields', chip.classList.contains('active'));
    if (type === 'telescope') toggle('telescopeFields', chip.classList.contains('active'));
    if (type === 'camera') toggle('cameraFields', chip.classList.contains('active'));
  });

  document.getElementById('saveEquipment')?.addEventListener('click', () => {
    const activeChips = document.querySelectorAll('#equipTypes .chip.active');
    const labels = [...activeChips].map(c => c.textContent?.trim() || '').filter(Boolean);
    const summary = labels.slice(0, 2).join(' + ') || 'Naked eye';
    const items = labels.map((l, i) => ({ id: `eq-${i}`, type: 'naked_eye' as const, label: l }));
    if (items.length === 0) items.push({ id: 'naked', type: 'naked_eye', label: 'Naked eye' });
    updateContext({ equipment: { items, primary: items[0].id } });
    persistContext();
    closeModal('equipmentModal');
    toast(t('general.equipSaved'));
  });

  document.getElementById('equipmentModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('equipmentModal')) closeModal('equipmentModal');
  });
}

// ===== Contribution Modal =====
let contributeSiteName = '';

function createContributionModal(): string {
  const isZh = (ctx.language || 'zh') === 'zh';
  const fieldHtml = CONTRIBUTION_FIELDS.map(f => {
    if (f.type === 'select' && f.options) {
      const opts = f.options.map(o => `<option value="${o.value}">${isZh ? o.labelZh : o.labelEn}</option>`).join('');
      return `<div class="field"><label>${isZh ? f.labelZh : f.labelEn}</label><select id="contrib_${f.key}" data-field="${f.key}">${opts}</select></div>`;
    }
    if (f.type === 'rating') {
      return `<div class="field"><label>${isZh ? f.labelZh : f.labelEn}</label>
        <div class="segment" id="contrib_${f.key}_seg">
          <button class="seg" data-val="1">1</button><button class="seg" data-val="2">2</button>
          <button class="seg active" data-val="3">3</button><button class="seg" data-val="4">4</button>
          <button class="seg" data-val="5">5</button>
        </div></div>`;
    }
    // text
    return `<div class="field"><label>${isZh ? f.labelZh : f.labelEn}</label><textarea id="contrib_${f.key}" data-field="${f.key}" rows="2" placeholder="${isZh ? '可选...' : 'Optional...'}"></textarea></div>`;
  }).join('');

  return `
  <div id="contributionModal" class="modal">
    <div class="sheet">
      <div class="handle"></div>
      <div class="row">
        <div><div class="page-sub">${isZh ? '暗夜地点' : 'Dark Site'}</div><h2>${isZh ? '贡献地点报告' : 'Contribute site report'}</h2></div>
        <button class="back-btn" onclick="document.getElementById('contributionModal').classList.remove('show')">✕</button>
      </div>
      <div id="contribSiteName" style="margin-bottom:12px;font-weight:800;font-size:15px;color:var(--blue)"></div>
      ${fieldHtml}
      <button class="primary-btn" id="submitContribution">${isZh ? '提交报告' : 'Submit report'}</button>
    </div>
  </div>`;
}

function initContributionModal() {
  // Rating segments
  CONTRIBUTION_FIELDS.filter(f => f.type === 'rating').forEach(f => {
    const segId = `contrib_${f.key}_seg`;
    document.getElementById(segId)?.addEventListener('click', (e) => {
      const seg = (e.target as HTMLElement).closest('.seg') as HTMLElement;
      if (!seg) return;
      document.querySelectorAll(`#${segId} .seg`).forEach(s => s.classList.remove('active'));
      seg.classList.add('active');
    });
  });

  // Submit
  document.getElementById('submitContribution')?.addEventListener('click', () => {
    const isZh = (ctx.language || 'zh') === 'zh';
    const fields: { key: string; value: string }[] = [];

    CONTRIBUTION_FIELDS.forEach(f => {
      if (f.type === 'rating') {
        const active = document.querySelector(`#contrib_${f.key}_seg .seg.active`) as HTMLElement;
        if (active) fields.push({ key: f.key, value: active.dataset.val || '3' });
      } else {
        const el = document.getElementById(`contrib_${f.key}`) as HTMLSelectElement | HTMLTextAreaElement;
        if (el?.value) fields.push({ key: f.key, value: el.value });
      }
    });

    // Validate
    const validation = validateContribution(fields as any, ctx.language || 'zh');
    if (!validation.valid) {
      toast(validation.errors[0]);
      return;
    }

    // Find site data (search across hardcoded + API-loaded places)
    const allPlaces = getAllPlaces();
    const site = allPlaces.find(p => p.name === contributeSiteName) || DARK_SKY_PLACES.find(p => p.name === contributeSiteName);
    if (!site) {
      toast(isZh ? '地点未找到' : 'Site not found');
      return;
    }

    // Submit
    const visitType = (fields.find(f => f.key === 'visitType')?.value || 'onsite') as 'onsite' | 'past_visit';
    submitContribution(
      site.name, site.lat, site.lon,
      fields as any, visitType
    );

    closeModal('contributionModal');
    toast(isZh ? '报告已提交！等待确认中' : 'Report submitted! Pending confirmation.');
  });

  // Close on backdrop click
  document.getElementById('contributionModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('contributionModal')) closeModal('contributionModal');
  });
}

// Expose contribute function for pages to call
(window as any).openContributionModal = (siteName: string) => {
  contributeSiteName = siteName;
  const nameEl = document.getElementById('contribSiteName');
  if (nameEl) nameEl.textContent = siteName;
  openModal('contributionModal');
};

function toggle(id: string, show: boolean) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'block' : 'none';
}

// ===== Status Bar =====
function updateStatusBar() {
  const el = document.getElementById('statusTime');
  if (el) {
    const now = new Date();
    el.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }
}

// ===== Init =====
async function init() {
  restoreContext();

  // Try GPS
  try {
    const gpsLoc = await getGPSLocation();
    updateContext({ location: { ...gpsLoc, id: 'current-gps' } });
  } catch {
    const saved = getCurrentLocation();
    updateContext({ location: saved });
  }
  persistContext();

  // Render modals (appended once)
  const app = document.getElementById('app');
  if (app) {
    app.insertAdjacentHTML('beforeend', createDateModal());
    app.insertAdjacentHTML('beforeend', createEquipmentModal());
    app.insertAdjacentHTML('beforeend', createContributionModal());
  }
  initEquipmentModal();
  initContributionModal();

  // 异步加载后端天体目录 + 附近站点（不阻塞首屏渲染）
  loadCelestialCatalog().then(() => {
    // catalog 加载完成后刷新当前页面
    renderCurrentPage();
  });
  loadApiSites(ctx.location.lat, ctx.location.lon).then(() => {
    renderCurrentPage();
  });

  // Tab bar
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      const tab = (t as HTMLElement).dataset.tab as TabId;
      if (tab) switchTab(tab);
    });
  });

  // Initial render
  updateTabBarLabels();
  renderCurrentPage();
  updateStatusBar();
  setInterval(updateStatusBar, 30000);
}

init();
