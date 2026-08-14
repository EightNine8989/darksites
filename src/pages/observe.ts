// ===== Observe Page — 观测贴士 + 观测日记 + 日历打卡 =====
import { ctx, onContextChange, formatDateShort, equipmentSummary } from '../lib/context';
import { t } from '../lib/i18n';
import { computeMoonPhase, computeSunInfo } from '../lib/astronomy';
import type { DiaryEntry, CalendarEvent } from '../types';

// ===== Diary Persistence =====
const DIARY_KEY = 'ds_diary_entries';
const OBSERVED_KEY = 'ds_observed_dates';

/** 本地时区的 YYYY-MM-DD（避免 toISOString 的 UTC 偏移导致日期差一天） */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadDiaries(): DiaryEntry[] {
  try { return JSON.parse(localStorage.getItem(DIARY_KEY) || '[]'); } catch { return []; }
}

function saveDiaries(entries: DiaryEntry[]) {
  localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
}

function loadObservedDates(): string[] {
  try { return JSON.parse(localStorage.getItem(OBSERVED_KEY) || '[]'); } catch { return []; }
}

function addObservedDate(dateStr: string) {
  const dates = loadObservedDates();
  if (!dates.includes(dateStr)) {
    dates.push(dateStr);
    localStorage.setItem(OBSERVED_KEY, JSON.stringify(dates));
  }
}

// ===== Calendar Events (static astronomical events for 2026) =====
const CALENDAR_EVENTS: CalendarEvent[] = [
  { date: '2026-08-12', type: 'meteor', name: 'Perseids peak', nameZh: '英仙座流星雨极大' },
  { date: '2026-08-20', type: 'eclipse', name: 'Partial lunar eclipse', nameZh: '月偏食' },
  { date: '2026-08-22', type: 'conjunction', name: 'Jupiter–Mars conjunction', nameZh: '木星合火星' },
  { date: '2026-08-24', type: 'meteor', name: 'Aurigids', nameZh: '御夫座流星雨' },
  { date: '2026-08-29', type: 'moon', name: 'Full Moon', nameZh: '满月' },
  { date: '2026-09-07', type: 'moon', name: 'New Moon', nameZh: '新月' },
  { date: '2026-09-22', type: 'conjunction', name: 'Jupiter at opposition', nameZh: '木星冲日' },
  { date: '2026-10-07', type: 'moon', name: 'Full Moon', nameZh: '满月' },
  { date: '2026-10-21', type: 'meteor', name: 'Orionids peak', nameZh: '猎户座流星雨极大' },
  { date: '2026-11-07', type: 'moon', name: 'New Moon', nameZh: '新月' },
  { date: '2026-11-17', type: 'meteor', name: 'Leonids peak', nameZh: '狮子座流星雨极大' },
  { date: '2026-12-14', type: 'meteor', name: 'Geminids peak', nameZh: '双子座流星雨极大' },
  { date: '2026-12-25', type: 'moon', name: 'New Moon', nameZh: '新月' },
];

// ===== Tips Generation =====
interface TipData {
  icon: string;
  iconColor: string;
  title: string;
  text: string;
}

