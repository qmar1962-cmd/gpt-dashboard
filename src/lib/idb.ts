/**
 * IndexedDB 存储层
 * 用于存储大体积的原始数据（薪资异常、出勤、效能等）
 * 容量远超 localStorage 的 5MB 限制（通常几百 MB ~ 数 GB）
 */

const DB_NAME = 'gpt_dashboard_db';
const DB_VERSION = 1;

// Object Store 名称
const RAW_DATA_STORE = 'raw_data'; // 存储原始上传数据
const META_STORE = 'meta';         // 存储元数据

// 数据类型 key 映射
const DATA_TYPE_KEYS: Record<string, string> = {
  'salary_performance': 'salary_raw',
  'job_performance': 'job_raw',
  'attendance_15days': 'att15_raw',
  'attendance_7days': 'att7_raw',
  'employee_roster': 'roster_raw',
  'center_daily_attendance': 'center_att_raw',
  'module_attendance': 'module_att_raw',
  'center_headcount': 'center_hc_raw',
};

let dbInstance: IDBDatabase | null = null;

/**
 * 打开/创建 IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(RAW_DATA_STORE)) {
        db.createObjectStore(RAW_DATA_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance!);
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] 打开失败:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * 通用事务封装
 */
function withStore(storeName: string, mode: IDBTransactionMode): Promise<{ store: IDBObjectStore; tx: IDBTransaction }> {
  return openDB().then(db => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    return { store, tx };
  });
}

/**
 * 将 Promise 包装在事务完成上（确保事务 commit）
 */
function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ====== 写入操作 ======

/**
 * 保存原始数据到 IndexedDB
 * 合并策略：先读取已有数据，追加新数据（去重基于日期+工号/唯一键）
 */
export async function idbSaveRawData(rawData: any[], dataType: string): Promise<void> {
  const idKey = DATA_TYPE_KEYS[dataType] || dataType;
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([RAW_DATA_STORE, META_STORE], 'readwrite');
    const rawStore = tx.objectStore(RAW_DATA_STORE);
    const metaStore = tx.objectStore(META_STORE);

    // 先读取已有数据
    const getRequest = rawStore.get(idKey);

    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      let mergedData: any[];

      if (existing && existing.rawData && existing.rawData.length > 0) {
        // 合并：新数据追加到已有数据后面
        mergedData = [...existing.rawData, ...rawData];
        // 简单去重：基于 JSON.stringify 去重（保留第一次出现的）
        const seen = new Set<string>();
        const deduplicated: any[] = [];
        for (const row of mergedData) {
          const key = JSON.stringify(row);
          if (!seen.has(key)) {
            seen.add(key);
            deduplicated.push(row);
          }
        }
        mergedData = deduplicated;
      } else {
        mergedData = rawData;
      }

      // 存储合并后的数据
      const rawRecord = {
        id: idKey,
        rawData: mergedData,
        dataType,
        savedAt: Date.now(),
        rowCount: mergedData.length,
      };
      rawStore.put(rawRecord);

      // 更新元数据
      metaStore.put({
        key: `${idKey}_meta`,
        dataType,
        rowCount: mergedData.length,
        savedAt: Date.now(),
      });
    };

    getRequest.onerror = () => {
      // 读取失败，直接保存新数据
      const rawRecord = {
        id: idKey,
        rawData,
        dataType,
        savedAt: Date.now(),
        rowCount: rawData.length,
      };
      rawStore.put(rawRecord);
      metaStore.put({
        key: `${idKey}_meta`,
        dataType,
        rowCount: rawData.length,
        savedAt: Date.now(),
      });
    };

    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      console.error(`[IndexedDB] 保存失败: ${dataType}`, tx.error);
      reject(tx.error);
    };
  });
}

// ====== 读取操作 ======

/**
 * 读取指定类型的原始数据
 */
