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
  salaryCoverage: string;
  salaryBase: number;
  salaryDetails?: Array<{
    name: string;
    jobName: string;
    avgDeviation: number;
  }>;

  /** 连续出勤 ≥15天 */
  att15Count: number;
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

export interface FullReport {
  reportDate: string;       // T-2 日期文字
  dateStr: string;          // T-2 YYYY-MM-DD
  generatedAt: string;      // 生成时间
  overallScore: number;     // 全区平均分
  totalProvinces: number;
  provinces: ProvinceReport[];
  summary: string;          // 一段话总结
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
 */
export function generateReport(params: {
  filteredData: any[];              // enriched 后的省区数据
  rawData?: any[];                  // 岗位效能原始数据
  salaryData?: any[];               // 薪资异常原始数据
  attendanceData?: any[];           // 中心出勤原始数据
  attendance15Data?: any[];         // 连续15日出勤原始数据
  attendance7Data?: any[];          // 连续7日未出勤原始数据
}): FullReport {
  const { filteredData, rawData, salaryData, attendanceData, attendance15Data, attendance7Data } = params;

  // T-2 日期
  const today = new Date();
  const t2 = new Date(today);
  t2.setDate(today.getDate() - 2);
  const dateStr = `${t2.getFullYear()}-${String(t2.getMonth() + 1).padStart(2, '0')}-${String(t2.getDate()).padStart(2, '0')}`;
  const reportDate = `${t2.getFullYear()}年${String(t2.getMonth() + 1).padStart(2, '0')}月${String(t2.getDate()).padStart(2, '0')}日`;

  const sortedData = [...filteredData].sort((a, b) => b.totalScore - a.totalScore);
  const overallScore = Math.round(sortedData.reduce((s, r) => s + (r.totalScore || 0), 0) / sortedData.length);

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
          jobName: r['岗位名称'] || r.jobName || '未知岗位',
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

  return {
    reportDate,
    dateStr,
    generatedAt: new Date().toLocaleString('zh-CN'),
    overallScore,
    totalProvinces: provinces.length,
    provinces,
    summary,
  };
}

/**
 * 生成报告总结段落
 */
function generateSummary(provinces: ProvinceReport[]): string {
  const lines: string[] = [];

  // 排名概况
  const topProv = provinces[0];
  const bottomProv = provinces[provinces.length - 1];
  lines.push(`本期（${provinces[0]?.centers[0] ? 'T-2' : ''}）华中大区共 ${provinces.length} 个省区参与考核，全区综合平均得分 ${provinces.reduce((s, p) => s + p.totalScore, 0) / provinces.length} 分。`);

  if (topProv) {
    lines.push(`${topProv.provinceName}以 ${topProv.totalScore} 分位列第 1，表现最优。`);
  }
  if (bottomProv && bottomProv !== topProv) {
    lines.push(`${bottomProv.provinceName} ${bottomProv.totalScore} 分排名末位，需重点关注。`);
  }

  // 各维度异常汇总
  let totalJob = 0, totalSalary = 0, totalAtt15 = 0, totalAtt7 = 0;
  provinces.forEach(p => p.centers.forEach(c => {
    totalJob += c.jobAbnormalCount;
    totalSalary += c.salaryCount;
    totalAtt15 += c.att15Count;
    totalAtt7 += c.att7Count;
  }));

  const issues: string[] = [];
  if (totalJob > 0) issues.push(`效能异常岗位 ${totalJob} 个`);
  if (totalSalary > 0) issues.push(`绩效异常人员 ${totalSalary} 人`);
  if (totalAtt15 > 0) issues.push(`连续出勤超 15 天 ${totalAtt15} 人`);
  if (totalAtt7 > 0) issues.push(`长期未出勤 ${totalAtt7} 人`);

  if (issues.length > 0) {
    lines.push(`共发现异常情况：${issues.join('，')}。`);
  } else {
    lines.push('各维度暂无异常数据，整体运营平稳。');
  }

  return lines.join('');
}

/**
 * 将报告渲染为纯文本（用于复制 / 打印）
 */
export function renderReportAsText(report: FullReport): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════╗');
  lines.push('║        GPT 数据通报 — 详情报告                ║');
  lines.push('╠══════════════════════════════════════════════╣');
  lines.push(`║  数据日期：${report.reportDate.padEnd(26)}║`);
  lines.push(`║  生成时间：${report.generatedAt.padEnd(26)}║`);
  lines.push(`║  全区均分：${report.overallScore} 分`.padEnd(42) + '║');
  lines.push('╚══════════════════════════════════════════════╝');
  lines.push('');

  // 总结
  lines.push('【执行摘要】');
  lines.push(report.summary);
  lines.push('');

  // 各省区详情
  for (const prov of report.provinces) {
    lines.push('─'.repeat(50));
    lines.push(`📌 #${prov.ranking} ${prov.province}  |  负责人：${prov.responsible}  |  得分：${prov.totalScore}`);
    lines.push('');

    for (const center of prov.centers) {
      const scoreTag = center.score >= 80 ? '✅' : center.score >= 50 ? '⚠️' : '❌';
      lines.push(`  ${scoreTag} ${center.centerName}（${center.responsible}）— 得分 ${center.score}`);

      const parts: string[] = [];

      if (center.jobAbnormalCount > 0) {
        parts.push(`效能异常 ${center.jobAbnormalCount} 个（前天 ${center.jobPrevCount}）`);
        if (center.jobDetails?.length) {
          center.jobDetails.forEach(d => {
            parts.push(`    └ ${d.jobName}：偏离 +${d.deviation}%（实际 ${d.actualValue} / 目标 ${d.targetValue}）`);
          });
        }
      }

      if (center.salaryCount > 0) {
        parts.push(`绩效异常 ${center.salaryCount} 人（覆盖率 ${center.salaryCoverage}，算薪基数 ${center.salaryBase}）`);
        if (center.salaryDetails?.length) {
          center.salaryDetails.slice(0, 5).forEach(d => {
            parts.push(`    └ ${d.name}（${d.jobName}）：均值偏离 +${d.avgDeviation}%`);
          });
          if (center.salaryDetails.length > 5) parts.push(`    └ ... 等 ${center.salaryDetails.length} 人`);
        }
      }

      if (center.att15Count > 0) {
        const extra = center.att15Over30 ? `，其中 >30 天 ${center.att15Over30} 人` : '';
        parts.push(`连续出勤 ≥15 天 ${center.att15Count} 人（触发率 ${center.att15Rate}，新增 ${center.att15New}${extra}）`);
        if (center.att15Details?.length) {
          center.att15Details.slice(0, 5).forEach(d => {
            parts.push(`    └ ${d.name}（${d.jobName}）：连续 ${d.continuousDays} 天`);
          });
          if (center.att15Details.length > 5) parts.push(`    └ ... 等 ${center.att15Details.length} 人`);
        }
      }

      if (center.att7Count > 0) {
        parts.push(`长期未出勤 ≥7 天 ${center.att7Count} 人（新增 ${center.att7New}）`);
        if (center.att7Details?.length) {
          center.att7Details.slice(0, 5).forEach(d => {
            parts.push(`    └ ${d.name}（${d.jobName}）：未出勤 ${d.continuousDays} 天`);
          });
          if (center.att7Details.length > 5) parts.push(`    └ ... 等 ${center.att7Details.length} 人`);
        }
      }

      if (parts.length === 0) {
        lines.push(`    ✅ 无异常记录`);
      } else {
        lines.push(...parts);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