function generateTips(): TipData[] {
  const isZh = (ctx.language || 'zh') === 'zh';
  const tips: TipData[] = [];
  const loc = ctx.location;
  const obsDate = new Date(ctx.date);
  obsDate.setHours(22, 0, 0, 0); // approximate observation time

  try {
    const moonInfo = computeMoonPhase(obsDate, loc);
    const sunInfo = computeSunInfo(obsDate, loc);

    // Tip 1: Moon info
    if (moonInfo.setTime && moonInfo.setTime !== '—') {
      const moonDesc = isZh
        ? `${moonInfo.phaseName}，照明度 ${Math.round(moonInfo.illumination * 100)}%。月落后天空完全黑暗，适合深空和银河观测。`
        : `${moonInfo.phaseName}, ${Math.round(moonInfo.illumination * 100)}% illuminated. After moonset the sky will be fully dark — ideal for deep sky and Milky Way.`;
      tips.push({
        icon: '☽', iconColor: 'var(--warn)',
        title: isZh ? `月落 ${moonInfo.setTime}` : `Moon sets at ${moonInfo.setTime}`,
        text: moonDesc
      });
    } else if (moonInfo.illumination < 0.15) {
      tips.push({
        icon: '☽', iconColor: 'var(--good)',
        title: isZh ? '今夜无月光干扰' : 'No moon interference tonight',
        text: isZh
          ? '新月期间，天空完全黑暗，是深空和银河观测的绝佳时机。'
          : 'Dark sky tonight — perfect for deep sky and Milky Way observations.'
      });
    }

    // Tip 2: Astronomical dusk
    if (sunInfo.astronomicalDusk && sunInfo.astronomicalDusk !== '—') {
      tips.push({
        icon: '🌤', iconColor: 'var(--good)',
        title: isZh ? `天文昏影终 ${sunInfo.astronomicalDusk}` : `Astro dusk at ${sunInfo.astronomicalDusk}`,
        text: isZh
          ? `天文昏影结束后天空完全黑暗。建议提前 30 分钟到达，让眼睛适应暗环境。`
          : `Full darkness after astronomical dusk. Arrive 30 min early for dark adaptation.`
      });
    }
  } catch {
    // Astronomy calculation failed — skip
  }

  // Tip 3: Equipment tip
  const equip = equipmentSummary();
  if (equip.toLowerCase().includes('binocular') || equip.includes('10×50') || equip.includes('双筒')) {
    tips.push({
      icon: '🔭', iconColor: 'var(--blue)',
      title: isZh ? '双筒镜贴士' : 'Binocular tip',
      text: isZh
        ? '使用三脚架固定双筒镜可大幅提升稳定性。用侧视法观察暗弱天体——视线略偏目标方向观察效果更佳。'
        : 'Mount on a tripod for steady scanning. Use averted vision for faint objects — look slightly to the side of the target.'
    });
  } else if (equip.toLowerCase().includes('telescope') || equip.includes('望远镜')) {
    tips.push({
      icon: '🔭', iconColor: 'var(--blue)',
      title: isZh ? '望远镜贴士' : 'Telescope tip',
      text: isZh
        ? '先用低倍目镜找到目标，再切换高倍。让望远镜热平衡 20–30 分钟以减少气流扰动。'
        : 'Start with low power to find targets, then switch to high power. Let the scope cool down 20–30 min to reduce tube currents.'
    });
  } else {
    tips.push({
      icon: '🔭', iconColor: 'var(--blue)',
      title: isZh ? '肉眼观测贴士' : 'Naked eye tip',
      text: isZh
        ? '暗适应至少 20 分钟后开始观测。避免看手机屏幕——红光手电是唯一光源。'
        : 'Allow at least 20 min for dark adaptation. Avoid phone screens — use only red light.'
    });
  }

  // Tip 4: Check for upcoming events
  const today = toLocalDateStr(ctx.date);
  const upcomingEvent = CALENDAR_EVENTS.find(e => e.date >= today);
  if (upcomingEvent) {
    const dayOffset = Math.round((new Date(upcomingEvent.date).getTime() - ctx.date.getTime()) / 86400000);
    const dayLabel = dayOffset === 0
      ? (isZh ? '今晚' : 'Tonight')
      : dayOffset === 1
        ? (isZh ? '明天' : 'Tomorrow')
        : (isZh ? `${dayOffset} 天后` : `In ${dayOffset} days`);

    tips.push({
      icon: '✦', iconColor: 'var(--purple)',
      title: isZh ? upcomingEvent.nameZh : upcomingEvent.name,
      text: isZh
        ? `${dayLabel}。${upcomingEvent.type === 'meteor' ? '无需设备，肉眼最佳。面朝辐射点方向仰卧观测。' : upcomingEvent.type === 'eclipse' ? '注意观测时间和安全防护。' : '关注天象发生时间，提前规划观测位置。'}`
        : `${dayLabel}. ${upcomingEvent.type === 'meteor' ? 'No equipment needed — naked eye is best. Lie back facing the radiant.' : upcomingEvent.type === 'eclipse' ? 'Check timing and use proper eye protection.' : 'Check timing and plan your observing spot.'}`
    });
  }

  // Tip 5: Dew warning (simplified — based on season)
  const month = ctx.date.getMonth();
  if (month >= 5 && month <= 9) {
    tips.push({
      icon: '🌡', iconColor: 'var(--warn)',
      title: isZh ? '露水警告' : 'Dew warning',
      text: isZh
        ? '夏秋季节露水较重。为双筒镜或镜头准备露水加热带，或用暖手贴+橡皮筋简易防露。'
        : 'Dew can be heavy in this season. Bring a dew heater for your optics, or use hand warmers + rubber bands.'
    });
  }

  // Fallback
  if (tips.length === 0) {
    tips.push({
      icon: '✦', iconColor: 'var(--blue)',
      title: isZh ? '加载中...' : 'Loading...',
      text: t('observe.tip.noData')
    });
  }

  return tips;
}

