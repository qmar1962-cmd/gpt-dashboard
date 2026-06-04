/**
 * 日期工具函数 — 统一处理 Excel 序列号、北京时间、近一周日期范围
 */

/** 将 Excel 序列号或字符串转换为 YYYY-MM-DD */
export function parseDate(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw.trim()))) {
    // Excel 序列号 → 本地日期（与旧版 excelSerialToDateStr / normalizeSalaryDate 行为一致）
    const serial = typeof raw === 'number' ? raw : parseFloat(raw.trim());
    if (!serial || serial < 1) return typeof raw === 'string' ? raw : '';
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + serial * 86400000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  if (typeof raw === 'string') {
    const s = raw.replace(/\//g, '-').trim();
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      return `${m[1]}-${String(parseInt(m[2])).padStart(2, '0')}-${String(parseInt(m[3])).padStart(2, '0')}`;
    }
    return s;
  }
  return '';
}

/** 北京时间 YYYY-MM-DD（offsetDays: -2 = 前天，0 = 今天） */
export function beijingDate(offsetDays: number = 0): string {
  const now = new Date();
  const ms = now.getTime() + 8 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** 北京时间 "YYYY年MM月DD日" 格式 */
export function beijingDateCN(offsetDays: number = 0): string {
  const now = new Date();
  const ms = now.getTime() + 8 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}年${String(d.getUTCMonth() + 1).padStart(2, '0')}月${String(d.getUTCDate()).padStart(2, '0')}日`;
}

export interface DaySlot {
  dateStr: string;   // YYYY-MM-DD
  dateLabel: string; // M/D
}

/** 以 T-2 为基准，向前推 days 天（含 T-2），返回日期槽数组（从早到晚） */
export function weekDateRange(days: number = 7): DaySlot[] {
  const now = new Date();
  const t2ms = now.getTime() + 8 * 60 * 60 * 1000 - 2 * 24 * 60 * 60 * 1000;
  const t2 = new Date(t2ms);

  const slots: DaySlot[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(t2);
    d.setUTCDate(t2.getUTCDate() - i);
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const dateLabel = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    slots.push({ dateStr, dateLabel });
  }
  return slots;
}

/** 7 天日期范围集合（T-2 往前推 days 天），用于快速过滤行 */
export function recentDateSet(days: number = 7): Set<string> {
  return new Set(weekDateRange(days).map(s => s.dateStr));
}

/** 过滤数组行：保留"数据日期"列在近 days 天范围内的行 */
export function filterRowsByDate<T extends Record<string, any>>(rows: T[], days: number = 7): T[] {
  if (!rows || rows.length === 0) return rows;
  const dates = recentDateSet(days);
  const dateCols = ['数据日期', '日期', 'date'];
  return rows.filter(row => {
    if (!row || typeof row !== 'object') return false;
    for (const col of dateCols) {
      const raw = row[col];
      if (raw !== undefined && raw !== null && raw !== '') {
        const d = parseDate(raw);
        if (d && dates.has(d)) return true;
      }
    }
    return false;
  });
}

/** 获取 T-2 所在月的第一天和最后一天（YYYY-MM-DD），offset 用于月份偏移（0=当月，-1=上月） */
export function getMonthDateRange(offset: number = 0): { first: string; last: string } {
  const now = new Date();
  const t2ms = now.getTime() + 8 * 60 * 60 * 1000 - 2 * 24 * 60 * 60 * 1000;
  const t2 = new Date(t2ms);

  const year = t2.getUTCFullYear();
  const month = t2.getUTCMonth() + offset;

  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));

  // last 不能超过 T-2
  const t2DateStr = `${t2.getUTCFullYear()}-${String(t2.getUTCMonth() + 1).padStart(2, '0')}-${String(t2.getUTCDate()).padStart(2, '0')}`;
  const lastDateStr = `${lastDay.getUTCFullYear()}-${String(lastDay.getUTCMonth() + 1).padStart(2, '0')}-${String(lastDay.getUTCDate()).padStart(2, '0')}`;
  const cappedLast = lastDateStr <= t2DateStr ? lastDateStr : t2DateStr;

  const firstDateStr = `${firstDay.getUTCFullYear()}-${String(firstDay.getUTCMonth() + 1).padStart(2, '0')}-${String(firstDay.getUTCDate()).padStart(2, '0')}`;
  return { first: firstDateStr, last: cappedLast };
}

/** 格式化月份显示（如 "2026年5月"） */
export function formatMonth(offset: number = 0): string {
  const { first } = getMonthDateRange(offset);
  const [y, m] = first.split('-');
  return `${y}年${parseInt(m)}月`;
}

/** 获取 T-2 所在月的月份标签（用于限制"下月"按钮） */
export function getT2MonthLabel(): string {
  return formatMonth(0);
}

/** 生成 first 到 last 之间所有日期字符串（含首尾），如 ["2026-05-01", "2026-05-02", ...] */
export function getDatesInRange(first: string, last: string): string[] {
  const dates: string[] = [];
  const [y1, m1, d1] = first.split('-').map(Number);
  const [y2, m2, d2] = last.split('-').map(Number);
  const start = new Date(Date.UTC(y1, m1 - 1, d1));
  const end = new Date(Date.UTC(y2, m2 - 1, d2));
  const current = new Date(start);
  while (current <= end) {
    dates.push(`${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}