export async function idbGetRawData(dataType: string): Promise<{ rawData: any[]; dataType: string; savedAt: number } | null> {
  const idKey = DATA_TYPE_KEYS[dataType] || dataType;
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(RAW_DATA_STORE, 'readonly');
    const store = tx.objectStore(RAW_DATA_STORE);
    const request = store.get(idKey);

    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        resolve({
          rawData: result.rawData,
          dataType: result.dataType,
          savedAt: result.savedAt,
        });
      } else {
        resolve(null);
      }
    };
    request.onerror = () => {
      console.error(`[IndexedDB] 读取失败: ${dataType}`, request.error);
      reject(request.error);
    };
  });
}

/**
 * 获取各数据类型的存储行数
 */
export async function idbGetRawDataStats(): Promise<Record<string, number>> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(RAW_DATA_STORE, 'readonly');
    const store = tx.objectStore(RAW_DATA_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const result: Record<string, number> = {};
      request.result.forEach((item: any) => {
        if (item.dataType && item.rowCount !== undefined) {
          result[item.dataType] = item.rowCount;
        }
      });
      resolve(result);
    };
    request.onerror = () => {
      console.error('[IndexedDB] 获取统计失败:', request.error);
      reject(request.error);
    };
  });
}

// ====== 删除操作 ======

/**
 * 按数据类型清理原始数据
 * @returns 被清理的数据行数
 */
export async function idbClearRawDataByType(dataType: string): Promise<number> {
  const idKey = DATA_TYPE_KEYS[dataType] || dataType;
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([RAW_DATA_STORE, META_STORE], 'readwrite');
    const rawStore = tx.objectStore(RAW_DATA_STORE);
    const metaStore = tx.objectStore(META_STORE);

    // 先获取行数
    const getRequest = rawStore.get(idKey);
    let count = 0;

    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (record) {
        count = record.rowCount || 0;
        rawStore.delete(idKey);
        metaStore.delete(`${idKey}_meta`);
      }
    };

    tx.oncomplete = () => {
      resolve(count);
    };
    tx.onerror = () => {
      console.error(`[IndexedDB] 清理失败: ${dataType}`, tx.error);
      reject(tx.error);
    };
  });
}

/**
 * 清空所有原始数据
 */
export async function idbClearAllRawData(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([RAW_DATA_STORE, META_STORE], 'readwrite');
    tx.objectStore(RAW_DATA_STORE).clear();
    tx.objectStore(META_STORE).clear();

    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      console.error('[IndexedDB] 清空失败:', tx.error);
      reject(tx.error);
    };
  });
}

/**
 * 获取 IndexedDB 存储大小估算
 */
export async function idbGetStorageEstimate(): Promise<{ usage: number; quota: number; usageMB: string; quotaMB: string }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    return {
      usage,
      quota,
      usageMB: (usage / 1024 / 1024).toFixed(2),
      quotaMB: (quota / 1024 / 1024).toFixed(2),
    };
  }
  return { usage: 0, quota: 0, usageMB: '未知', quotaMB: '未知' };
}

/**
 * 迁移 localStorage 中的原始数据到 IndexedDB
 * 用于一次性从旧存储迁移到新存储
 */
export async function migrateFromLocalStorage(): Promise<{ migrated: string[]; failed: string[] }> {
  const migrated: string[] = [];
  const failed: string[] = [];

  // 需要迁移的 localStorage key
  const migrationMap: Record<string, string> = {
    'gpt_dashboard_salary_raw_data': 'salary_performance',
    'gpt_dashboard_raw_data': null, // 效能数据需要从 payload 中读取 dataType
  };

  for (const [lsKey, dataType] of Object.entries(migrationMap)) {
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      if (!parsed.rawData || parsed.rawData.length === 0) continue;

      const actualType = dataType || parsed.dataType;
      if (!actualType) continue;

      // 检查 IndexedDB 是否已有该类型数据（避免覆盖）
      const existing = await idbGetRawData(actualType);
      if (existing && existing.rawData.length > 0) {
        continue;
      }


      await idbSaveRawData(parsed.rawData, actualType);
      migrated.push(actualType);

      // 迁移成功后删除 localStorage 中的数据，释放空间
      localStorage.removeItem(lsKey);
    } catch (e) {
      console.error(`[IndexedDB] 迁移失败: ${lsKey}`, e);
      failed.push(lsKey);
    }
  }

  return { migrated, failed };
}