// ===== Render: Tips Section =====
function renderTips(): string {
  const tips = generateTips();
  return tips.map(tip => `
    <div class="tip-card">
      <div class="tip-icon" style="color:${tip.iconColor}">${tip.icon}</div>
      <div class="tip-body">
        <div class="tip-title">${tip.title}</div>
        <div class="tip-text">${tip.text}</div>
      </div>
    </div>
  `).join('');
}

// ===== Render: Diary Section =====
function renderDiarySection(): string {
  const diaries = loadDiaries();
  const isZh = (ctx.language || 'zh') === 'zh';

  if (diaries.length === 0) {
    return `<div class="card"><p style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0">${t('observe.noDiary')}</p></div>`;
  }

  return diaries.slice(0, 10).map(d => {
    const photoHtml = d.photos.length
      ? `<div class="diary-photos">${d.photos.map(p => `<div class="diary-photo" style="background-image:url(${p});background-size:cover"></div>`).join('')}</div>`
      : '';
    return `
    <div class="diary-card">
      <div class="diary-head">
        <div class="diary-dot"></div>
        <span class="diary-date">${d.date} · ${d.time}</span>
        <span class="diary-place">${d.locationName}</span>
      </div>
      <div class="diary-text">${d.text}</div>
      ${photoHtml}
    </div>`;
  }).join('');
}

