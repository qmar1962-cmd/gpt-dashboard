/**
 * 评分引擎 — 从 useEnrichedData 提取的纯评分公式
 * 供 useMonthlyScore 使用，公式与 useEnrichedData 完全一致
 */
import { parseDate } from './dateUtils';
import { getScoringConfig } from './dashboardConfig';

// ── 评分常量 ──
const SCORE =   { JOB: 25, SALARY: 15, ATT15: 25, ATT7: 25, WH_HIGH: 5,  WH_LOW: 5  } as const;
const PENALTY = { JOB_PER: 5, SALARY_PCT: 3, ATT15_PCT: 5, ATT15_O30: 2, ATT7_PER: 2, WH_HIGH_PCT: 1 } as const;

// ── 中心名称别名 ──
const CENTER_ALIASES: Record<string, string[]> = {
  '武昌': ['武吕'],
  '武吕': ['武昌'],
};

function expandName(name: string): string[] {
  return [name, ...(CENTER_ALIASES[name] || [])];
}

function normalizeCenter(name: string) {
  return (name || '').replace(/中心$/, '').replace(/省区$/, '').replace(/区$/, '').trim();
}

export interface RosterStats {
  total: number;
  leaders: number;
  managers: number;
}

export interface DailyCounts {
  date: string;
  jobAbnormal: number;
  salaryAbnormal: number;
  att15Count: number;
  att15Over30: number;
  att7Count: number;
  whHighCount: number;
  whLowCount: number;
}

export interface DimensionScores {
  job: number;
  salary: number;
  att15: number;
  att7: number;
  whHigh: number;
  whLow: number;
  total: number;
}

/** 计算单日六维度得分（公式与 useEnrichedData 完全一致） */
export function computeDailyScore(counts: DailyCounts, rosterTotal: number): DimensionScores {
  const cfg = getScoringConfig();

  const job = Math.max(0, SCORE.JOB - counts.jobAbnormal * PENALTY.JOB_PER);

  const salaryRate = rosterTotal > 0 ? (counts.salaryAbnormal / rosterTotal) * 100 : 0;
  const salary = salaryRate <= cfg.salaryCoverageThreshold
    ? SCORE.SALARY
    : Math.max(0, SCORE.SALARY - Math.round((salaryRate - cfg.salaryCoverageThreshold) * PENALTY.SALARY_PCT));

  const att15Rate = rosterTotal > 0 ? (counts.att15Count / rosterTotal) * 100 : 0;
  const coverageDeduction = att15Rate <= cfg.att15RateThreshold
    ? 0
    : Math.round((att15Rate - cfg.att15RateThreshold) * PENALTY.ATT15_PCT);
  const att15 = Math.max(0, SCORE.ATT15 - coverageDeduction - counts.att15Over30 * PENALTY.ATT15_O30);

  const att7 = Math.max(0, SCORE.ATT7 - counts.att7Count * PENALTY.ATT7_PER);

  const whHighRate = rosterTotal > 0 ? (counts.whHighCount / rosterTotal) * 100 : 0;
  const whHigh = whHighRate <= cfg.whHighRateThreshold
    ? SCORE.WH_HIGH
    : Math.max(0, SCORE.WH_HIGH - Math.round(whHighRate - cfg.whHighRateThreshold) * PENALTY.WH_HIGH_PCT);

  const whLow = Math.max(0, SCORE.WH_LOW - counts.whLowCount);

  const total = job + salary + att15 + att7 + whHigh + whLow;
  return { job, salary, att15, att7, whHigh, whLow, total };
}

// ── 月度评分常量 ──
const M_SCORE = { JOB: 25, SALARY: 15, ATT15: 25, ATT7: 25, WH_HIGH: 5, WH_LOW: 5 } as const;
const M_PENALTY = { JOB_PER: 5, SALARY_PCT: 2, SALARY_THRESHOLD: 1, ATT15_PCT: 5, ATT15_THRESHOLD: 3, ATT15_O30: 2, ATT7_PER: 2, WH_HIGH_PCT: 1, WH_HIGH_THRESHOLD: 10 } as const;

