/**
 * GPT 每日通报 — 详情报告生成器
 * 基于当前所有真实数据，自动生成文字报告
 */

import type { Selection } from '../App';

export interface CenterReportItem {
  provinceName: string;
  centerName: string;
  responsible: string;
  score: number;

  /** 效能异常 */
  jobAbnormalCount: number;
  jobPrevCount: number;
  jobDetails?: Array<{
    jobName: string;
    deviation: number;
    actualValue: number;
    targetValue: number;
  }>;

  /** 绩效异常（薪资） */
  salaryCount: number;
  salaryPrevCount: number;  // 前一天绩效异常人数
  salaryCoverage: string;
  salaryBase: number;
  salaryDetails?: Array<{
    name: string;
    jobName: string;
    avgDeviation: number;
  }>;

  /** 连续出勤 ≥15天 */
  att15Count: number;
  att15PrevCount: number;  // 前一天连续出勤人数
  att15Rate: string;
  att15New: number;
  att15Over30?: number;
  att15Details?: Array<{
    name: string;
    jobName: string;
    continuousDays: number;
  }>;

  /** 长期未出勤 ≥7天 */
  att7Count: number;
  att7PrevCount: number;  // 前一天长期未出勤人数
  att7New: number;
  att7Details?: Array<{
    name: string;
    jobName: string;
    continuousDays: number;
  }>;
}

export interface ProvinceReport {
  provinceName: string;
  responsible: string;
  totalScore: number;
  ranking: number;
  centers: CenterReportItem[];
}

export interface OverviewTableRow {
  centerName: string;
  score: number;
  compositeScope: number;   // 综合管幅
  leaderScope: number;      // 组长管幅
  compOverTarget: number;    // 综合超目标
  leadOverTarget: number;    // 组长超目标
  jobAbnormal: number;       // 效能异常
  salaryCount: number;       // 绩效异常人数
  salaryCoverage: string;    // 绩效异常覆盖率
  att15Count: number;       // 连续出勤≥15天人数
  att15Rate: string;        // 连续出勤触发率
  att7Count: number;        // 长期未出勤≥7天人数
  att7Rate: string;         // 长期未出勤触发率
}

export interface FullReport {
  reportDate: string;       // T-2 日期文字
  dateStr: string;          // T-2 YYYY-MM-DD
  generatedAt: string;      // 生成时间
  overallScore: number;     // 全区平均分
  totalProvinces: number;
  provinces: ProvinceReport[];
  summary: string;          // 一段话总结
  overviewTable: OverviewTableRow[];  // 各中心总览表数据
  prevTotalJobAbnormal: number; // 前一天效能异常总数（用于环比）
}

/**
 * 将 Excel 日期序列号/字符串转为 YYYY-MM-DD
 */
