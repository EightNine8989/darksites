// ===== i18n 国际化 =====
// 支持 zh / en 双语，所有 UI 文字集中管理
import { ctx } from './context';

type Lang = 'zh' | 'en';

// ===== Translation Map =====
const translations: Record<string, Record<Lang, string>> = {
  // === Tab Bar ===
  'tab.sites':     { zh: '地点', en: 'Sites' },
  'tab.objects':   { zh: '天体', en: 'Objects' },
  'tab.profile':   { zh: '我的', en: 'Profile' },

  // === Sites Page ===
  'sites.sub':           { zh: '今晚往哪看', en: 'Where to look tonight' },
  'sites.title':         { zh: '地点', en: 'Sites' },
  'sites.heroTitle':     { zh: '往这个方向看', en: 'Look this way' },
  'sites.heroDesc':      { zh: '每个方向显示今晚可见天体。评分随日期、月相、天气和设备变化。', en: 'Each direction shows what\'s visible tonight. Scores change with date, Moon, weather and your equipment.' },
  'sites.search':        { zh: '搜索天体', en: 'Search object' },
  'sites.nearby':        { zh: '附近暗夜地点', en: 'Nearby dark sites' },
  'sites.forDate':        { zh: '观测日期', en: 'For' },
  'sites.changeDate':    { zh: '切换日期和时间', en: 'Change date & time' },
  'sites.yourEquip':     { zh: '你的设备', en: 'Your equipment' },
  'sites.directionObj':  { zh: '个天体可见', en: 'objects visible' },
  'sites.noObjects':     { zh: '此方向今晚无明亮天体', en: 'No bright objects in this direction tonight' },
  'sites.noSites':       { zh: '附近无已知暗夜地点', en: 'No known dark sites nearby' },

  // === Chip Filters ===
  'filter.all':       { zh: '全部', en: 'All' },
  'filter.milkyway':  { zh: '银河', en: 'Milky Way' },
  'filter.meteor':    { zh: '流星雨', en: 'Meteor Shower' },
  'filter.moon':       { zh: '月亮', en: 'Moon' },
  'filter.planets':    { zh: '行星', en: 'Planets' },
  'filter.stars':      { zh: '恒星', en: 'Stars' },
  'filter.deepSky':    { zh: '深空天体', en: 'Deep Sky' },

  // === Objects Page ===
  'objects.sub':       { zh: '今晚看什么', en: 'What is worth seeing?' },
  'objects.title':     { zh: '天体', en: 'Objects' },
  'objects.heroTitle': { zh: '规划你的观测', en: 'Plan your observation' },
  'objects.heroDesc':  { zh: '浏览今晚所有可见天体，按高度角、亮度或名称排序，按类型或设备筛选。', en: 'Browse all visible objects tonight. Sort by altitude, brightness, or name. Filter by type or your equipment.' },
  'objects.search':    { zh: '搜索恒星、行星、星云...', en: 'Search star, planet, nebula...' },
  'objects.noMatch':   { zh: '无匹配天体，试试其他筛选', en: 'No objects match your filter. Try a different category or search.' },
  'objects.sortAlt':   { zh: '高度角', en: 'Altitude' },
  'objects.sortMag':   { zh: '亮度', en: 'Brightness' },
  'objects.sortName':  { zh: '名称', en: 'Name' },
  'objects.sortedBy':  { zh: '排序：', en: 'Sorted by ' },
  'objects.objects':   { zh: '个天体', en: 'objects' },
  'objects.belowHorizon': { zh: '地平线下', en: 'Below horizon' },
  'objects.lowSeason': { zh: '淡季', en: 'Low season' },
  'objects.bestSeason': { zh: '旺季', en: 'Best season' },

  // === Object Detail ===
  'objDetail.seasonVis':   { zh: '季节可见性', en: 'Seasonal visibility' },
  'objDetail.bestSeason':  { zh: '最佳季节', en: 'Best season' },
  'objDetail.relVis':      { zh: '相对可见度', en: 'Relative visibility' },
  'objDetail.visTonight':  { zh: '今晚可见性', en: 'Visibility tonight' },
  'objDetail.timeSensitive': { zh: '随时间变化', en: 'Time-sensitive' },
  'objDetail.direction':   { zh: '方位', en: 'Direction' },
  'objDetail.altitude':    { zh: '高度角', en: 'Altitude' },
  'objDetail.bestTime':    { zh: '最佳时间', en: 'Best time' },
  'objDetail.moonConflict':{ zh: '月相影响', en: 'Moon conflict' },
  'objDetail.equipment':   { zh: '适合设备', en: 'Suitable equipment' },
  'objDetail.recommended': { zh: '推荐', en: 'Recommended' },
  'objDetail.bestPlaces':  { zh: '附近最佳地点', en: 'Best places nearby' },
  'objDetail.forDate':     { zh: '所选日期', en: 'For selected date' },
  'objDetail.noMoonInterf':{ zh: '无月光干扰', en: 'No moon interference tonight' },
  'objDetail.changeDate':  { zh: '切换观测日期', en: 'Change observing date' },
  'objDetail.equipSuit':   { zh: '设备匹配', en: 'Equipment suitability' },
  'objDetail.wellPlaced':  { zh: '今晚观测条件好', en: 'is well placed tonight.' },
  'objDetail.lowTonight':  { zh: '今晚位置较低——试试其他月份', en: 'may be low tonight — try a different month.' },
  'objDetail.belowHorizon':{ zh: '所选时间在地平线下，试试换时间或日期', en: 'Below horizon at selected time. Try a different date or time.' },
  'objDetail.noSites':     { zh: '附近无符合该天体要求的暗夜地点', en: 'No dark sites nearby matching this object\'s requirements' },

  // === Place Detail ===
  'placeDetail.darkSite':  { zh: '暗夜地点', en: 'Dark Site' },
  'placeDetail.tonight':   { zh: '今晚', en: 'Tonight' },
  'placeDetail.dateSensitive': { zh: '随日期变化', en: 'Date-sensitive' },
  'placeDetail.clouds':    { zh: '云量', en: 'Clouds' },
  'placeDetail.moonImpact':{ zh: '月相影响', en: 'Moon impact' },
  'placeDetail.lightPoll': { zh: '光污染', en: 'Light pollution' },
  'placeDetail.elevation': { zh: '海拔', en: 'Elevation' },
  'placeDetail.moonPhase': { zh: '月相', en: 'Moon phase' },
  'placeDetail.bestWindow':{ zh: '最佳观测时段', en: 'Best viewing window' },
  'placeDetail.bestObj':   { zh: '此地最佳天体', en: 'Best objects here' },
  'placeDetail.facilities':{ zh: '设施与实地报告', en: 'Facilities & field reports' },
  'placeDetail.community': { zh: '社区维护', en: 'Community maintained' },
  'placeDetail.parking':   { zh: '停车', en: 'Parking' },
  'placeDetail.nightAccess':{ zh: '夜间通行', en: 'Night access' },
  'placeDetail.localLights':{ zh: '周边灯光', en: 'Local lights' },
  'placeDetail.contribute': { zh: '贡献报告', en: 'Report conditions' },
  'placeDetail.forecast':  { zh: '所选时间的天气与天况', en: 'Forecast & sky for selected time' },
  'placeDetail.equipSuit': { zh: '适合设备', en: 'Good for' },
  'placeDetail.equipSuitLabel': { zh: '设备适配', en: 'Equipment suitability' },
  'placeDetail.noMoonInterf':{ zh: '今晚无月光干扰', en: 'No moon interference tonight' },

  // === Profile Page ===
  'profile.sub':           { zh: '你的观测档案', en: 'Your observing profile' },
  'profile.title':         { zh: '我的', en: 'Profile' },
  'profile.heroTitle':     { zh: '观测者档案', en: 'Observer profile' },
  'profile.heroDesc':      { zh: '你的设备和历史记录能改善天体推荐，让你的贡献更有序。', en: 'Your equipment and history improve object recommendations and keep your contributions organized.' },
  'profile.equipment':     { zh: '设备', en: 'Equipment' },
  'profile.records':       { zh: '记录', en: 'Records' },
  'profile.contributions': { zh: '贡献', en: 'Contributions' },
  'profile.myEquip':       { zh: '我的设备', en: 'My equipment' },
  'profile.edit':          { zh: '编辑', en: 'Edit' },
  'profile.noEquip':       { zh: '未配置设备，点击编辑添加', en: 'No equipment configured. Tap Edit to add your gear.' },
  'profile.quickAdd':      { zh: '快速添加', en: 'Quick add' },
  'profile.commonPresets': { zh: '常用预设', en: 'Common presets' },
  'profile.defaultMode':   { zh: '默认模式', en: 'Default mode' },
  'profile.mostVersatile':  { zh: '最通用', en: 'Most versatile' },
  'profile.deepSkyKing':    { zh: '深空之王', en: 'Deep sky king' },
  'profile.nakedEye':       { zh: '肉眼', en: 'Naked eye' },
  'profile.alreadyAdded':   { zh: '已在你的设备中', en: 'Already in your equipment' },
  'profile.summary':        { zh: '统计', en: 'Summary' },
  'profile.allTime':        { zh: '累计', en: 'All time' },
  'profile.totalSessions':  { zh: '观测场次', en: 'Total sessions' },
  'profile.targetsObserved':{ zh: '观测目标', en: 'Targets observed' },
  'profile.obsLog':         { zh: '观测日志', en: 'Observation log' },
  'profile.add':            { zh: '＋ 新建', en: '＋ Add' },
  'profile.noRecords':      { zh: '暂无观测记录，开始你的第一场！', en: 'No observation records yet. Start your first session!' },
  'profile.newSession':     { zh: '新会话已开始', en: 'New session started' },
  'profile.contribStatus':  { zh: '贡献者状态', en: 'Contribution status' },
  'profile.recentContrib':  { zh: '近期贡献', en: 'Recent contributions' },
  'profile.howItWorks':     { zh: '运作方式', en: 'How it works' },
  'profile.step1':          { zh: '访问暗夜地点并报告状况', en: 'Visit a dark site and report conditions' },
  'profile.step2':          { zh: '获3次独立确认 → 已验证', en: 'Get 3 independent confirmations → Verified' },
  'profile.step3':          { zh: '3+被采纳 → 终身创始权益', en: '3+ accepted → Lifetime founding status' },
  'profile.contributeBtn':  { zh: '＋ 贡献到地点', en: '＋ Contribute to a site' },
  'profile.lifetime':       { zh: '终身资格', en: 'Lifetime eligible' },
  'profile.forLifetime':    { zh: '3+可获终身', en: '3+ for lifetime' },

  // === Language ===
  'profile.language':      { zh: '语言', en: 'Language' },
  'profile.languageDesc':  { zh: '切换界面语言', en: 'Switch interface language' },

  // === General ===
  'general.obsTime':       { zh: '观测时间', en: 'Observation time' },
  'general.dateAndTime':   { zh: '日期和时间', en: 'Date & time' },
  'general.singleNight':  { zh: '单晚', en: 'Single night' },
  'general.weekend':       { zh: '周末', en: 'Weekend' },
  'general.anyMonth':      { zh: '本月任意日期', en: 'Any date this month' },
  'general.apply':         { zh: '应用并重新计算', en: 'Apply & recalculate' },
  'general.dateApplied':   { zh: '日期已应用，正在重新计算...', en: 'Date applied · recalculating...' },
  'general.equipProfile':  { zh: '观测者档案', en: 'Observer profile' },
  'general.obsEquipment':  { zh: '观测设备', en: 'Observation equipment' },
  'general.equipSaved':    { zh: '设备已保存', en: 'Equipment saved' },
  'general.saved':         { zh: '已收藏', en: 'Saved to favorites' },
  'general.calculating':   { zh: '正在计算天况...', en: 'Calculating sky...' },
  'general.calcFailed':    { zh: '计算失败，正在重试...', en: 'Calculation failed, retrying...' },

  // === Type badges ===
  'type.planet':   { zh: '行星', en: 'Planet' },
  'type.star':     { zh: '恒星', en: 'Star' },
  'type.deepSky':  { zh: '深空', en: 'Deep Sky' },
  'type.moon':     { zh: '月亮', en: 'Moon' },
  'type.milkyway': { zh: '银河', en: 'Milky Way' },
  'type.meteor':   { zh: '流星', en: 'Meteor' },

  // === Difficulty ===
  'diff.easy':        { zh: '简单', en: 'Easy' },
  'diff.moderate':    { zh: '中等', en: 'Moderate' },
  'diff.challenging': { zh: '困难', en: 'Hard' },

  // === Equipment levels ===
  'equip.great':       { zh: '极佳', en: 'Great' },
  'equip.recommended': { zh: '推荐', en: 'Recommended' },
  'equip.optional':    { zh: '可选', en: 'Optional' },

  // === Date / Tonight ===
  'date.tonight': { zh: '今晚', en: 'Tonight' },

  // === Status badges ===
  'status.official':  { zh: '官方认证', en: 'Official certified' },
  'status.suggested': { zh: '社区推荐', en: 'Community suggested' },
  'status.accepted':  { zh: '已采纳', en: 'Accepted' },
  'status.verified':  { zh: '已验证', en: 'Verified' },
  'status.pending':   { zh: '待确认', en: 'Pending' },

  // === Visibility ===
  'vis.excellent': { zh: '极佳', en: 'Excellent' },
  'vis.good':      { zh: '良好', en: 'Good' },
  'vis.fair':      { zh: '一般', en: 'Fair' },
  'vis.poor':      { zh: '较差', en: 'Poor' },
};