// ===== Render: Calendar Section =====
function renderCalendar(): string {
  const isZh = (ctx.language || 'zh') === 'zh';
  const year = ctx.date.getFullYear();
  const month = ctx.date.getMonth(); // 0-based
  const today = new Date();

  const monthNamesZh = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  const monthNamesEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthTitle = isZh ? `${year}年${monthNamesZh[month]}` : `${monthNamesEn[month]} ${year}`;

  const dayHeadersZh = ['一','二','三','四','五','六','日'];
  const dayHeadersEn = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  const dayHeaders = isZh ? dayHeadersZh : dayHeadersEn;

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1; // Mon-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build event map for this month
  const eventMap = new Map<string, CalendarEvent>();
  CALENDAR_EVENTS.forEach(e => {
    const d = new Date(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      eventMap.set(String(d.getDate()), e);
    }
  });

  // Build observed dates set
  const observedDates = loadObservedDates();
  const observedSet = new Set<string>();

  observedDates.forEach(d => {
    const parts = d.split('-');
    if (parseInt(parts[0]) === year && parseInt(parts[1]) - 1 === month) {
      observedSet.add(parts[2]);
    }
  });

  let calDays = '';
  // Empty cells before first day
  for (let i = 0; i < adjustedFirst; i++) {
    calDays += '<div class="cal-day empty"></div>';
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const event = eventMap.get(String(d));
    const isObserved = observedSet.has(String(d).padStart(2, '0'));

    let classes = 'cal-day';
    if (isToday) classes += ' today';
    if (isObserved) classes += ' checked';
    if (event) {
      classes += ` has-event e-${event.type}`;
    }

    calDays += `<div class="${classes}">${d}</div>`;
  }

  return `
  <div class="section">
    <h3>${monthTitle}</h3>
    <span style="color:var(--muted);font-size:12px">${isZh ? '点按日期标记观测' : 'Tap a date to mark observed'}</span>
  </div>
  <div class="card" style="padding:12px">
    <div class="cal">
      ${dayHeaders.map(d => `<div class="cal-head">${d}</div>`).join('')}
      ${calDays}
    </div>
    <div class="cal-legend">
      <span><i style="background:var(--warn)"></i>${t('observe.meteor')}</span>
      <span><i style="background:var(--bad)"></i>${t('observe.eclipse')}</span>
      <span><i style="background:var(--purple)"></i>${t('observe.conjunction')}</span>
      <span><i style="background:var(--good)"></i>${t('observe.moonPhase')}</span>
      <span><i style="background:rgba(127,221,169,.3)"></i>${t('observe.observed')}</span>
    </div>
  </div>`;
}

// ===== New Diary Modal =====
function renderNewDiaryModal(): string {
  return `
  <div id="newDiaryModal" class="modal">
    <div class="sheet">
      <div class="handle"></div>
      <div class="row">
        <div><div class="page-sub">${t('observe.journal')}</div><h2>${t('observe.diaryModalTitle')}</h2></div>
        <button class="back-btn" onclick="document.getElementById('newDiaryModal').classList.remove('show')">✕</button>
      </div>
      <div class="field">
        <label>${(ctx.language || 'zh') === 'zh' ? '日期' : 'Date'}</label>
        <input id="diaryDate" type="date" value="${toLocalDateStr(ctx.date)}">
      </div>
      <div class="field">
        <label>${(ctx.language || 'zh') === 'zh' ? '时间' : 'Time'}</label>
        <input id="diaryTime" type="time" value="22:00">
      </div>
      <div class="field">
        <label>${(ctx.language || 'zh') === 'zh' ? '地点' : 'Location'}</label>
        <input id="diaryLocation" type="text" value="${ctx.location.name}" placeholder="${(ctx.language || 'zh') === 'zh' ? '观测地点' : 'Observing location'}">
      </div>
      <div class="field">
        <label>${(ctx.language || 'zh') === 'zh' ? '观测记录' : 'Observation notes'}</label>
        <textarea id="diaryText" rows="4" placeholder="${t('observe.diaryPlaceholder')}" style="width:100%;border:1px solid var(--line);border-radius:13px;background:#0b1422;color:#fff;padding:11px 12px;outline:none;font-size:14px;resize:vertical"></textarea>
      </div>
      <button class="primary-btn" id="saveDiaryBtn">${t('observe.saveEntry')}</button>
    </div>
  </div>`;
}