/** 计算月度六维度得分（用户给定口径） */
export function computeMonthlyScore(
  monthJobCount: number,
  monthSalaryCount: number,
  monthAtt15AvgPerDay: number,
  monthAtt15Over30Total: number,
  monthAtt7DistinctPeople: number,
  monthWhHighAvgPerDay: number,
  monthWhLowAvgPerDay: number,
  rosterTotal: number,
  dataDays: number,
): DimensionScores {
  const base = rosterTotal || 1;
  const days = dataDays || 1;

  // 效能（满分25）：当月滚动至最后一天触发岗位数，每岗扣5分
  const job = Math.max(0, M_SCORE.JOB - monthJobCount * M_PENALTY.JOB_PER);

  // 绩效（满分15）：当月滚动至最后一天触发人数 / 算薪人数，≤1%不扣分，>1%每增1%扣2分
  const salaryRate = (monthSalaryCount / base) * 100;
  const salary = salaryRate <= M_PENALTY.SALARY_THRESHOLD
    ? M_SCORE.SALARY
    : Math.max(0, M_SCORE.SALARY - Math.round((salaryRate - M_PENALTY.SALARY_THRESHOLD) * M_PENALTY.SALARY_PCT));

  // 连续出勤≥20天（满分25）：日均触发人数 / 日均在职人数，≤3%不扣分，>3%每增1%扣5分，≥30天每人扣2分
  const att15Rate = (monthAtt15AvgPerDay / base) * 100;
  const att15Ded = att15Rate <= M_PENALTY.ATT15_THRESHOLD
    ? 0
    : Math.round((att15Rate - M_PENALTY.ATT15_THRESHOLD) * M_PENALTY.ATT15_PCT);
  const att15 = Math.max(0, M_SCORE.ATT15 - att15Ded - monthAtt15Over30Total * M_PENALTY.ATT15_O30);

  // 连续未出勤≥15天（满分25）：每出现1人扣2分（不含病假工伤/跨组织架构）
  const att7 = Math.max(0, M_SCORE.ATT7 - monthAtt7DistinctPeople * M_PENALTY.ATT7_PER);

  // 日工时≥12.5h（满分5）：日均触发占比 >10%，每增1%扣1分
  const whHighRate = (monthWhHighAvgPerDay / base) * 100;
  const whHigh = whHighRate <= M_PENALTY.WH_HIGH_THRESHOLD
    ? M_SCORE.WH_HIGH
    : Math.max(0, M_SCORE.WH_HIGH - Math.round(whHighRate - M_PENALTY.WH_HIGH_THRESHOLD) * M_PENALTY.WH_HIGH_PCT);

  // 日工时≤8h（满分5）：每出现1人扣1分
  const whLow = Math.max(0, M_SCORE.WH_LOW - monthWhLowAvgPerDay);

  const total = job + salary + att15 + att7 + whHigh + whLow;
  return { job, salary, att15, att7, whHigh, whLow, total };
}

// ── 花名册匹配（与 useEnrichedData 的 findRosterStats 逻辑一致）──

