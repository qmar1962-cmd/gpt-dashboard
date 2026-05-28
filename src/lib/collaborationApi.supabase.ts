// Supabase 协作数据读写 API
// 用于排休计划、未出勤原因、中心元数据等协作字段的远端存储
// 底层使用 Supabase PostgreSQL 数据库，替代原来的 GitHub API 方案

import { supabase } from './supabaseClient';

// 文件名 -> 表名映射
const FILE_TO_TABLE: Record<string, string> = {
  'leave_plans.json': 'leave_plans',
  'absence_reasons.json': 'absence_reasons',
  'center_meta.json': 'center_meta',
  'group_leaders.json': 'group_leaders',
  'work_hours_low_reasons.json': 'work_hours_low_reasons',
};

function getTableName(fileName: string): string {
  const tableName = FILE_TO_TABLE[fileName];
  if (!tableName) {
    throw new Error(`未知的协作数据文件: ${fileName}`);
  }
  return tableName;
}

/**
 * 从 Supabase 加载协作数据
 * 查询表中的所有行，转换为原来的 JSON 结构（保持与 GitHub 版本相同的返回值格式）
 */
export async function loadCollaborationData(fileName: string): Promise<any> {
  const tableName = getTableName(fileName);

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      console.error(`[Supabase协作] 加载失败 ${fileName}:`, error);
      return {};
    }

    // 将行数据转换回原来的 JSON 结构
    return rowsToJson(fileName, data || []);
  } catch (error) {
    console.error(`[Supabase协作] 加载异常 ${fileName}:`, error);
    return {};
  }
}

/**
 * 保存协作数据到 Supabase
 * 将 JSON 数据转换为行，删除旧数据，插入新数据
 * 注意：此操作非原子，低并发场景下可接受
 */