// ===== t() — translate by key =====
export function t(key: string): string {
  const lang = (ctx.language || 'zh') as Lang;
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry['en'] || key;
}

// ===== tObj() — translate a catalog object field =====
export function tCat(id: string, field: 'name' | 'desc'): string {
  // Object names/descriptions are stored in catalog in Chinese
  // Return as-is for zh, or use translations map for en if needed
  // For now, catalog names are already in Chinese, we add English aliases
  const nameMap: Record<string, string> = {
    mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn',
    sirius: 'Sirius', arcturus: 'Arcturus', vega: 'Vega', altair: 'Altair',
    betelgeuse: 'Betelgeuse', rigel: 'Rigel',
    m31: 'Andromeda Galaxy', m42: 'Orion Nebula', m45: 'Pleiades',
    moon: 'Moon', milkyway: 'Milky Way', perseids: 'Perseids',
  };
  const descMap: Record<string, string> = {
    mercury: 'Follows the Sun closely, short viewing window',
    venus: 'Brightest planet, easy to spot',
    mars: 'Red planet, brightest at opposition',
    jupiter: 'Largest planet, Galilean moons visible in telescope',
    saturn: 'Spectacular rings, 50x+ for ring detail',
    sirius: 'Brightest star in the night sky',
    arcturus: 'Brightest star in northern sky, orange-red',
    vega: 'Summer Triangle vertex',
    altair: 'Summer Triangle member',
    betelgeuse: 'Red supergiant star',
    rigel: 'Blue-white supergiant',
    m31: 'Farthest object visible to naked eye',
    m42: 'Brightest diffuse nebula',
    m45: 'Seven Sisters star cluster',
    moon: 'Easiest object to observe',
    milkyway: 'Summer Milky Way core, visible light band',
    perseids: 'Top 3 annual meteor shower, peak Aug 12',
  };

  if ((ctx.language || 'zh') === 'en') {
    if (field === 'name') return nameMap[id] || id;
    if (field === 'desc') return descMap[id] || '';
  }
  return ''; // caller will fall back to catalog Chinese
}