/** 从花名册原始数据构建 中心→人数 映射 */
export function buildRosterMap(rosterData: any[]): Map<string, RosterStats> {
  const rosterByCenter = new Map<string, RosterStats>();
  if (!rosterData || rosterData.length === 0) return rosterByCenter;

  const firstRow = rosterData.find((r: any) => r && typeof r === 'object' && Object.keys(r).length > 0);
  if (!firstRow) return rosterByCenter;

  const cols = Object.keys(firstRow as any);
  const deptCol = cols.find(c => c.includes('二级部门')) || '二级部门';
  const centerCol = cols.find(c => c.includes('七级单位')) || cols.find(c => c.includes('六级单位')) || '六级单位';
  const provinceCol = cols.find(c => c.includes('五级单位')) || '五级单位';
  const jobCol = cols.find(c => c.includes('岗位名称')) || '岗位名称';

  rosterData.forEach((row: any) => {
    if (!row || typeof row !== 'object') return;
    const dept = row[deptCol] || '';
    if (!String(dept).trim().includes('中心操作')) return;
    const center = String(row[centerCol] || '').trim();
    const province = row[provinceCol] || '';
    const job = row[jobCol] || '';
    const key = `${center}_${province}`;
    const stats = rosterByCenter.get(key) || { total: 0, leaders: 0, managers: 0 };
    stats.total++;
    if (job === '操作组长') stats.leaders++;
    if (job === '操作主管') stats.managers++;
    rosterByCenter.set(key, stats);
  });

  return rosterByCenter;
}

/** 模糊查找中心的花名册统计（与 useEnrichedData 的 findRosterStats 逻辑一致） */
export function matchRosterStats(centerName: string, provinceName: string, rosterByCenter: Map<string, RosterStats>): RosterStats | null {
  const directKey = `${centerName}_${provinceName}`;
  if (rosterByCenter.has(directKey)) return rosterByCenter.get(directKey) || null;

  const normCenterName = normalizeCenter(centerName);
  const normProvinceName = normalizeCenter(provinceName);
  const centerVariants = expandName(centerName);

  for (const [key, stats] of rosterByCenter.entries()) {
    const parts = key.split('_');
    if (parts.length < 2) continue;
    const kCenter = parts[0];
    const kProvince = parts[1];
    const normKCenter = normalizeCenter(kCenter);
    const normKProvince = normalizeCenter(kProvince);
    const kCenterVariants = expandName(kCenter);

    const includeMatch =
      kCenterVariants.some(v => centerName.includes(v) || v.includes(centerName)) ||
      centerVariants.some(v => kCenter.includes(v) || v.includes(kCenter));
    const normMatch = normKCenter === normCenterName;
    const centerMatch = includeMatch || normMatch;
    const provinceMatch = kProvince.includes(provinceName) || provinceName.includes(kProvince) || normKProvince === normProvinceName;
    if (centerMatch && provinceMatch) return stats;
  }
  return null;
}

// ── 聚合工具 ──

/** 按 中心+省区+日期 聚合数值（与 useEnrichedData 的 aggregateByCenterDate 一致） */
export function aggregateByCenterDate(rows: any[], filter: (row: any) => boolean): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach(row => {
    if (!filter(row)) return;
    const center = row.中心 || row.中心名称 || '';
    const province = row.省区 || row.省区名称 || row.省份 || '';
    const dateStr = parseDate(row['数据日期'] || row.date || row.日期);
    if (!dateStr) return;
    const key = `${center}_${province}_${dateStr}`;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

/** 模糊查找聚合值（与 useEnrichedData 的 findCount 逻辑一致） */
export function findCount(map: Map<string, number>, centerName: string, provinceName: string, dateStr: string): number {
  const directKey = `${centerName}_${provinceName}_${dateStr}`;
  if (map.has(directKey)) return map.get(directKey) || 0;
  for (const [key, count] of map.entries()) {
    const parts = key.split('_');
    if (parts.length < 3) continue;
    const kCenter = parts[0];
    const kProvince = parts[1];
    const kDate = parts[2];
    if (kDate !== dateStr) continue;
    const centerMatch = kCenter.includes(centerName) || centerName.includes(kCenter);
    const normKProv = kProvince.replace(/区$/, '');
    const normProv = provinceName.replace(/区$/, '');
    const provinceMatch = kProvince.includes(provinceName) || provinceName.includes(kProvince) || normKProv === normProv;
    if (centerMatch && provinceMatch) return count;
  }
  return 0;
}
