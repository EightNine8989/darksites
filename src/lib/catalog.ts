// ===== 天体目录 =====
// 从 Stellara 1.0 复用 + 2.0 扩展（新增 milkyway / meteor 类型）
import type { CelestialObject } from '../types';

export const celestialCatalog: CelestialObject[] = [
  // ===== 行星 =====
  { id: 'mercury', name: '水星', type: 'planet', constellation: '—', magnitude: -0.4, ra: 0, dec: 0, description: '紧随太阳升降，观测窗口短', equipment: ['肉眼', '双筒镜'], difficulty: 'challenging' },
  { id: 'venus', name: '金星', type: 'planet', constellation: '—', magnitude: -4.1, ra: 0, dec: 0, description: '夜空最亮行星，极易识别', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'mars', name: '火星', type: 'planet', constellation: '—', magnitude: -1.0, ra: 0, dec: 0, description: '红色行星，冲日时极亮', equipment: ['肉眼', '双筒镜'], difficulty: 'easy' },
  { id: 'jupiter', name: '木星', type: 'planet', constellation: '—', magnitude: -2.1, ra: 0, dec: 0, description: '太阳系最大行星，望远镜可见伽利略卫星', equipment: ['肉眼', '双筒镜', '望远镜'], difficulty: 'easy' },
  { id: 'saturn', name: '土星', type: 'planet', constellation: '—', magnitude: 0.6, ra: 0, dec: 0, description: '壮观环系，望远镜50x以上看环', equipment: ['双筒镜', '望远镜'], difficulty: 'moderate' },

  // ===== 亮恒星 =====
  { id: 'sirius', name: '天狼星', type: 'star', constellation: '大犬座', magnitude: -1.46, ra: 101.287, dec: -16.716, description: '全天最亮恒星', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'arcturus', name: '大角星', type: 'star', constellation: '牧夫座', magnitude: -0.05, ra: 213.915, dec: 19.182, description: '北天最亮恒星，橙红色', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'vega', name: '织女星', type: 'star', constellation: '天琴座', magnitude: 0.03, ra: 279.234, dec: 38.784, description: '夏季大三角顶点', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'altair', name: '牛郎星', type: 'star', constellation: '天鹰座', magnitude: 0.77, ra: 297.696, dec: 8.868, description: '夏季大三角成员', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'betelgeuse', name: '参宿四', type: 'star', constellation: '猎户座', magnitude: 0.5, ra: 88.793, dec: 7.407, description: '红色超巨星', equipment: ['肉眼'], difficulty: 'easy' },
  { id: 'rigel', name: '参宿七', type: 'star', constellation: '猎户座', magnitude: 0.13, ra: 78.634, dec: -8.202, description: '蓝白色超巨星', equipment: ['肉眼'], difficulty: 'easy' },

  // ===== 深空天体 =====
  { id: 'm31', name: '仙女座星系', type: 'deepSky', constellation: '仙女座', magnitude: 3.44, ra: 10.685, dec: 41.269, description: '肉眼可见的最远天体', equipment: ['双筒镜', '望远镜'], difficulty: 'challenging' },
  { id: 'm42', name: '猎户座大星云', type: 'deepSky', constellation: '猎户座', magnitude: 4.0, ra: 83.822, dec: -5.391, description: '最明亮的弥漫星云', equipment: ['双筒镜', '望远镜'], difficulty: 'moderate' },
  { id: 'm45', name: '昴星团', type: 'deepSky', constellation: '金牛座', magnitude: 1.6, ra: 56.871, dec: 24.105, description: '七姐妹星团', equipment: ['肉眼', '双筒镜'], difficulty: 'easy' },

  // ===== 月球 =====
  { id: 'moon', name: '月球', type: 'moon', constellation: '—', magnitude: -12, ra: 0, dec: 0, description: '最易观测天体', equipment: ['肉眼', '双筒镜', '望远镜'], difficulty: 'easy' },

  // ===== 银河 & 流星雨（2.0 新增） =====
  { id: 'milkyway', name: '银河', type: 'milkyway', constellation: '—', magnitude: -1, ra: 0, dec: 0, description: '夏季银河核心，肉眼可见光带', equipment: ['肉眼', '广角相机'], difficulty: 'easy' },
  { id: 'perseids', name: '英仙座流星雨', type: 'meteor', constellation: '英仙座', magnitude: -1, ra: 0, dec: 0, description: '年度三大流星雨，8月12日极大', equipment: ['肉眼', '广角相机'], difficulty: 'easy' },
];
