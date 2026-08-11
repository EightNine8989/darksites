// ===== Dark Sites 2.0 Main Entry =====
import './styles/global.css';
import { ctx, restoreContext, persistContext, updateContext, onContextChange } from './lib/context';
import { getCurrentLocation, getGPSLocation } from './lib/location';
import { t } from './lib/i18n';
import { renderSitesPage, initSitesPage } from './pages/sites';
import { renderObjectsPage, initObjectsPage } from './pages/objects';
import { renderObjectDetailPage, initObjectDetailPage } from './pages/object-detail';
import { renderPlaceDetailPage, initPlaceDetailPage } from './pages/place-detail';
import { renderProfilePage, initProfilePage } from './pages/profile';

// ===== Navigation Stack =====
type PageRoute = { type: 'tab'; tab: TabId } | { type: 'object-detail'; id: string } | { type: 'place-detail'; id: string };
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

function navigateTo(type: string, id: string) {
  if (type === 'object-detail') pushRoute({ type: 'object-detail', id });
  else if (type === 'place-detail') pushRoute({ type: 'place-detail', id });
}

function navigateBack() {
  popRoute();
}

// Expose globally for detail pages
(window as any).navigateTo = navigateTo;
(window as any).navigateBack = navigateBack;

// ===== Tab Routing =====
type TabId = 'sites' | 'objects' | 'profile';
let currentTab: TabId = 'sites';
let tabInited: Record<TabId, boolean> = { sites: false, objects: false, profile: false };

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
  }
}

// ===== Modal System =====
function openModal(id: string) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('show');
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

// ===== Date Modal =====
function createDateModal(): string {
  const today = ctx.date.toISOString().split('T')[0];
  return `
  <div id="dateModal" class="modal">
    <div class="sheet">
      <div class="handle"></div>
      <div class="row">
        <div><div class="page-sub">${t('general.obsTime')}</div><h2>${t('general.dateAndTime')}</h2></div>
        <button class="back-btn" onclick="document.getElementById('dateModal').classList.remove('show')">✕</button>
      </div>
      <div class="field"><label>${ctx.language === 'zh' ? '日期' : 'Date'}</label><input id="dateInput" type="date" value="${today}"></div>
      <div class="field"><label>${ctx.language === 'zh' ? '开始时间' : 'Start time'}</label><input id="timeInput" type="time" value="${ctx.startTime}"></div>
      <div class="segment" id="planMode">
        <button class="seg active" data-mode="single">${t('general.singleNight')}</button>
        <button class="seg" data-mode="weekend">${t('general.weekend')}</button>
        <button class="seg" data-mode="month">${t('general.anyMonth')}</button>
      </div>
      <button class="primary-btn" id="applyDate">${t('general.apply')}</button>
    </div>
  </div>`;
}

function initDateModal() {
  document.getElementById('planMode')?.addEventListener('click', (e) => {
    const seg = (e.target as HTMLElement).closest('.seg') as HTMLElement;
    if (!seg) return;
    document.querySelectorAll('#planMode .seg').forEach(s => s.classList.remove('active'));
    seg.classList.add('active');
    updateContext({ planningMode: seg.dataset.mode as any });
  });

  document.getElementById('applyDate')?.addEventListener('click', () => {
    const dateInput = document.getElementById('dateInput') as HTMLInputElement;
    const timeInput = document.getElementById('timeInput') as HTMLInputElement;
    if (dateInput?.value) {
      updateContext({ date: new Date(dateInput.value + 'T00:00:00'), startTime: timeInput?.value || '22:00' });
      persistContext();
    }
    closeModal('dateModal');
    toast(t('general.dateApplied'));
  });

  document.getElementById('dateModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('dateModal')) closeModal('dateModal');
  });
}

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
  }
  initDateModal();
  initEquipmentModal();

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