// ===== Main Render =====
export function renderObservePage(): string {
  const dateStr = formatDateShort();
  const equipStr = equipmentSummary();

  return `
  <div class="page-top">
    <div>
      <div class="page-sub">${t('observe.sub')}</div>
      <h1>${t('observe.title')}</h1>
    </div>
    <button class="icon-btn" onclick="window.openModal('equipmentModal')">⚙︎</button>
  </div>

  <!-- Context bar -->
  <div class="date-bar">
    <button class="date-btn" onclick="window.openModal('dateModal')">
      <strong>${dateStr} · ${ctx.startTime}</strong>
      <span>${(ctx.language || 'zh') === 'zh' ? '观测日期' : 'Observation date'}</span>
    </button>
    <button class="date-btn" onclick="window.openModal('equipmentModal')">
      <strong>${equipStr}</strong>
      <span>${(ctx.language || 'zh') === 'zh' ? '当前设备' : 'Current equipment'}</span>
    </button>
  </div>

  <!-- Tips -->
  <div class="hero-card">
    <h2>${t('observe.tipsTitle')}</h2>
    <p>${t('observe.tipsDesc')}</p>
  </div>
  ${renderTips()}

  <!-- Journal -->
  <div class="section">
    <h3>${t('observe.journal')}</h3>
    <button style="border:0;background:transparent;color:var(--blue);font-size:12px;padding:0" onclick="window.openNewDiaryModal()">${t('observe.newEntry')}</button>
  </div>
  ${renderDiarySection()}

  <!-- Calendar -->
  ${renderCalendar()}

  <!-- New Diary Modal -->
  ${renderNewDiaryModal()}
  `;
}

// ===== Init =====
// Context listener (unregistered on re-init to avoid duplicates)
let unsubObserveContext: (() => void) | null = null;

export function initObservePage() {
  // Context change (date/time/equipment/language) → re-render the whole page
  if (unsubObserveContext) unsubObserveContext();
  unsubObserveContext = onContextChange(() => {
    const container = document.getElementById('pageContainer');
    if (!container) return;
    container.innerHTML = renderObservePage();
    initObservePage();
  });

  // Calendar day click — toggle observed
  document.querySelectorAll('.cal-day:not(.empty)').forEach(el => {
    el.addEventListener('click', () => {
      const dayEl = el as HTMLElement;
      const dayNum = dayEl.textContent?.trim();
      if (!dayNum || isNaN(Number(dayNum))) return;

      const year = ctx.date.getFullYear();
      const month = ctx.date.getMonth() + 1;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      const observed = loadObservedDates();
      if (observed.includes(dateStr)) {
        const idx = observed.indexOf(dateStr);
        observed.splice(idx, 1);
        localStorage.setItem(OBSERVED_KEY, JSON.stringify(observed));
        dayEl.classList.remove('checked');
      } else {
        addObservedDate(dateStr);
        dayEl.classList.add('checked');
      }
    });
  });

  // Save diary button
  document.getElementById('saveDiaryBtn')?.addEventListener('click', () => {
    const dateInput = document.getElementById('diaryDate') as HTMLInputElement;
    const timeInput = document.getElementById('diaryTime') as HTMLInputElement;
    const locInput = document.getElementById('diaryLocation') as HTMLInputElement;
    const textInput = document.getElementById('diaryText') as HTMLTextAreaElement;

    if (!textInput?.value.trim()) return;

    const entry: DiaryEntry = {
      id: `d-${Date.now()}`,
      date: dateInput?.value || toLocalDateStr(ctx.date),
      time: timeInput?.value || '22:00',
      locationName: locInput?.value || ctx.location.name,
      text: textInput.value.trim(),
      photos: [],
      createdAt: new Date().toISOString()
    };

    const diaries = loadDiaries();
    diaries.unshift(entry);
    saveDiaries(diaries);

    // Also mark this date as observed
    addObservedDate(entry.date);

    // Close modal and re-render
    const modal = document.getElementById('newDiaryModal');
    if (modal) modal.classList.remove('show');

    // Toast
    if ((window as any).toast) (window as any).toast(t('observe.entrySaved'));

    // Re-render observe page
    const container = document.getElementById('pageContainer');
    if (container) {
      container.innerHTML = renderObservePage();
      initObservePage();
    }
  });

  // Close modal on backdrop
  document.getElementById('newDiaryModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('newDiaryModal')) {
      document.getElementById('newDiaryModal')?.classList.remove('show');
    }
  });

  // Expose openNewDiaryModal
  (window as any).openNewDiaryModal = () => {
    const modal = document.getElementById('newDiaryModal');
    if (modal) modal.classList.add('show');
  };
}
