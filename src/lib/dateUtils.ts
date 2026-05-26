/**
 * 日期工具函数 — 统一处理 Excel 序列号、北京时间、近一周日期范围
 */

/** 将 Excel 序列号或字符串转换为 YYYY-MM-DD */
export function parseDate(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'number') {
    // Excel 序列号 → UTC 日期（起点 1899-12-30，修正闰年 bug）
    const utcMs = (raw - 25569) * 86400000;
    const d = new Date(utcMs);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
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
