/**
 * 通用数据合并去重工具
 */

export type RowKeyFn = (row: any) => string;

/** 按自定义 key 函数合并去重，已有数据优先，新数据跳过重复行 */
export function mergeAndDedupe(existing: any[], newData: any[], getKey: RowKeyFn): any[] {
  const seen = new Set(existing.map(getKey).filter(Boolean));
  const newRows = newData.filter(row => {
    const key = getKey(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...existing, ...newRows];
}

/** 从对象数组中动态查找列名（模糊匹配） */
export function findColumn(keys: string[], patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const found = keys.find(k => p.test(k));
    if (found) return found;
  }
  return undefined;
}
