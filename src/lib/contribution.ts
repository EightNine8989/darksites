// ===== 贡献系统 =====
// 地点状况报告 + 确认机制 + 状态流转
import type { ContributionStatus, AppLanguage } from '../types';

// ===== 类型 =====
export interface ContributionRecord {
  id: string;
  siteName: string;
  siteLat: number;
  siteLon: number;
  submitterId: string;     // 本地生成的匿名 ID
  submitDate: string;      // ISO date
  visitType: 'onsite' | 'past_visit';
  fields: ContributionField[];
  status: ContributionStatus;
  independentConfirmations: number;
  confirmedBy: string[];    // 其他用户 ID
  reviewNotes?: string;
  reviewedAt?: string;
}

export interface ContributionField {
  key: string;             // e.g. 'parking', 'nightAccess', 'localLights', 'cloudCover', 'general'
  value: string;           // user-submitted value
  evidence?: string;       // optional photo URL / description
}

// ===== 表单字段定义 =====
export interface FormFieldDef {
  key: string;
  labelZh: string;
  labelEn: string;
  type: 'select' | 'text' | 'rating';
  options?: { value: string; labelZh: string; labelEn: string }[];
  required: boolean;
}

export const CONTRIBUTION_FIELDS: FormFieldDef[] = [
  {
    key: 'visitType',
    labelZh: '访问类型',
    labelEn: 'Visit type',
    type: 'select',
    required: true,
    options: [
      { value: 'onsite', labelZh: '现场访问', labelEn: 'On-site visit' },
      { value: 'past_visit', labelZh: '历史访问', labelEn: 'Past visit' },
    ],
  },
  {
    key: 'parking',
    labelZh: '停车条件',
    labelEn: 'Parking',
    type: 'select',
    required: false,
    options: [
      { value: 'easy', labelZh: '充足', labelEn: 'Easy' },
      { value: 'limited', labelZh: '有限', labelEn: 'Limited' },
      { value: 'none', labelZh: '无', labelEn: 'None' },
      { value: 'unknown', labelZh: '不确定', labelEn: 'Unknown' },
    ],
  },
  {
    key: 'nightAccess',
    labelZh: '夜间通行',
    labelEn: 'Night access',
    type: 'select',
    required: false,
    options: [
      { value: 'open', labelZh: '开放', labelEn: 'Open' },
      { value: 'restricted', labelZh: '受限', labelEn: 'Restricted' },
      { value: 'closed', labelZh: '关闭', labelEn: 'Closed' },
      { value: 'unknown', labelZh: '不确定', labelEn: 'Unknown' },
    ],
  },
  {
    key: 'localLights',
    labelZh: '周边灯光',
    labelEn: 'Local lights',
    type: 'select',
    required: false,
    options: [
      { value: 'none', labelZh: '无', labelEn: 'None' },
      { value: 'minor', labelZh: '轻微', labelEn: 'Minor' },
      { value: 'moderate', labelZh: '中等', labelEn: 'Moderate' },
      { value: 'severe', labelZh: '严重', labelEn: 'Severe' },
    ],
  },
  {
    key: 'skyCondition',
    labelZh: '天况评分',
    labelEn: 'Sky condition',
    type: 'rating',
    required: true,
  },
  {
    key: 'notes',
    labelZh: '补充说明',
    labelEn: 'Notes',
    type: 'text',
    required: false,
  },
];

// ===== 本地匿名 ID =====
const USER_ID_KEY = 'ds_user_id';