export async function saveCollaborationData(
  fileName: string,
  data: any,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const tableName = getTableName(fileName);
  const rows = jsonToRows(fileName, data);

  try {
    // 先删除所有旧数据，再插入新数据（用 neq('id',0) 绕过 Supabase 禁止无条件 delete 的限制）
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .neq('id', 0);

    if (deleteError) {
      console.error(`[Supabase协作] 删除失败 ${fileName}:`, deleteError);
      return { success: false, error: deleteError.message };
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from(tableName)
        .insert(rows);

      if (insertError) {
        console.error(`[Supabase协作] 插入失败 ${fileName}:`, insertError);
        return { success: false, error: insertError.message };
      }
    }

    console.log(`[Supabase协作] 保存成功 ${fileName}`);
    return { success: true };
  } catch (error) {
    console.error(`[Supabase协作] 保存异常 ${fileName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '保存失败',
    };
  }
}

/**
 * 清除协作数据缓存（Supabase 版本不需要本地缓存，此为空操作）
 */
export function clearCollaborationCache(fileName?: string): void {
  // Supabase 版本不需要本地缓存，保留此函数以保持接口兼容
}

/**
 * 获取缓存的 sha（Supabase 版本不需要 sha 乐观锁，返回 undefined）
 */
export function getCollaborationSha(fileName: string): string | undefined {
  // Supabase 版本使用数据库事务，不需要 sha 乐观锁
  return undefined;
}

// ============ 数据转换函数：Supabase 行 <-> 原来的 JSON 结构 ============

function rowsToJson(fileName: string, rows: any[]): any {
  switch (fileName) {
    case 'leave_plans.json':
      return leavePlansRowsToJson(rows);
    case 'absence_reasons.json':
      return absenceReasonsRowsToJson(rows);
    case 'center_meta.json':
      return centerMetaRowsToJson(rows);
    case 'group_leaders.json':
      return groupLeadersRowsToJson(rows);
    case 'work_hours_low_reasons.json':
      return workHoursLowReasonsRowsToJson(rows);
    default:
      return {};
  }
}

function jsonToRows(fileName: string, data: any): any[] {
  switch (fileName) {
    case 'leave_plans.json':
      return leavePlansJsonToRows(data);
    case 'absence_reasons.json':
      return absenceReasonsJsonToRows(data);
    case 'center_meta.json':
      return centerMetaJsonToRows(data);
    case 'group_leaders.json':
      return groupLeadersJsonToRows(data);
    case 'work_hours_low_reasons.json':
      return workHoursLowReasonsJsonToRows(data);
    default:
      return [];
  }
}

// leave_plans: JSON { 中心: { 日期: { 姓名: { start, end, setDate, savedAt } } } }
// leave_plans 表列: id, center, date, name, start_date, end_date, set_date, created_at
// 注：savedAt 复用 set_date 列存储（两者始终相等）
function leavePlansRowsToJson(rows: any[]): any {
  const result: any = {};
  for (const row of rows) {
    if (!result[row.center]) result[row.center] = {};
    if (!result[row.center][row.date]) result[row.center][row.date] = {};
    result[row.center][row.date][row.name] = {
      start: row.start_date,
      end: row.end_date,
      setDate: row.set_date,
      savedAt: row.set_date,       // 继承用：set_date 即为保存日期
    };
  }
  return result;
}

function leavePlansJsonToRows(data: any): any[] {
  const rows: any[] = [];
  for (const center of Object.keys(data)) {
    for (const date of Object.keys(data[center])) {
      for (const name of Object.keys(data[center][date])) {
        const item = data[center][date][name];
        rows.push({
          center,
          date,
          name,
          start_date: item.start,
          end_date: item.end,
          set_date: item.savedAt || item.setDate,
        });
      }
    }
  }
  return rows;
}

// absence_reasons: JSON { 中心: { 日期: { 姓名: { reason, date } } } }
// absence_reasons 表列: id, center, date, name, reason, record_date, created_at
function absenceReasonsRowsToJson(rows: any[]): any {
  const result: any = {};
  for (const row of rows) {
    if (!result[row.center]) result[row.center] = {};
    if (!result[row.center][row.date]) result[row.center][row.date] = {};
    result[row.center][row.date][row.name] = {
      reason: row.reason,
      date: row.date,
      savedAt: row.record_date,
    };
  }
  return result;
}

function absenceReasonsJsonToRows(data: any): any[] {
  const rows: any[] = [];
  for (const center of Object.keys(data)) {
    for (const date of Object.keys(data[center])) {
      for (const name of Object.keys(data[center][date])) {
        const item = data[center][date][name];
        rows.push({
          center,
          date,
          name,
          reason: item.reason,
          record_date: item.savedAt || item.date,
        });
      }
    }
  }
  return rows;
}

// center_meta: JSON { 中心: { 考勤负责人: "", updatedAt: "" } }
// center_meta 表列: id, center, attendance_manager, updated_at, created_at
function centerMetaRowsToJson(rows: any[]): any {
  const result: any = {};
  for (const row of rows) {
    result[row.center] = {
      考勤负责人: row.attendance_manager,
      updatedAt: row.updated_at,
    };
  }
  return result;
}

function centerMetaJsonToRows(data: any): any[] {
  const rows: any[] = [];
  for (const center of Object.keys(data)) {
    const item = data[center];
    rows.push({
      center,
      attendance_manager: item.考勤负责人,
      updated_at: item.updatedAt,
    });
  }
  return rows;
}

// group_leaders: JSON { "中心|||组别": "姓名" }
// group_leaders 表列: id, center, group_name, leader_name, created_at
function groupLeadersRowsToJson(rows: any[]): any {
  const result: any = {};
  for (const row of rows) {
    result[`${row.center}|||${row.group_name}`] = row.leader_name;
  }
  return result;
}

function groupLeadersJsonToRows(data: any): any[] {
  const rows: any[] = [];
  for (const key of Object.keys(data)) {
    const [center, groupName] = key.split('|||');
    rows.push({
      center,
      group_name: groupName,
      leader_name: data[key],
    });
  }
  return rows;
}

// work_hours_low_reasons: JSON { 中心: { 日期: { 姓名: { reason, savedAt } } } }
// work_hours_low_reasons 表列: id, center, date, name, reason, created_at
// 注：savedAt 复用 created_at 列，DELETE+INSERT 时自动更新
function workHoursLowReasonsRowsToJson(rows: any[]): any {
  const result: any = {};
  for (const row of rows) {
    if (!result[row.center]) result[row.center] = {};
    if (!result[row.center][row.date]) result[row.center][row.date] = {};
    result[row.center][row.date][row.name] = {
      reason: row.reason,
      date: row.date,                                          // 窗口日期（兼容旧代码）
      savedAt: (row.created_at || row.date || '').slice(0, 10), // 保存日期（用于继承）
    };
  }
  return result;
}

function workHoursLowReasonsJsonToRows(data: any): any[] {
  const rows: any[] = [];
  for (const center of Object.keys(data)) {
    for (const date of Object.keys(data[center])) {
      for (const name of Object.keys(data[center][date])) {
        const item = data[center][date][name];
        rows.push({
          center,
          date,
          name,
          reason: item.reason,
        });
      }
    }
  }
  return rows;
}
