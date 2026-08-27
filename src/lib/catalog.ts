// ===== 天体目录 =====
// 2.0 改为从后端 API 动态加载 + 硬编码 fallback
import type { CelestialObject } from '../types';
import { fetchObjects, pingApi } from './api';

// ===== 硬编码 fallback（API 不可用时使用） =====
export const FALLBACK_CATALOG: CelestialObject[] = [
  // 行星
  { id: 'mercury', name: '水星', type: 'planet', constellation: '—', magnitude: -0.4, ra: 0, dec: 0, description: '紧随太阳升降，观测窗口短', equipment: ['肉眼', '双筒镜'], difficulty: 'challenging' },
  { id: 'venus', name: '金星', type: 'planet', constellation: '—', magnitude: -4.1, ra: 0, dec: 0, description: '夜空最亮行星，极易识别', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'mars', name: '火星', type: 'planet', constellation: '—', magnitude: -1.0, ra: 0, dec: 0, description: '红色行星，冲日时极亮', equipment: ['肉眼', '双筒镜'], difficulty: 'easy' },
  { id: 'jupiter', name: '木星', type: 'planet', constellation: '—', magnitude: -2.1, ra: 0, dec: 0, description: '太阳系最大行星，望远镜可见伽利略卫星', equipment: ['肉眼', '双筒镜', '望远镜'], difficulty: 'easy' },
  { id: 'saturn', name: '土星', type: 'planet', constellation: '—', magnitude: 0.6, ra: 0, dec: 0, description: '壮观环系，望远镜50x以上看环', equipment: ['双筒镜', '望远镜'], difficulty: 'moderate' },

  // 亮恒星
  { id: 'sirius', name: '天狼星', type: 'star', constellation: '大犬座', magnitude: -1.46, ra: 101.287, dec: -16.716, description: '全天最亮恒星', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'arcturus', name: '大角星', type: 'star', constellation: '牧夫座', magnitude: -0.05, ra: 213.915, dec: 19.182, description: '北天最亮恒星，橙红色', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'vega', name: '织女星', type: 'star', constellation: '天琴座', magnitude: 0.03, ra: 279.234, dec: 38.784, description: '夏季大三角顶点', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'altair', name: '牛郎星', type: 'star', constellation: '天鹰座', magnitude: 0.77, ra: 297.696, dec: 8.868, description: '夏季大三角成员', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'betelgeuse', name: '参宿四', type: 'star', constellation: '猎户座', magnitude: 0.5, ra: 88.793, dec: 7.407, description: '红色超巨星', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'rigel', name: '参宿七', type: 'star', constellation: '猎户座', magnitude: 0.13, ra: 78.634, dec: -8.202, description: '蓝白色超巨星', equipment: ['肉眼'], difficulty: 'easy' },

  // 深空天体
  { id: 'm31', name: '仙女座星系', type: 'deepSky', constellation: '仙女座', magnitude: 3.44, ra: 10.685, dec: 41.269, description: '肉眼可见的最远天体', equipment: ['双筒镜', '望远镜'], difficulty: 'challenging' },
  { id: 'm42', name: '猎户座大星云', type: 'deepSky', constellation: '猎户座', magnitude: 4.0, ra: 83.822, dec: -5.391, description: '最明亮的弥漫星云', equipment: ['双筒镜', '望远镜'], difficulty: 'moderate' },
  { id: 'm45', name: '昴星团', type: 'deepSky', constellation: '金牛座', magnitude: 1.6, ra: 56.871, dec: 24.105, description: '七姐妹星团', equipment: ['肉眼', '双筒镜'], difficulty: 'easy' },

  // 月球
  { id: 'moon', name: '月球', type: 'moon', constellation: '—', magnitude: -12, ra: 0, dec: 0, description: '最易观测天体', equipment: ['肉眼', '双筒镜', '望远镜'], difficulty: 'easy' },

  // 银河 & 流星雨
  { id: 'milkyway', name: '银河', type: 'milkyway', constellation: '—', magnitude: -1, ra: 0, dec: 0, description: '夏季银河核心，肉眼可见光带', equipment: ['肉眼', '广角相机'], difficulty: 'easy' },
  { id: 'perseids', name: '英仙座流星雨', type: 'meteor', constellation: '英仙座', magnitude: -1, ra: 0, dec: 0, description: '年度三大流星雨，8月12日极大', equipment: ['肉眼', '广角相机'], difficulty: 'easy' },
];

// ===== 动态加载状态 =====
let _catalog: CelestialObject[] = FALLBACK_CATALOG;
let _loaded = false;
let _loading = false;

/** 获取天体目录（优先返回 API 数据，否则 fallback） */
export function getCelestialCatalog(): CelestialObject[] {
  return _catalog;
}

/** 异步加载天体目录（从后端 API） */
export async function loadCelestialCatalog(): Promise<CelestialObject[]> {
  if (_loaded || _loading) return _catalog;
  _loading = true;

  try {
    const apiAlive = await pingApi();
    if (!apiAlive) {
      _loaded = true;
      _loading = false;
      return _catalog;
    }

    // 按类型批量加载最亮的天体（每类 limit=100，取 mag 最小）
    const types = [
      'planet', 'star', 'dso', 'galaxy', 'nebula', 'open_cluster',
      'planetary_nebula', 'supernova_remnant', 'moon', 'meteor_shower',
      'milky_way', 'comet', 'asteroid', 'double_star', 'multiple_star',
    ];    const results = await Promise.all(
      types.map(t => fetchObjects({ object_type: t, limit: 200 }))
    );

    // 合并所有类型，按星等排序（亮的在前）
    const merged = results.flat().sort((a, b) => a.magnitude - b.magnitude);

    // 行星/月球/太阳/银河/流星雨不受星等截断影响（后端 magnitude 可能为 null→99）
    const alwaysKeep = merged.filter(o =>
      o.type === 'planet' || o.type === 'moon' || o.type === 'milkyway' || o.type === 'meteor'
    );
    const others = merged.filter(o =>
      o.type !== 'planet' && o.type !== 'moon' && o.type !== 'milkyway' && o.type !== 'meteor'
    ).slice(0, 300);

    _catalog = [...alwaysKeep, ...others];

    // 补充 fallback 中有但 API 没有的特殊天体（银河、流星雨等）
    const apiNames = new Set(_catalog.map(o => o.name.toLowerCase()));
    const extras = FALLBACK_CATALOG.filter(o =>
      !apiNames.has(o.name.toLowerCase()) && (o.type === 'milkyway' || o.type === 'meteor')
    );

    _catalog = [...extras, ..._catalog];
    _loaded = true;
  } catch {
    // 保持 fallback
    _loaded = true;
  }

  _loading = false;
  return _catalog;
}

// ===== 向后兼容：保留原来的导出名 =====
export const celestialCatalog = FALLBACK_CATALOG;
