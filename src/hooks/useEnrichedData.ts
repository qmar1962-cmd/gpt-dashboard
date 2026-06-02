/**
 * 数据增强 Hook：将原始数据按维度计算得分，关联到省区/中心结构上
 */
import { useMemo } from 'react';
import { parseDate, beijingDate } from '../lib/dateUtils';
import { getCenterClass, getScoringConfig, getSpanTargets } from '../lib/dashboardConfig';

// ── 评分常量（权重固定不变）──
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

// ── 聚合计数辅助 ──

interface RosterStats {
  total: number;
  leaders: number;
  managers: number;
}

/** 按 中心+省区+日期 聚合数值 */
function aggregateByCenterDate(rows: any[], filter: (row: any) => boolean): Map<string, number> {
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

/** 模糊查找聚合值 */
function findCount(map: Map<string, number>, centerName: string, provinceName: string, dateStr: string): number {
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

// ── 各岗位配置标准计算（按部门）──
interface StaffingDept { dept: string; standard: number; actual: number; }
interface StaffingStandard { departments: StaffingDept[]; totalStandard: number; totalActual: number; posStandards: { pos: string; standard: number; rule: string }[]; }

function computeStaffingStandard(centerName: string, rosterTotal: number, deptActual: Record<string, number>): StaffingStandard {
  const cls = getCenterClass(centerName);
  const x = rosterTotal;
  const depts: StaffingDept[] = [];

  function add(dept: string, standard: number) {
    const actual = deptActual[dept] || 0;
    depts.push({ dept, standard, actual, diff: actual - standard });
  }

  add('转运中心', (cls !== 'C' ? 2 : 1)); // 部长+副部长
  add('中心人资', 1 + (x<=500?2:x<=800?3:x<=1100?4:x<=1400?5:x<=1700?6:7)); // 主管+专员(分档)
  add('中心环保袋管理', (centerName==='武汉'||centerName==='漯河'?1:0)); // 主管(仅维修工厂所在地)
  add('中心行政保障', 1 + (cls==='A'?2:1) + 1 + (x<=900?2:x<=1400?3:x<=1800?4:5) + 2 + 2); // 负责人+专员+水电+主厨+保安+消防
  add('中心财务', 1);
  add('中心运能调度', 1); // 主管（专员需日均发车量数据，暂不计）
  add('中心质量监督控制', 1 + (cls==='A'?2:1)); // 主管+专员
  add('中心工艺工程', 1); // 主管（工程师需维养工时数据，暂不计）
  add('中心安全监察', (cls!=='C'?1:0) + (cls==='A'?2:cls==='B'?1:0) + (cls==='C'?1:0)); // 主管+管理员(C类共用1)

  const posStandards = getPosStandards(centerName, rosterTotal);
  const totalStandard = depts.reduce((s, d) => s + d.standard, 0);
  const totalActual = depts.reduce((s, d) => s + d.actual, 0);
  return { departments: depts, totalStandard, totalActual, posStandards };
}

// ── 岗位级配置标准(按各岗位配置标准.xlsx顺序) ──
function getPosStandards(centerName: string, rosterTotal: number): { pos: string; standard: number; rule: string }[] {
  const cls = getCenterClass(centerName); const x = rosterTotal;
  const hrTier = x<=500?2:x<=800?3:x<=1100?4:x<=1400?5:x<=1700?6:7;
  const chefCount = x<=900?2:x<=1400?3:x<=1800?4:5;
  const hasBagSup = centerName === '武汉' || centerName === '漯河';
  return [
    { pos: '部长', standard: 1, rule: 'A、B、C类中心均可配置部长1人' },
    { pos: '副部长', standard: cls==='C'?0:1, rule: 'A、B类中心标配1人，C类不配置\n（中心有对应区域总、营运副总原则上不配置）' },
    { pos: '中心人资主管', standard: 1, rule: '标配1人\n（省区驻地超过1350人可配置主管1人，低于1350人不配置负责人）' },
    { pos: '薪酬绩效专员', standard: hrTier>=3?1:0, rule: `整体人资服务比1:190\n中心人数X≤500，配置2人；500＜X≤800人，配置3人；800＜X≤1100人，配置4人；1100<X≤1400人以上，配置5人；1400<X≤1700人以上，配置6人；1700人以上，配置7人\n配置2人，基础事务专员，招聘关怀专员（兼人才发展），主管兼薪酬绩效\n配置3人，薪酬绩效专员，招聘关怀专员，基础事务专员，主管兼人才发展\n配置4人，薪资绩效专员，招聘关怀专员，人才发展专员，基础事务专员\n配置5人，薪酬绩效专员，招聘关怀专员2个，人才发展专员，基础事务专员\n配置6人，薪酬绩效专员2个，招聘关怀专员2个，人才发展专员，基础事务专员\n配置7人，薪酬绩效专员2个，招聘关怀专员2个，人才发展专员，基础事务专员2个` },
    { pos: '招聘关怀专员', standard: hrTier>=2?1:0, rule: '' },
    { pos: '人才发展专员', standard: hrTier>=4?1:0, rule: '' },
    { pos: '人资基础事务专员', standard: hrTier>=2?1:1, rule: '' },
    { pos: '中心环保袋管理主管', standard: hasBagSup?1:0, rule: '仅维修工厂所在地设主管岗（漯河、揭阳、武汉）' },
    { pos: '环保袋仓库管理员', standard: 0, rule: '上报维修量：每1560件配置1人；\n出入库登记量：每32500件配置1人\n（备注：出入库包含发放、调拨、退入库登记）\n数据维度：近3-6个月度日均数据\n（数据每季度对接环保袋项目组-慕峰）' },
    { pos: '中心行政负责人', standard: 1, rule: '主管标配1人' },
    { pos: '行政事务专员', standard: cls==='A'?2:1, rule: 'A类配置2人，B、C类配置1人' },
    { pos: '行政车驾驶员', standard: 0, rule: '省总、区域总配置1个；特殊情况特殊申请' },
    { pos: '宿舍管理员', standard: 0, rule: '1.集体间入住人数大于4人，住宿人员100-300人，配置1名；住宿人员301-1350人，配置2名；住宿人员>1350人，配置3名。\n2.集体间入住人数小于等于4人，入住房间数30-150间，配置1名；入住房间数151-300间，配置2名；入住房间数＞300间，配置3名。' },
    { pos: '主厨', standard: chefCount, rule: `就餐人数X≤900，配置2名厨师；\n900＜X≤1400人，配置3名厨师；\n1400＜X≤1800人，配置4名厨师；\nX＞1800人，配置5名厨师；\n四餐中心，在以上标准上加1名厨师。\n厨师编制上限5人。厨师长共用厨师编制。` },
    { pos: '帮厨', standard: 0, rule: '每天就餐人次服务比1：135。\n四餐中心，在以上标准上加1名厨师。' },
    { pos: '水电维修工', standard: 1, rule: 'AB类中心配置1-2人（北京特殊情况配置6人），C类配置1人\n自有场地电工须持高低压证书' },
    { pos: '锅炉工', standard: 0, rule: '标准配置2人，冬季使用，适用于北方城市，特殊情况需单独申请\n必须持证（华北为常驻人员）' },
    { pos: '保洁', standard: 0, rule: '宿舍楼：宿舍区有公共卫生间的一般1人负责2-3层；无公共卫生间的1人负责3-4层；\n行政楼：办公区1-3层的配置1人\n操作场地和外场：卫生间由行政承接，其他由营运承接。' },
    { pos: '护卫队长', standard: 0, rule: '' },
    { pos: '保安', standard: 2, rule: '门岗每班次1人（分白晚班）；\n配置岗位：门岗、巡逻岗、礼仪岗及替补人员\n保安人数超过4人配置1名护卫队长，编制由保安编制划转；' },
    { pos: '消防中控员', standard: 2, rule: '标准配置2人，白晚班各一人，如政府特殊要求可增编' },
    { pos: '财务支持专员', standard: 1, rule: '配置1人；A类独立中心特殊情况最高可申请配置2人（需向总部财务申请报批）' },
    { pos: '中心运能调度主管', standard: 1, rule: '标准配置1人' },
    { pos: '运行质量专员', standard: 0, rule: '中心运能调度负责人标配1人。\n1类中心：日均发车200以上，3班，运力调度专员、配载调度专员、运行质量监控专员每班各1人，共9人；\n2类中心：日均发车100-200，监控3班，调度2班，运力调度专员、配载调度专员、运行质量监控专员每班各1人，共7人；\n3类中心：日均发车50-100，2班，运力调度专员、配载调度专员、运行质量监控专员每班各1人，共6人；\n4类中心：日均发车25-50，运力2班，配载、监控1班，运力调度专员、配载调度专员、运行质量监控专员每班各1人，共计4人；\n5类中心：日均发车10-25，1班，运力调度专员、运行质量监控专员每班各1人，共计2人\n6类中心：日均发车10以下，1班，监控专员配1人，共1人' },
    { pos: '配载调度专员', standard: 0, rule: '' },
    { pos: '运能调度专员', standard: 0, rule: '' },
    { pos: '中心质量监督控制主管', standard: 1, rule: '1人' },
    { pos: '异常件管理员', standard: 0, rule: '异常件日处理量135单/人\n（异常件处理含仲裁、无着件出入库+认领+申报、地址不详）' },
    { pos: '中心客服员', standard: 0, rule: '日均工单处理量135单/人' },
    { pos: '中心质量监督控制专员', standard: cls==='A'?2:1, rule: 'A类2人；B、C类1人；\n日均操作量大于400万或进港量大于150W万配置两人' },
    { pos: '中心工艺工程主管', standard: 1, rule: '1人' },
    { pos: 'IT运维工程师', standard: 0, rule: '按中心设备维养时长配置人数，基本维度如下：\n1、工作时间：月均工作26天\n2、日均有效作业时间：10小时（折合600分钟/天）\n3、维养工时：根据供应商提供工艺设备维养周期及工时\n4、维养周期：按季度测算\n注：个别场地因设备老旧等导致维养难度提高的，特殊申请\n\n岗位合并为设备工程师（分：IT方向、设备方向）' },
    { pos: '自动化技术工程师', standard: 0, rule: '' },
    { pos: '设备工程员', standard: 0, rule: '' },
    { pos: '中心安全监察主管', standard: cls==='C'?0:1, rule: 'A、B类标配1人。C类中心负责人与安全管理员共用1个编制。' },
    { pos: '安检员', standard: 0, rule: '根据安检机数量及班次配置，1台2人，2台以上按1.5倍比例配置，以此类推（四舍五入），现场安检人员不足可由操作主管临时调配操作员兼职（需持证）。' },
    { pos: '安全管理员', standard: cls==='A'?2:cls==='B'?1:0, rule: 'A类中心2人，B类中心1人，C类中心负责人与安全管理员共用1个编制。\n特殊情况额外申请。' },
  ];
}

export function useEnrichedData(
  displayData: any[],
  rawDataState: any[] | null,
  salaryDataState: any[] | null,
  attendance15DataState: any[] | null,
  attendance7DataState: any[] | null,
  rosterDataState: any[] | null,
  workHoursHighDataState: any[] | null,
  workHoursLowDataState: any[] | null,
  outsourcingData: Record<string, number> | null,
) {
  return useMemo(() => {
    const cfg = getScoringConfig();
    const span = getSpanTargets();
    const hasJob = rawDataState && rawDataState.length > 0;
    const hasSalary = salaryDataState && salaryDataState.length > 0;
    const hasAtt15 = attendance15DataState && attendance15DataState.length > 0;
    const hasAtt7 = attendance7DataState && attendance7DataState.length > 0;
    const hasRoster = rosterDataState && rosterDataState.length > 0;
    const hasWhHigh = workHoursHighDataState && workHoursHighDataState.length > 0;
    const hasWhLow = workHoursLowDataState && workHoursLowDataState.length > 0;

    if (!hasJob && !hasSalary && !hasAtt15 && !hasAtt7 && !hasRoster && !hasWhHigh && !hasWhLow) {
      return displayData;
    }

    const t2DateStr = beijingDate(-2);
    const t3DateStr = beijingDate(-3);

    // 省区→中心 映射（用于反查无省区列的数据）
    const centerToProvince = new Map<string, string>();
    displayData.forEach(province => {
      province.subCenters.forEach(center => {
        if (center.name) centerToProvince.set(center.name, province.province);
      });
    });

    // 聚合各维度数据
    const jobByCenterDate = aggregateByCenterDate(rawDataState || [], row => {
      const deviation = parseFloat(row['目标偏离（%）'] || row.targetDeviation || 0);
      return deviation >= cfg.jobDeviationThreshold;
    });

    const salaryByCenterDate = new Map<string, number>();
    if (salaryDataState) {
      salaryDataState.forEach(row => {
        const center = row.中心 || row.中心名称 || '';
        const province = row.省区 || row.省区名称 || centerToProvince.get(center) || '';
        const dateStr = parseDate(row['数据日期'] || row.date || row.日期);
        const key = `${center}_${province}_${dateStr}`;
        salaryByCenterDate.set(key, (salaryByCenterDate.get(key) || 0) + 1);
      });
    }

    const att15ByCenterDate = new Map<string, number>();
    const att15Over30ByCenterDate = new Map<string, number>();
    if (attendance15DataState) {
      attendance15DataState.forEach(row => {
        const days = parseInt(row.连续出勤天数 || 0) || 0;
        if (days < 15) return;
        const center = row.中心 || row.中心名称 || '';
        const province = row.省区 || row.省区名称 || centerToProvince.get(center) || '';
        const dateStr = parseDate(row['数据日期'] || row.date || row.日期);
        const key = `${center}_${province}_${dateStr}`;
        att15ByCenterDate.set(key, (att15ByCenterDate.get(key) || 0) + 1);
        if (days > 30) att15Over30ByCenterDate.set(key, (att15Over30ByCenterDate.get(key) || 0) + 1);
      });
    }

    const att7ByCenterDate = new Map<string, number>();
    if (attendance7DataState) {
      attendance7DataState.forEach(row => {
        const days = parseInt(row.连续未出勤天数 || 0) || 0;
        if (days < 7) return;
        const center = row.中心 || row.中心名称 || '';
        const province = row.省区 || row.省区名称 || centerToProvince.get(center) || '';
        const dateStr = parseDate(row['数据日期'] || row.date || row.日期);
        const key = `${center}_${province}_${dateStr}`;
        att7ByCenterDate.set(key, (att7ByCenterDate.get(key) || 0) + 1);
      });
    }

    const whHighByCenterDate = aggregateByCenterDate(workHoursHighDataState || [], () => true);
    const whLowByCenterDate = aggregateByCenterDate(workHoursLowDataState || [], () => true);

    // 花名册数据聚合
    const rosterByCenter = new Map<string, RosterStats>();
    if (rosterDataState) {
      const firstRow = rosterDataState.find((r: any) => r && typeof r === 'object' && Object.keys(r).length > 0);
      if (firstRow) {
        const cols = Object.keys(firstRow as any);
        const deptCol = cols.find(c => c.includes('二级部门')) || '二级部门';
        const centerCol = cols.find(c => c.includes('七级单位')) || cols.find(c => c.includes('六级单位')) || '六级单位';
        const provinceCol = cols.find(c => c.includes('五级单位')) || '五级单位';
        const jobCol = cols.find(c => c.includes('岗位名称')) || '岗位名称';

        rosterDataState.forEach((row: any) => {
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
      }
    }

    // 非操作人数统计（九级单位 + 排除中心操作/特殊岗位）
    const nonOpByCenter = new Map<string, { nonOp: number; total: number; departments: Record<string, number>; positions: Record<string, { dept: string; count: number }> }>();
    const EXCLUDE_DEPTS = ['中心操作', '中心现场管理'];
    const EXCLUDE_POSITIONS = ['安检员', '仓库管理员', '环保袋管理维修员', '中心环保袋管理组长', '环保袋仓库管理员'];
    if (rosterDataState) {
      const firstRow = rosterDataState.find((r: any) => r && typeof r === 'object' && Object.keys(r).length > 0);
      if (firstRow) {
        const cols = Object.keys(firstRow as any);
        const col9 = cols.find(c => c.includes('九级单位')) || '';
        const deptCol = cols.find(c => c.includes('二级部门')) || '二级部门';
        const jobCol = cols.find(c => c.includes('岗位名称')) || '岗位名称';
        rosterDataState.forEach((row: any) => {
          if (!row || typeof row !== 'object') return;
          const unit9 = String(row[col9] || '').trim();
          const tcMatch = unit9.match(/^(.+)转运中心$/);
          if (!tcMatch) return;
          const centerName = tcMatch[1];
          let entry = nonOpByCenter.get(centerName);
          if (!entry) { entry = { nonOp: 0, total: 0, departments: {}, positions: {} }; nonOpByCenter.set(centerName, entry); }
          entry.total++;
          const dept = String(row[deptCol] || '').trim();
          const pos = String(row[jobCol] || '').trim();
          const isOps = EXCLUDE_DEPTS.includes(dept) || EXCLUDE_POSITIONS.includes(pos);
          if (!isOps) {
            entry.nonOp++;
            entry.departments[dept] = (entry.departments[dept] || 0) + 1;
            const posKey = `${dept}|${pos}`;
            if (!entry.positions[posKey]) entry.positions[posKey] = { dept, count: 0 };
            entry.positions[posKey].count++;
          }
        });
      }
    }

    // 花名册模糊查找
    function findRosterStats(centerName: string, provinceName: string): RosterStats | null {
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

    // 遍历省区，增强每个中心
    return displayData.map(province => {
      const enrichedProvince = { ...province };
      enrichedProvince.dimensions = { ...province.dimensions };

      enrichedProvince.subCenters = (province.subCenters || []).map((center: any) => {
        const enrichedCenter = { ...center };
        enrichedCenter.metrics = {};

        // 花名册基础数据
        const rosterStats = findRosterStats(center.name, province.province);
        const t2SalaryBase = rosterStats ? rosterStats.total : 0;

        // === 岗位效能异常 (满分25) ===
        const t2JobCount = findCount(jobByCenterDate, center.name, province.province, t2DateStr);
        const t3JobCount = findCount(jobByCenterDate, center.name, province.province, t3DateStr);
        enrichedCenter.metrics.job = Math.max(0, SCORE.JOB - t2JobCount * PENALTY.JOB_PER);
        enrichedCenter.abnormalCount = t2JobCount;
        enrichedCenter.prevAbnormalCount = t3JobCount;
        enrichedCenter.t2JobCount = t2JobCount;

        // === 绩效异常 (满分15) ===
        const t2SalaryCount = findCount(salaryByCenterDate, center.name, province.province, t2DateStr);
        const t3SalaryCount = findCount(salaryByCenterDate, center.name, province.province, t3DateStr);
        const rateNum = t2SalaryBase > 0 ? (t2SalaryCount / t2SalaryBase) * 100 : 0;
        const salaryScore = rateNum <= cfg.salaryCoverageThreshold ? SCORE.SALARY : Math.max(0, SCORE.SALARY - Math.round((rateNum - cfg.salaryCoverageThreshold) * PENALTY.SALARY_PCT));
        if (salaryDataState && salaryDataState.length > 0) {
          enrichedCenter.metrics.salary = salaryScore;
          enrichedCenter.prevSalaryCount = t3SalaryCount;
          enrichedCenter.salaryCount = t2SalaryBase;
          enrichedCenter.salaryCoverage = t2SalaryBase > 0 ? `${(rateNum).toFixed(1)}%` : '0%';
          enrichedCenter.t2SalaryCount = t2SalaryCount;
        }

        // === 连续15日出勤 (满分25) ===
        const t2Att15Count = findCount(att15ByCenterDate, center.name, province.province, t2DateStr);
        const t3Att15Count = findCount(att15ByCenterDate, center.name, province.province, t3DateStr);
        const att15RateNum = t2SalaryBase > 0 ? (t2Att15Count / t2SalaryBase) * 100 : 0;
        const t2Over30 = findCount(att15Over30ByCenterDate, center.name, province.province, t2DateStr);
        const coverageDeduction = att15RateNum <= cfg.att15RateThreshold ? 0 : Math.round((att15RateNum - cfg.att15RateThreshold) * PENALTY.ATT15_PCT);
        const att15Score = Math.max(0, SCORE.ATT15 - coverageDeduction - t2Over30 * PENALTY.ATT15_O30);
        if (attendance15DataState && attendance15DataState.length > 0) {
          enrichedCenter.metrics.att15 = att15Score;
          enrichedCenter.att15Count = t2Att15Count;
          enrichedCenter.att15Rate = t2SalaryBase > 0 ? `${(att15RateNum).toFixed(1)}%` : '0%';
          enrichedCenter.att15New = t2Att15Count - t3Att15Count;
          enrichedCenter.t2Att15Count = t2Att15Count;
          enrichedCenter.att15Over30 = t2Over30;
        }

        // === 连续7日未出勤 (满分25) ===
        const t2Att7Count = findCount(att7ByCenterDate, center.name, province.province, t2DateStr);
        const t3Att7Count = findCount(att7ByCenterDate, center.name, province.province, t3DateStr);
        const att7Score = Math.max(0, SCORE.ATT7 - t2Att7Count * PENALTY.ATT7_PER);
        if (attendance7DataState && attendance7DataState.length > 0) {
          enrichedCenter.metrics.att7 = att7Score;
          enrichedCenter.att7Count = t2Att7Count;
          enrichedCenter.att7New = t2Att7Count - t3Att7Count;
          enrichedCenter.t2Att7Count = t2Att7Count;
        }

        // === 日工时高 (满分5) ===
        const t2WhHighCount = findCount(whHighByCenterDate, center.name, province.province, t2DateStr);
        const t3WhHighCount = findCount(whHighByCenterDate, center.name, province.province, t3DateStr);
        const whHighRateNum = t2SalaryBase > 0 ? (t2WhHighCount / t2SalaryBase) * 100 : 0;
        const whHighScore = whHighRateNum <= cfg.whHighRateThreshold ? SCORE.WH_HIGH : Math.max(0, SCORE.WH_HIGH - Math.round(whHighRateNum - cfg.whHighRateThreshold) * PENALTY.WH_HIGH_PCT);
        if (workHoursHighDataState && workHoursHighDataState.length > 0) {
          enrichedCenter.metrics.workHoursHigh = whHighScore;
          enrichedCenter.whHighCount = t2WhHighCount;
          enrichedCenter.whHighRate = t2SalaryBase > 0 ? `${(whHighRateNum).toFixed(1)}%` : '0%';
          enrichedCenter.whHighNew = t2WhHighCount - t3WhHighCount;
          enrichedCenter.t2WhHighCount = t2WhHighCount;
        }

        // === 日工时低 (满分5) ===
        const t2WhLowCount = findCount(whLowByCenterDate, center.name, province.province, t2DateStr);
        const t3WhLowCount = findCount(whLowByCenterDate, center.name, province.province, t3DateStr);
        const whLowScore = Math.max(0, SCORE.WH_LOW - t2WhLowCount);
        if (workHoursLowDataState && workHoursLowDataState.length > 0) {
          enrichedCenter.metrics.workHoursLow = whLowScore;
          enrichedCenter.whLowCount = t2WhLowCount;
          enrichedCenter.whLowNew = t2WhLowCount - t3WhLowCount;
          enrichedCenter.t2WhLowCount = t2WhLowCount;
        }

        // === 管幅 ===
        if (rosterStats) {
          const mgrTotal = rosterStats.leaders + rosterStats.managers;
          const workers = rosterStats.total - mgrTotal;
          enrichedCenter.rosterTotal = rosterStats.total;
          enrichedCenter.rosterLeaders = rosterStats.leaders;
          enrichedCenter.rosterManagers = rosterStats.managers;
          enrichedCenter.compositeScope = mgrTotal > 0 ? parseFloat((workers / mgrTotal).toFixed(1)) : 0;
          enrichedCenter.leaderScope = rosterStats.leaders > 0 ? parseFloat((workers / rosterStats.leaders).toFixed(1)) : 0;
          enrichedCenter.compOverTarget = parseFloat((workers / span.composite - mgrTotal).toFixed(1));
          enrichedCenter.leadOverTarget = parseFloat((workers / span.leader - rosterStats.leaders).toFixed(1));
        }

        // === 非操占比 ===
        const nonOpStats = nonOpByCenter.get(center.name);
        if (nonOpStats && nonOpStats.total > 0) {
          const outsourced = outsourcingData?.[center.name] ?? 0;
          const totalPeople = nonOpStats.total + outsourced;
          const totalNonOp = nonOpStats.nonOp + outsourced; // 非操人数含外包
          enrichedCenter.nonOpRatio = totalPeople > 0 ? parseFloat(((totalNonOp / totalPeople) * 100).toFixed(2)) : 0;
          enrichedCenter.nonOpCount = totalNonOp;
          enrichedCenter.outsourced = outsourced;
          enrichedCenter.rosterInService = nonOpStats.total;
          enrichedCenter.nonOpDepartments = nonOpStats.departments; // 各部门人数明细
          enrichedCenter.nonOpPositions = nonOpStats.positions;       // 各岗位人数明细
          enrichedCenter.staffingStandard = computeStaffingStandard(center.name, nonOpStats.total, nonOpStats.departments);
        }

        // === 中心总分 = 六项之和 ===
        enrichedCenter.score = (enrichedCenter.metrics.job || 0)
          + (enrichedCenter.metrics.salary || 0)
          + (enrichedCenter.metrics.att15 || 0)
          + (enrichedCenter.metrics.att7 || 0)
          + (enrichedCenter.metrics.workHoursHigh || 0)
          + (enrichedCenter.metrics.workHoursLow || 0);

        return enrichedCenter;
      });

      // ── 省区维度聚合 ──

      // 绩效异常
      const hasRealSalary = enrichedProvince.subCenters.some((c: any) => (c.t2SalaryCount || 0) > 0);
      if (enrichedProvince.subCenters.length > 0 && hasRealSalary) {
        const totalSalaryScore = enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.metrics?.salary || 0), 0);
        const totalSalaryBase = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.salaryCount || 0), 0);
        const totalT2Count = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.t2SalaryCount || 0), 0);
        const provinceCoverage = totalSalaryBase > 0 ? ((totalT2Count / totalSalaryBase) * 100).toFixed(1) + '%' : '0%';
        enrichedProvince.dimensions.salary = {
          name: '绩效异常',
          score: Math.round(totalSalaryScore / enrichedProvince.subCenters.length),
          weight: 15,
          metrics: [
            { label: '覆盖率', value: provinceCoverage },
            { label: '算薪', value: totalSalaryBase },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.salary;
      }

      // 连续出勤
      const hasRealAtt15 = enrichedProvince.subCenters.some((c: any) => (c.t2Att15Count || 0) > 0);
      if (enrichedProvince.subCenters.length > 0 && hasRealAtt15) {
        const totalAtt15Score = enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.metrics?.att15 || 0), 0);
        const totalAtt15Count = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.att15Count || 0), 0);
        const totalRosterOps = enrichedProvince.subCenters.reduce((s: number, c: any) => {
          const rStats = findRosterStats(c.name, province.province);
          return s + (rStats ? rStats.total : 0);
        }, 0);
        const provinceAtt15Rate = totalRosterOps > 0 ? ((totalAtt15Count / totalRosterOps) * 100).toFixed(1) + '%' : '0%';
        const totalAtt15New = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.att15New || 0), 0);
        enrichedProvince.dimensions.attendance15 = {
          name: '连续出勤',
          score: Math.round(totalAtt15Score / enrichedProvince.subCenters.length),
          weight: 25,
          metrics: [
            { label: '触发率', value: provinceAtt15Rate },
            { label: '新增', value: totalAtt15New },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.attendance15;
      }

      // 长期未出勤
      const hasRealAtt7 = enrichedProvince.subCenters.some((c: any) => (c.t2Att7Count || 0) > 0);
      if (enrichedProvince.subCenters.length > 0 && hasRealAtt7) {
        const totalAtt7Score = enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.metrics?.att7 || 0), 0);
        const totalAtt7Count = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.att7Count || 0), 0);
        const totalAtt7New = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.att7New || 0), 0);
        enrichedProvince.dimensions.attendance7 = {
          name: '长期未出勤',
          score: Math.round(totalAtt7Score / enrichedProvince.subCenters.length),
          weight: 25,
          metrics: [
            { label: '异常', value: totalAtt7Count },
            { label: '新增', value: totalAtt7New },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.attendance7;
      }

      // 日工时高
      const hasRealWhHigh = enrichedProvince.subCenters.some((c: any) => c.metrics?.workHoursHigh !== undefined);
      if (enrichedProvince.subCenters.length > 0 && hasRealWhHigh) {
        const totalWhHighScore = enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.metrics?.workHoursHigh || 0), 0);
        const totalWhHighCount = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.whHighCount || 0), 0);
        const totalWhHighNew = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.whHighNew || 0), 0);
        enrichedProvince.dimensions.workHoursHigh = {
          name: '日工时高',
          score: Math.round(totalWhHighScore / enrichedProvince.subCenters.length),
          weight: 5,
          metrics: [
            { label: '触发人数', value: totalWhHighCount },
            { label: '新增', value: totalWhHighNew },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.workHoursHigh;
      }

      // 日工时低
      const hasRealWhLow = enrichedProvince.subCenters.some((c: any) => c.metrics?.workHoursLow !== undefined);
      if (enrichedProvince.subCenters.length > 0 && hasRealWhLow) {
        const totalWhLowScore = enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.metrics?.workHoursLow || 0), 0);
        const totalWhLowCount = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.whLowCount || 0), 0);
        const totalWhLowNew = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.whLowNew || 0), 0);
        enrichedProvince.dimensions.workHoursLow = {
          name: '日工时低',
          score: Math.round(totalWhLowScore / enrichedProvince.subCenters.length),
          weight: 5,
          metrics: [
            { label: '异常人数', value: totalWhLowCount },
            { label: '新增', value: totalWhLowNew },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.workHoursLow;
      }

      // 效能异常
      const hasRealJob = enrichedProvince.subCenters.some((c: any) => (c.t2JobCount || 0) > 0);
      if (enrichedProvince.subCenters.length > 0 && hasRealJob) {
        const totalJobScore = enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.metrics?.job || 0), 0);
        const totalAbnormalCount = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.abnormalCount || 0), 0);
        const totalPrevAbnormalCount = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.prevAbnormalCount || 0), 0);
        enrichedProvince.dimensions.job = {
          name: '效能异常',
          score: Math.round(totalJobScore / enrichedProvince.subCenters.length),
          weight: 25,
          metrics: [
            { label: '异常岗位', value: totalAbnormalCount },
            { label: '新增', value: totalAbnormalCount - totalPrevAbnormalCount },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.job;
      }

      // 管幅
      const hasRoster = enrichedProvince.subCenters.some((c: any) => c.rosterTotal !== undefined);
      if (enrichedProvince.subCenters.length > 0 && hasRoster) {
        const centersWithRoster = enrichedProvince.subCenters.filter((c: any) => c.rosterTotal !== undefined);
        const avgComposite = centersWithRoster.length > 0
          ? (centersWithRoster.reduce((s: number, c: any) => s + (c.compositeScope || 0), 0) / centersWithRoster.length).toFixed(2)
          : '0';
        const avgLeader = centersWithRoster.length > 0
          ? (centersWithRoster.reduce((s: number, c: any) => s + (c.leaderScope || 0), 0) / centersWithRoster.length).toFixed(2)
          : '0';
        const totalWorkers = centersWithRoster.reduce((s: number, c: any) => s + ((c.rosterTotal || 0) - (c.rosterLeaders || 0) - (c.rosterManagers || 0)), 0);
        const totalLeaders = centersWithRoster.reduce((s: number, c: any) => s + (c.rosterLeaders || 0), 0);
        const totalManagers = centersWithRoster.reduce((s: number, c: any) => s + (c.rosterManagers || 0), 0);
        enrichedProvince.dimensions.scope = {
          name: '中心管幅',
          score: 0,
          weight: 0,
          metrics: [
            { label: '综合管幅', value: avgComposite },
            { label: '组长管幅', value: avgLeader },
            { label: '操作人数', value: totalWorkers },
            { label: '组长', value: totalLeaders },
            { label: '主管', value: totalManagers },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.scope;
      }

      // 省区总分
      const newTotalScore = enrichedProvince.subCenters.length > 0
        ? Math.round(enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / enrichedProvince.subCenters.length)
        : 0;
      enrichedProvince.totalScore = newTotalScore;
      enrichedProvince.performanceScore = newTotalScore;

      return enrichedProvince;
    });
  }, [displayData, rawDataState, salaryDataState, attendance15DataState, attendance7DataState, rosterDataState, workHoursHighDataState, workHoursLowDataState]);
}
