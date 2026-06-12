/**
 * 原始数据导出模块
 * 将 6 类原始数据导出为 1 个 Excel 文件（6 个 sheet），支持日期范围过滤和协作数据追加
 */

import { idbGetRawData } from './idb';
import { loadCollaborationData } from './collaborationApi.supabase';

// 数据类型 → IndexedDB key → sheet 名
const EXPORT_CONFIG = [
  { type: 'job_performance',    sheet: '效能异常' },
  { type: 'salary_performance', sheet: '绩效异常' },
  { type: 'attendance_15days',  sheet: '连续出勤' },
  { type: 'attendance_7days',   sheet: '连续未出勤' },
  { type: 'work_hours_high',    sheet: '工时高' },
  { type: 'work_hours_low',     sheet: '工时低' },
] as const;

// 需要追加协作列的 sheet
const COLLAB_SHEETS: Record<string, { fileName: string; colName: string }> = {
  '连续出勤':   { fileName: 'leave_plans.json',           colName: '调休计划' },
  '连续未出勤': { fileName: 'absence_reasons.json',       colName: '未出勤原因' },
  '工时低':     { fileName: 'work_hours_low_reasons.json', colName: '工时低原因' },
};

/**
 * 导出原始数据 Excel
 * @param startDate 起始日期 YYYY-MM-DD
 * @param endDate   结束日期 YYYY-MM-DD
 */
export async function exportRawDataExcel(startDate: string, endDate: string): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // 并行加载所有原始数据
  const allRaw = await Promise.all(
    EXPORT_CONFIG.map(c => idbGetRawData(c.type))
  );

  // 并行加载需要的协作数据
  const collabKeys = [...new Set(Object.values(COLLAB_SHEETS).map(c => c.fileName))];
  const collabResults = await Promise.all(collabKeys.map(f => loadCollaborationData(f)));
  const collabMap: Record<string, any> = {};
  collabKeys.forEach((k, i) => { collabMap[k] = collabResults[i] || {}; });

  for (let i = 0; i < EXPORT_CONFIG.length; i++) {
    const config = EXPORT_CONFIG[i];
    const raw = allRaw[i];
    if (!raw || raw.rawData.length === 0) continue;

    // 按日期范围过滤
    const filtered = raw.rawData.filter((row: any) => {
      const d = (row['数据日期'] || row.日期 || row.date || '').toString().slice(0, 10);
      return d >= startDate && d <= endDate;
    });

    if (filtered.length === 0) continue;

    // 按数据日期排序
    filtered.sort((a: any, b: any) => {
      const da = (a['数据日期'] || a.日期 || a.date || '').toString().slice(0, 10);
      const db = (b['数据日期'] || b.日期 || b.date || '').toString().slice(0, 10);
      return da.localeCompare(db);
    });

    // 如果需要追加协作列
    const collab = COLLAB_SHEETS[config.sheet];
    if (collab) {
      const collabData = collabMap[collab.fileName] || {};
      for (const row of filtered) {
        const center = row['中心'] || '';
        const date = (row['数据日期'] || row.日期 || row.date || '').toString().slice(0, 10);
        const name = row['姓名'] || '';
        const reason = collabData[center]?.[date]?.[name];
        if (reason) {
          if (collab.fileName === 'leave_plans.json') {
            // 排休计划：显示日期段
            row[collab.colName] = formatLeavePlan(reason);
          } else {
            // 原因类：直接取 reason 字段
            row[collab.colName] = reason.reason || '';
          }
        } else {
          row[collab.colName] = '';
        }
      }
    }

    // 生成 sheet
    const ws = XLSX.utils.json_to_sheet(filtered);
    // 设置列宽
    const keys = Object.keys(filtered[0] || {});
    ws['!cols'] = keys.map(k => ({ wch: Math.max(k.length * 2.5, 10) }));
    XLSX.utils.book_append_sheet(wb, ws, config.sheet);
  }

  // 下载
  const fileName = `GPT原始数据_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * 格式化排休计划为可读字符串
 * 输入: { start, end, ranges, setDate, savedAt }
 * 输出: "5/20~5/22, 5/28~5/30" 或 "5/20~5/22"
 */
function formatLeavePlan(plan: any): string {
  // 优先用 ranges（多段日期）
  if (plan.ranges && Array.isArray(plan.ranges) && plan.ranges.length > 0) {
    return plan.ranges.map((r: any) => `${fmtDate(r.start)}~${fmtDate(r.end)}`).join(', ');
  }
  // 兼容旧数据 start/end
  if (plan.start && plan.end) {
    return `${fmtDate(plan.start)}~${fmtDate(plan.end)}`;
  }
  return '';
}

/**
 * 日期格式化：2026-06-01 → 6/1
 */
function fmtDate(d: string): string {
  if (!d) return '';
  const parts = d.split('-');
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}
