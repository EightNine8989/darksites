// ===== Dark Sites 2.0 Main Entry =====
import './styles/global.css';
import { ctx, restoreContext, persistContext, updateContext, onContextChange } from './lib/context';
import { getCurrentLocation, getGPSLocation } from './lib/location';
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
  // Update tab bar
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', (t as HTMLElement).dataset.tab === tab);
  });
  updateTabBarVisibility();
}

function updateTabBarVisibility() {
  const tabBar = document.getElementById('tabBar');
  if (!tabBar) return;
  const route = navStack[navStack.length - 1];
  // Show tab bar only on tab pages
  const isTabPage = route.type === 'tab';
  tabBar.style.display = isTabPage ? 'flex' : 'none';
}

function renderCurrentPage() {
  const route = navStack[navStack.length - 1];
  renderRoute(route);
}

function renderRoute(route: PageRoute) {
  const container = document.getElementById('pageContainer');
  if (!container) return;
  container.scrollTop = 0; // scroll to top on navigation

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

// Profile placeholder removed — now uses renderProfilePage from pages/profile.ts

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
        <div><div class="page-sub">Observation time</div><h2>Date & time</h2></div>
        <button class="back-btn" onclick="document.getElementById('dateModal').classList.remove('show')">✕</button>
      </div>
      <div class="field"><label>Date</label><input id="dateInput" type="date" value="${today}"></div>
      <div class="field"><label>Start time</label><input id="timeInput" type="time" value="${ctx.startTime}"></div>
      <div class="segment" id="planMode">
        <button class="seg active" data-mode="single">Single night</button>
        <button class="seg" data-mode="weekend">Weekend</button>
        <button class="seg" data-mode="month">Any date this month</button>
      </div>
      <button class="primary-btn" id="applyDate">Apply & recalculate</button>
    </div>
  </div>`;
}

function initDateModal() {
  // Plan mode segment
  document.getElementById('planMode')?.addEventListener('click', (e) => {
    const seg = (e.target as HTMLElement).closest('.seg') as HTMLElement;
    if (!seg) return;
    document.querySelectorAll('#planMode .seg').forEach(s => s.classList.remove('active'));
    seg.classList.add('active');
    updateContext({ planningMode: seg.dataset.mode as any });
  });

  // Apply date
  document.getElementById('applyDate')?.addEventListener('click', () => {
    const dateInput = document.getElementById('dateInput') as HTMLInputElement;
    const timeInput = document.getElementById('timeInput') as HTMLInputElement;
    if (dateInput?.value) {
      updateContext({ date: new Date(dateInput.value + 'T00:00:00'), startTime: timeInput?.value || '22:00' });
      persistContext();
    }
    closeModal('dateModal');
    toast('Date applied · recalculating...');
  });

  // Click backdrop to close
  document.getElementById('dateModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('dateModal')) closeModal('dateModal');
  });
}

// ===== Equipment Modal =====
function createEquipmentModal(): string {
  return `
  <div id="equipmentModal" class="modal">
    <div class="sheet">
      <div class="handle"></div>
      <div class="row">
        <div><div class="page-sub">Observer profile</div><h2>Observation equipment</h2></div>
        <button class="back-btn" onclick="document.getElementById('equipmentModal').classList.remove('show')">✕</button>
      </div>
      <div class="field">
        <label>Equipment types</label>
        <div class="chips" id="equipTypes">
          <button class="chip active" data-type="naked">Naked eye</button>
          <button class="chip" data-type="binocular">Binoculars</button>
          <button class="chip" data-type="telescope">Telescope</button>
          <button class="chip" data-type="camera">Camera</button>
          <button class="chip" data-type="phone">Phone</button>
        </div>
      </div>
      <div id="binocularFields" style="display:none">
        <div class="page-sub" style="margin:8px 0 4px">Binoculars</div>
        <div class="grid-2">
          <div class="field"><label>Magnification</label><input value="10×"></div>
          <div class="field"><label>Aperture</label><input value="50 mm"></div>
        </div>
      </div>
      <div id="telescopeFields" style="display:none">
        <div class="page-sub" style="margin:8px 0 4px">Telescope</div>
        <div class="field"><label>Type</label>
          <select><option>Refractor</option><option>Reflector / Dobsonian</option><option>SCT / Maksutov</option><option>Smart telescope</option></select>
        </div>
        <div class="grid-2">
          <div class="field"><label>Aperture</label><input placeholder="150 mm"></div>
          <div class="field"><label>Focal length</label><input placeholder="750 mm"></div>
        </div>
      </div>
      <div id="cameraFields" style="display:none">
        <div class="page-sub" style="margin:8px 0 4px">Camera</div>
        <div class="field"><label>Sensor</label>
          <select><option>Full frame</option><option>APS-C</option><option>Micro Four Thirds</option><option>1-inch</option></select>
        </div>
        <div class="grid-2">
          <div class="field"><label>Lens focal length</label><input value="24 mm"></div>
          <div class="field"><label>Max aperture</label><input value="f/1.8"></div>
        </div>
        <div class="segment" id="trackingSeg">
          <button class="seg active" data-track="none">None</button>
          <button class="seg" data-track="tracker">Star tracker</button>
          <button class="seg" data-track="eq">Equatorial mount</button>
        </div>
      </div>
      <button class="primary-btn" id="saveEquipment">Save equipment</button>
    </div>
  </div>`;
}

function initEquipmentModal() {
  // Toggle equipment type chips
  document.getElementById('equipTypes')?.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('.chip') as HTMLElement;
    if (!chip) return;
    chip.classList.toggle('active');
    const type = chip.dataset.type;
    // Show/hide fields
    if (type === 'binocular') toggle('binocularFields', chip.classList.contains('active'));
    if (type === 'telescope') toggle('telescopeFields', chip.classList.contains('active'));
    if (type === 'camera') toggle('cameraFields', chip.classList.contains('active'));
  });

  // Save
  document.getElementById('saveEquipment')?.addEventListener('click', () => {
    const activeChips = document.querySelectorAll('#equipTypes .chip.active');
    const labels = [...activeChips].map(c => c.textContent?.trim() || '').filter(Boolean);
    const summary = labels.slice(0, 2).join(' + ') || 'Naked eye';
    const items = labels.map((l, i) => ({ id: `eq-${i}`, type: 'naked_eye' as const, label: l }));
    if (items.length === 0) items.push({ id: 'naked', type: 'naked_eye', label: 'Naked eye' });
    updateContext({ equipment: { items, primary: items[0].id } });
    persistContext();
    closeModal('equipmentModal');
    toast('Equipment saved');
  });

  // Backdrop close
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
    // Fall back to saved location
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
  renderCurrentPage();
  updateStatusBar();
  setInterval(updateStatusBar, 30000);
}

init();