export function getLocalUserId(): string {
  try {
    const stored = localStorage.getItem(USER_ID_KEY);
    if (stored) return stored;
  } catch {}
  const id = `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try { localStorage.setItem(USER_ID_KEY, id); } catch {}
  return id;
}

// ===== 贡献数据持久化 =====
const CONTRIBUTIONS_KEY = 'ds_contributions';

export function loadContributions(): ContributionRecord[] {
  try {
    const raw = localStorage.getItem(CONTRIBUTIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return getSampleContributions();
}

export function saveContributions(contribs: ContributionRecord[]): void {
  try {
    localStorage.setItem(CONTRIBUTIONS_KEY, JSON.stringify(contribs));
  } catch {}
}

// ===== 提交贡献 =====
export function submitContribution(
  siteName: string,
  siteLat: number,
  siteLon: number,
  fields: ContributionField[],
  visitType: 'onsite' | 'past_visit'
): ContributionRecord {
  const record: ContributionRecord = {
    id: `contrib_${Date.now().toString(36)}`,
    siteName,
    siteLat,
    siteLon,
    submitterId: getLocalUserId(),
    submitDate: new Date().toISOString(),
    visitType,
    fields,
    status: 'pending',
    independentConfirmations: 0,
    confirmedBy: [],
  };
  const contribs = loadContributions();
  contribs.unshift(record);
  saveContributions(contribs);
  return record;
}

// ===== 确认贡献（模拟：其他用户确认） =====
export function confirmContribution(contribId: string): ContributionRecord | null {
  const contribs = loadContributions();
  const idx = contribs.findIndex(c => c.id === contribId);
  if (idx === -1) return null;

  const contrib = contribs[idx];
  const userId = getLocalUserId();

  // 不能确认自己的贡献
  if (contrib.submitterId === userId) return null;
  // 不能重复确认
  if (contrib.confirmedBy.includes(userId)) return null;

  contrib.confirmedBy.push(userId);
  contrib.independentConfirmations = contrib.confirmedBy.length;

  // 状态流转：pending → verified (3 confirmations) → accepted
  if (contrib.independentConfirmations >= 3 && contrib.status !== 'accepted') {
    contrib.status = 'verified';
    // 在真实系统中，verified 后由管理员审核变 accepted
    // MVP 中自动 accepted
    contrib.status = 'accepted';
    contrib.reviewedAt = new Date().toISOString();
  } else if (contrib.independentConfirmations >= 1 && contrib.status === 'pending') {
    contrib.status = 'pending'; // still pending until 3
  }

  saveContributions(contribs);
  return contrib;
}

// ===== 数据校验 =====
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateContribution(fields: ContributionField[], lang: AppLanguage = 'zh'): ValidationResult {
  const errors: string[] = [];
  const isZh = lang === 'zh';

  // 必须有 visitType
  const visitType = fields.find(f => f.key === 'visitType');
  if (!visitType?.value) {
    errors.push(isZh ? '请选择访问类型' : 'Please select visit type');
  }

  // 必须有 skyCondition
  const skyCond = fields.find(f => f.key === 'skyCondition');
  if (!skyCond?.value || parseInt(skyCond.value) < 1) {
    errors.push(isZh ? '请给天况评分' : 'Please rate the sky condition');
  }

  // 至少填写一个字段（除了 visitType 和 skyCondition 之外的）
  const extraFields = fields.filter(f => f.key !== 'visitType' && f.key !== 'skyCondition' && f.value);
  if (extraFields.length === 0) {
    errors.push(isZh ? '请至少填写一项实地信息' : 'Please fill at least one field report');
  }

  return { valid: errors.length === 0, errors };
}

// ===== 统计 =====
export function getContributionStats(contribs: ContributionRecord[]) {
  const total = contribs.length;
  const accepted = contribs.filter(c => c.status === 'accepted' || c.status === 'verified').length;
  const verified = contribs.filter(c => c.status === 'verified').length;
  const pending = contribs.filter(c => c.status === 'pending').length;

  let level: string;
  if (accepted >= 5) level = 'founder';     // 创始探索者
  else if (accepted >= 3) level = 'explorer'; // 探索者
  else level = 'observer';                    // 观测者

  const lifetimeEligible = accepted >= 3;

  return { total, accepted, verified, pending, level, lifetimeEligible };
}

// ===== Sample Data =====
function getSampleContributions(): ContributionRecord[] {
  return [
    {
      id: 'contrib_sample1',
      siteName: '西涌暗夜社区',
      siteLat: 22.45,
      siteLon: 114.48,
      submitterId: 'user_sample1',
      submitDate: '2026-08-05T22:30:00',
      visitType: 'onsite',
      fields: [
        { key: 'visitType', value: 'onsite' },
        { key: 'parking', value: 'easy' },
        { key: 'skyCondition', value: '4' },
      ],
      status: 'accepted',
      independentConfirmations: 3,
      confirmedBy: ['user_a', 'user_b', 'user_c'],
      reviewedAt: '2026-08-06T10:00:00',
    },
    {
      id: 'contrib_sample2',
      siteName: '太行洪谷',
      siteLat: 36.23,
      siteLon: 113.48,
      submitterId: 'user_sample2',
      submitDate: '2026-07-28T21:00:00',
      visitType: 'onsite',
      fields: [
        { key: 'visitType', value: 'onsite' },
        { key: 'parking', value: 'limited' },
        { key: 'nightAccess', value: 'open' },
        { key: 'skyCondition', value: '5' },
      ],
      status: 'pending',
      independentConfirmations: 2,
      confirmedBy: ['user_d', 'user_e'],
    },
    {
      id: 'contrib_sample3',
      siteName: '怀柔暗夜观测站',
      siteLat: 40.37,
      siteLon: 116.62,
      submitterId: 'user_sample3',
      submitDate: '2026-07-12T22:00:00',
      visitType: 'past_visit',
      fields: [
        { key: 'visitType', value: 'past_visit' },
        { key: 'localLights', value: 'minor' },
        { key: 'skyCondition', value: '3' },
      ],
      status: 'verified',
      independentConfirmations: 3,
      confirmedBy: ['user_f', 'user_g', 'user_h'],
    },
  ];
}