function normalizeDate(rawValue: any): string {
  if (typeof rawValue === 'number') {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + rawValue * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof rawValue === 'string') return rawValue.replace(/\//g, '-');
  return '';
}

/**
 * 生成完整报告
 * 优化：直接使用 filteredData（已计算好的数据），避免重复计算
 */
export function generateReport(params: {
  filteredData: any[];              // 已计算的省区/中心数据（直接使用）
  rawData?: any[];                  // 岗位效能原始数据（仅用于明细）
  salaryData?: any[];               // 薪资异常原始数据（仅用于明细）
  attendance15Data?: any[];         // 连续15日出勤原始数据（仅用于明细）
  attendance7Data?: any[];          // 连续7日未出勤原始数据（仅用于明细）
}): FullReport {
  const { filteredData, rawData, salaryData, attendance15Data, attendance7Data } = params;

  // T-2 日期
  const today = new Date();
  const t2 = new Date(today);
  t2.setDate(today.getDate() - 2);
  const dateStr = `${t2.getFullYear()}-${String(t2.getMonth() + 1).padStart(2, '0')}-${String(t2.getDate()).padStart(2, '0')}`;
  const reportDate = `${t2.getFullYear()}年${String(t2.getMonth() + 1).padStart(2, '0')}月${String(t2.getDate()).padStart(2, '0')}日`;

  const sortedData = [...filteredData].sort((a, b) => b.totalScore - a.totalScore);
  const overallScore = Math.round(sortedData.reduce((s, r) => s + (r.totalScore || 0), 0) / sortedData.length);

  const overviewTable: OverviewTableRow[] = [];  // 总览表数据

  const provinces: ProvinceReport[] = sortedData.map((prov, idx) => {
    const centers: CenterReportItem[] = (prov.subCenters || []).map((center: any) => {
      const item: CenterReportItem = {
        provinceName: prov.province,
        centerName: center.name,
        responsible: center.responsible || '-',
        score: center.score || 0,

        jobAbnormalCount: center.abnormalCount || 0,
        jobPrevCount: center.prevAbnormalCount || 0,

        salaryCount: center.t2SalaryCount || 0,
        salaryCoverage: center.salaryCoverage || '0%',
        salaryBase: center.salaryCount || 0,

        att15Count: center.att15Count || 0,
        att15Rate: center.att15Rate || '0%',
        att15New: center.att15New || 0,
        att15Over30: center.att15Over30 || 0,

        att7Count: center.att7Count || 0,
        att7New: center.att7New || 0,
      };

      // 提取效能异常明细（T-2 当天的）
      if (rawData && rawData.length > 0) {
        const t2Rows = rawData.filter(row => {
          const rp = row.省区 || row.province || '';
          const rc = row.中心 || row.center || '';
          const rd = normalizeDate(row['数据日期'] || row.date || row.日期);
          return rp.includes(prov.province) && rc === center.name && rd === dateStr;
        });
        const abnormalRows = t2Rows.filter(r => parseFloat(r['目标偏离（%）'] || 0) >= 10);
        item.jobDetails = abnormalRows.map(r => ({
          jobName: r['岗位'] || r['岗位名称'] || r.jobName || '未知岗位',
          deviation: parseFloat(r['目标偏离（%）'] || 0),
          actualValue: parseFloat(r['当月人均日绩效'] || 0),
          targetValue: parseFloat(r['目标值'] || 0),
        }));
      }

      // 提取薪资异常明细（T-2 当天的）
      if (salaryData && salaryData.length > 0) {
        const t2SalaryRows = salaryData.filter(row => {
          const rp = row.省区 || row.省区名称 || '';
          const rc = row.中心 || row.中心名称 || '';
          const rd = normalizeDate(row['数据日期'] || row.date || row.日期);
          const cMatch = rc.includes(center.name) || center.name.includes(rc);
          const pMatch = rp.includes(prov.province) || prov.province.includes(rp);
          return pMatch && cMatch && rd === dateStr;
        });
        item.salaryDetails = t2SalaryRows.map(r => ({
          name: r.姓名 || '',
          jobName: r.岗位 || '',
          avgDeviation: parseFloat(r['均值偏离（%）'] || 0),
        }));
      }

      // 提取连续出勤≥15天明细（T-2 当天的）
      if (attendance15Data && attendance15Data.length > 0) {
        const t2Att15Rows = attendance15Data.filter(row => {
          const rp = row.省区 || row.省区名称 || '';
          const rc = row.中心 || row.中心名称 || '';
          const rd = normalizeDate(row['数据日期'] || row.date || row.日期);
          const days = parseInt(row.连续出勤天数 || 0) || 0;
          const cMatch = rc.includes(center.name) || center.name.includes(rc);
          const pMatch = rp.includes(prov.province) || prov.province.includes(rp);
          return pMatch && cMatch && rd === dateStr && days >= 15;
        });
        item.att15Details = t2Att15Rows.map(r => ({
          name: r.姓名 || '',
          jobName: r.岗位 || '',
          continuousDays: parseInt(r.连续出勤天数 || 0),
        }));
      }

      // 提取连续未出勤≥7天明细（T-2 当天的）
      if (attendance7Data && attendance7Data.length > 0) {
        const t2Att7Rows = attendance7Data.filter(row => {
          const rp = row.省区 || row.省区名称 || '';
          const rc = row.中心 || row.中心名称 || '';
          const rd = normalizeDate(row['数据日期'] || row.date || row.日期);
          const days = parseInt(row.连续未出勤天数 || 0) || 0;
          const cMatch = rc.includes(center.name) || center.name.includes(rc);
          const pMatch = rp.includes(prov.province) || prov.province.includes(rp);
          return pMatch && cMatch && rd === dateStr && days >= 7;
        });
        item.att7Details = t2Att7Rows.map(r => ({
          name: r.姓名 || '',
          jobName: r.岗位 || '',
          continuousDays: parseInt(r.连续未出勤天数 || 0),
        }));
      }

      // 填充总览表数据
      const att7Rate = center.rosterTotal > 0 ? ((center.att7Count || 0) / center.rosterTotal * 100).toFixed(1) + '%' : '0%';
      overviewTable.push({
        centerName: center.name,
        score: center.score || 0,
        compositeScope: center.compositeScope || 0,
        leaderScope: center.leaderScope || 0,
        compOverTarget: center.compOverTarget || 0,
        leadOverTarget: center.leadOverTarget || 0,
        jobAbnormal: center.abnormalCount || 0,
        salaryCount: center.t2SalaryCount || 0,
        salaryCoverage: center.salaryCoverage || '0%',
        att15Count: center.att15Count || 0,
        att15Rate: center.att15Rate || '0%',
        att7Count: center.att7Count || 0,
        att7Rate: att7Rate,
      });

      return item;
    });

    return {
      provinceName: prov.province,
      responsible: prov.responsible || '-',
      totalScore: prov.totalScore || 0,
      ranking: idx + 1,
      centers,
    };
  });

  // 生成总结段落
  const summary = generateSummary(provinces);

  // 计算前一天效能异常总数（用于环比）
  const prevTotalJobAbnormal = provinces.reduce((s, p) => s + p.centers.reduce((s2, c) => s2 + (c.jobPrevCount || 0), 0), 0);

  return {
    reportDate,
    dateStr,
    generatedAt: new Date().toLocaleString('zh-CN'),
    overallScore,
    totalProvinces: provinces.length,
    provinces,
    summary,
    overviewTable,
    prevTotalJobAbnormal,
  };
}

/**
 * 生成报告总结段落（含环比分析、对比分析和行动建议）
 */
function generateSummary(provinces: ProvinceReport[]): string {
  const lines: string[] = [];

  // 基础数据
  const totalCenters = provinces.reduce((s, p) => s + p.centers.length, 0);
  const overallScore = Math.round(provinces.reduce((s, p) => s + p.totalScore, 0) / provinces.length);

  // 环比数据：汇总前一天异常数
  let totalJobPrev = 0;
  provinces.forEach(p => p.centers.forEach(c => {
    totalJobPrev += c.jobPrevCount || 0;
  }));

  let totalJobNow = 0;
  provinces.forEach(p => p.centers.forEach(c => {
    totalJobNow += c.jobAbnormalCount || 0;
  }));

  const jobChange = totalJobNow - totalJobPrev;
  const jobTrend = jobChange > 0 ? `增加 ${jobChange} 个` : jobChange < 0 ? `减少 ${Math.abs(jobChange)} 个` : '持平';

  // ── 核心结论（前置）──
  lines.push(`【核心结论】本期华中大区共 ${provinces.length} 个省区、${totalCenters} 个中心参与考核，全区综合均分 ${overallScore} 分。`);
  lines.push(`效能异常岗位 ${totalJobNow} 个（前一天 ${totalJobPrev} 个，环比${jobTrend}）。`);
  lines.push('');

  // ── 排名概况 ──
  const topProv = provinces[0];
  const bottomProv = provinces[provinces.length - 1];

  if (topProv) {
    const topCenters = topProv.centers.filter(c => c.score >= 80).length;
    lines.push(`🥇 排名第一：${topProv.provinceName}（${topProv.totalScore} 分，${topCenters}/${topProv.centers.length} 个中心≥80分），负责人：${topProv.responsible}。`);
  }
  if (bottomProv && bottomProv !== topProv) {
    const bottomCenters = bottomProv.centers.filter(c => c.score < 50).length;
    lines.push(`⚠️ 排名末位：${bottomProv.provinceName}（${bottomProv.totalScore} 分，${bottomCenters}/${bottomProv.centers.length} 个中心<50分），需重点关注。负责人：${bottomProv.responsible}。`);
  }
  lines.push('');

  // ── 环比分析 ──
  lines.push('【环比分析】');
  if (totalJobPrev > 0) {
    const changePct = Math.round((jobChange / totalJobPrev) * 100);
    if (changePct > 10) {
      lines.push(`⚠️ 效能异常环比上升 ${changePct}%，恶化趋势明显，建议立即排查原因。`);
    } else if (changePct < -10) {
      lines.push(`✅ 效能异常环比下降 ${Math.abs(changePct)}%，改善趋势良好，请保持。`);
    } else {
      lines.push(`➡️ 效能异常环比${jobTrend}，整体平稳。`);
    }
  } else {
    lines.push(`本期新增效能异常统计，暂无环比数据。`);
  }
  lines.push('');

  // ── 各维度异常汇总 ──
  let totalSalary = 0, totalAtt15 = 0, totalAtt7 = 0;
  provinces.forEach(p => p.centers.forEach(c => {
    totalSalary += c.salaryCount;
    totalAtt15 += c.att15Count;
    totalAtt7 += c.att7Count;
  }));

  const issues: string[] = [];
  if (totalJobNow > 0) issues.push(`效能异常 ${totalJobNow} 个`);
  if (totalSalary > 0) issues.push(`绩效异常 ${totalSalary} 人`);
  if (totalAtt15 > 0) issues.push(`连续出勤≥15天 ${totalAtt15} 人`);
  if (totalAtt7 > 0) issues.push(`长期未出勤≥7天 ${totalAtt7} 人`);

  lines.push('【异常汇总】');
  if (issues.length > 0) {
    lines.push(`共发现异常：${issues.join('，')}。`);
  } else {
    lines.push('各维度暂无异常数据，整体运营平稳。');
  }
  lines.push('');

  // ── 行动建议 ──
  lines.push('【行动建议】');
  const suggestions: string[] = [];

  if (bottomProv && bottomProv !== topProv) {
    suggestions.push(`请 ${bottomProv.responsible}（${bottomProv.provinceName}）牵头分析低分原因，24小时内提交整改计划`);
  }
  if (totalJobNow > totalJobPrev && totalJobPrev > 0) {
    suggestions.push(`效能异常环比上升，建议各中心负责人今日复盘异常岗位，制定改进措施`);
  }
  if (totalAtt15 > 0) {
    suggestions.push(`连续出勤≥15天人员共 ${totalAtt15} 人，建议合理安排轮休，避免疲劳作业`);
  }
  if (totalAtt7 > 0) {
    suggestions.push(`长期未出勤≥7天人员共 ${totalAtt7} 人，请跟进确认人员状态`);
  }
  if (suggestions.length === 0) {
    suggestions.push('整体运营平稳，请继续保持，重点关注数据波动。');
  }

  suggestions.forEach((s, i) => lines.push(`${i + 1}. ${s}`));

  return lines.join('\n');
}

/**
 * 将报告渲染为纯文本（移动端友好格式，核心结论前置）
 */
export function renderReportAsText(report: FullReport): string {
  const lines: string[] = [];
  const wrap = (text: string, maxLen = 40) => {
    // 简单换行，避免移动端横向滚动
    const res: string[] = [];
    let cur = '';
    for (const ch of text) {
      cur += ch;
      if (cur.length >= maxLen && ch === ' ') {
        res.push(cur.trimEnd());
        cur = '';
      }
    }
    if (cur) res.push(cur.trimEnd());
    return res;
  };

  // ── 标题 + 核心信息（前置）──
  const totalJob = report.provinces.reduce((s, p) => s + p.centers.reduce((s2, c) => s2 + c.jobAbnormalCount, 0), 0);
  const totalSalary = report.provinces.reduce((s, p) => s + p.centers.reduce((s2, c) => s2 + c.salaryCount, 0), 0);
  const totalAtt15 = report.provinces.reduce((s, p) => s + p.centers.reduce((s2, c) => s2 + c.att15Count, 0), 0);
  const totalAtt7 = report.provinces.reduce((s, p) => s + p.centers.reduce((s2, c) => s2 + c.att7Count, 0), 0);
  
  lines.push(`GPT数据通报 — ${report.reportDate}`);
  lines.push(`全区均分：${report.overallScore}分 | 效能异常：${totalJob}个 | 绩效异常：${totalSalary}人 | 连续出勤：${totalAtt15}人 | 长期未出勤：${totalAtt7}人`);
  lines.push('');

  // ── 执行摘要（核心结论前置）──
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('  执行摘要');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  // 按行换行，避免一行过长
  report.summary.split('\n').forEach(paragraph => {
    if (paragraph.trim()) {
      lines.push(...wrap(paragraph));
    } else {
      lines.push('');
    }
  });
  lines.push('');
  lines.push('');

  // ── 各中心详情 ──
  for (const prov of report.provinces) {
    for (const center of prov.centers) {
      const scoreColor = center.score >= 80 ? '✅' : center.score >= 50 ? '⚠️' : '❌';
      lines.push(`${scoreColor} ${center.centerName}（${center.responsible}）${center.score}分`);


      // 精简版：只显示异常类型和数值
      const abnormalItems: string[] = [];
      
      // 效能异常
      if (center.jobAbnormalCount > 0) {
        if (center.jobDetails?.length) {
          const jobStr = center.jobDetails.map(d => `${d.jobName}+${d.deviation}%`).join(' ');
          abnormalItems.push(`效能：${jobStr}`);
        } else {
          abnormalItems.push(`效能：${center.jobAbnormalCount}个`);
        }
      }
      
      // 绩效异常
      if (center.salaryCount > 0) {
        abnormalItems.push(`绩效：${center.salaryCoverage}(${center.salaryCount}人)`);
      }
      
      // 连续出勤
      if (center.att15Count > 0) {
        const extra = center.att15Over30 ? ` >30天${center.att15Over30}人` : '';
        abnormalItems.push(`出勤：${center.att15Rate}(${center.att15Count}人${extra})`);
      }
      
      // 长期未出勤
      if (center.att7Count > 0) {
        abnormalItems.push(`未出勤：${center.att7Count}人`);
      }
      
      if (abnormalItems.length > 0) {
        lines.push(`  ${abnormalItems.join(' | ')}`);
      } else {
        lines.push(`  (无异常)`);
      }
      lines.push('');
    }
  }

  lines.push('─'.repeat(36));
  lines.push(`  由 GPT 数据通报系统自动生成 · ${report.generatedAt}`);
  lines.push('');

  return lines.join('\n');
}

// 微信精简版通报（删除分隔线、压缩空行、保留核心信息）
export function renderReportAsTextCompact(report: FullReport): string {
  const lines: string[] = [];

  // 标题
  lines.push(`GPT数据通报 — ${report.reportDate}`);
  const totalJobAbnormal = report.provinces.reduce((s, p) => s + p.centers.reduce((s2, c) => s2 + c.jobAbnormalCount, 0), 0);
  const totalSalary = report.provinces.reduce((s, p) => s + p.centers.reduce((s2, c) => s2 + c.salaryCount, 0), 0);
  const totalAtt15 = report.provinces.reduce((s, p) => s + p.centers.reduce((s2, c) => s2 + c.att15Count, 0), 0);
  const totalAtt7 = report.provinces.reduce((s, p) => s + p.centers.reduce((s2, c) => s2 + c.att7Count, 0), 0);
  lines.push(`全区均分：${report.overallScore}分 | 效能异常：${totalJobAbnormal}个 | 绩效异常：${totalSalary}人 | 连续出勤：${totalAtt15}人 | 长期未出勤：${totalAtt7}人`);
  lines.push('');

  // 执行摘要
  const topProvince = report.provinces[0];
  const bottomProvince = report.provinces[report.provinces.length - 1];
  lines.push('【执行摘要】');
  lines.push(`${topProvince.province}${topProvince.totalScore}分第一(负责人：${topProvince.responsible}) | ${bottomProvince.province}${bottomProvince.totalScore}分末位需重点关注(负责人：${bottomProvince.responsible})`);
  lines.push(`效能异常${totalJobAbnormal}个，整体${totalJobAbnormal > report.prevTotalJobAbnormal ? '上升' : '平稳'}。`);
  lines.push('');

  // 行动建议
  lines.push('【行动建议】');
  lines.push(`1. 请${bottomProvince.responsible}(${bottomProvince.province})牵头分析低分原因，24小时内提交整改计划`);
  if (totalJobAbnormal > 0) {
    lines.push(`2. 效能异常${totalJobAbnormal}个，建议各中心负责人今日复盘异常岗位`);
  }
  if (totalAtt15 > 0) {
    lines.push(`3. 连续出勤≥15天${totalAtt15}人，建议合理安排轮休`);
  }
  if (totalAtt7 > 0) {
    lines.push(`4. 长期未出勤≥7天${totalAtt7}人，请跟进确认人员状态`);
  }
  lines.push('');

  // 各中心数据
  for (const prov of report.provinces) {
    lines.push(`【${prov.province} | 负责人：${prov.responsible} | 得分：${prov.totalScore}】`);

    for (const center of prov.centers) {
      const scoreTag = center.score >= 80 ? '正常' : center.score >= 50 ? '警告' : '异常';
      lines.push(`${center.centerName}(负责人：${center.responsible}) — ${center.score}分 ${scoreTag}`);

      // 【待办】只显示最紧急1项
      let actionTodo = '';
      if (center.jobAbnormalCount > 0) {
        actionTodo = `效能异常${center.jobAbnormalCount}个，请关注岗位效能偏离情况`;
      } else if (center.att7Count > 0) {
        actionTodo = `长期未出勤≥7天${center.att7Count}人，请核实原因并填写至网页`;
      } else if (center.salaryCount > 0 && parseFloat(center.salaryCoverage) > 3) {
        actionTodo = `绩效异常${center.salaryCoverage}（${center.salaryCount}人），请明确异常人员名单并制定改进计划`;
      } else if (center.att15Count > 0 && parseFloat(center.att15Rate) > 3) {
        actionTodo = `连续出勤≥15天${center.att15Rate}（${center.att15Count}人），请合理安排调休并将计划填写至网页`;
      }
      if (actionTodo) {
        lines.push(`待办：${actionTodo}。`);
      }

      // 效能异常
      if (center.jobAbnormalCount > 0) {
        lines.push(`效能异常：${center.jobAbnormalCount}个(前一天${center.jobPrevCount})`);
        if (center.jobDetails?.length) {
          center.jobDetails.forEach(d => {
            lines.push(`  - ${d.jobName}：偏离+${d.deviation}%(实际${d.actualValue}/目标${d.targetValue})`);
          });
        }
      } else {
        lines.push(`效能异常：无(正常)`);
      }

      // 绩效异常（只保留数字）
      if (center.salaryCount > 0) {
        lines.push(`绩效异常：${center.salaryCoverage}(${center.salaryCount}人)`);
      } else {
        lines.push(`绩效异常：无`);
      }

      // 连续出勤（只保留数字）
      if (center.att15Count > 0) {
        lines.push(`连续出勤≥15天：${center.att15Rate}(${center.att15Count}人，新增${center.att15New})`);
      } else {
        lines.push(`连续出勤≥15天：无`);
      }

      // 长期未出勤（只保留数字）
      if (center.att7Count > 0) {
        lines.push(`长期未出勤≥7天：${center.att7Count}人(新增${center.att7New})`);
      } else {
        lines.push(`长期未出勤≥7天：无`);
      }

      lines.push('');
    }
  }

  lines.push(`【由GPT数据通报系统自动生成 · ${report.generatedAt}】`);

  return lines.join('\n');
}
