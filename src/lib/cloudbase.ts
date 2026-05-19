import cloudbase from '@cloudbase/js-sdk';

// CloudBase 配置
const CLOUDBASE_CONFIG = {
  env: 'liuyang-0347-d9g7dlovxf74d79cc', // 环境 ID
};

let app: any = null;
let db: any = null;
let cloudbaseReady = false;

/**
 * 初始化 CloudBase，失败时静默降级到 localStorage
 * 带 3 秒超时，避免网络阻塞页面加载
 * 带重试机制（最多 3 次）
 */
export async function initCloudBase(): Promise<boolean> {
  if (cloudbaseReady) {
    console.log('[CloudBase] 已初始化，跳过');
    return true;
  }

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[CloudBase] 第 ${attempt}/${maxRetries} 次尝试初始化...`);
      
      // 初始化 CloudBase（使用匿名登录）
      app = cloudbase.init({
        env: CLOUDBASE_CONFIG.env,
      });
      
      // 匿名登录
      await app.auth().anonymousAuthProvider().signIn();
      
      db = app.database();
      
      // 测试连接：尝试访问 dailyData 集合（3秒超时）
      // 不依赖 _health 集合，直接使用业务集合
      const testRef = db.collection('dailyData').limit(1);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('CloudBase 连接超时')), 5000)
      );
      await Promise.race([testRef.get(), timeoutPromise]);
      
      cloudbaseReady = true;
      console.log('[CloudBase] ✅ 初始化成功');
      return true;
    } catch (err: any) {
      console.warn(`[CloudBase] ❌ 第 ${attempt} 次初始化失败:`, err);
      if (attempt < maxRetries) {
        console.log(`[CloudBase] 等待 2 秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error('[CloudBase] 🔴 所有重试失败，降级到 localStorage');
  cloudbaseReady = false;
  return false;
}

/**
 * CloudBase 是否可用
 */
export function isCloudBaseReady(): boolean {
  return cloudbaseReady && db !== null;
}

// ====== CloudBase 数据操作 ======

/**
 * 保存数据到 CloudBase
 * 集合：dailyData
 * 文档 ID：key
 */
export async function saveToCloudBase(
  key: string,
  data: any
): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = db.collection('dailyData').doc(key);
    await docRef.set({
      ...data,
      key,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn('[CloudBase] 写入失败:', err);
    return false;
  }
}

/**
 * 从 CloudBase 读取单条数据
 */
export async function readFromCloudBase(key: string): Promise<any | null> {
  if (!db) return null;
  try {
    const docRef = db.collection('dailyData').doc(key);
    const res = await docRef.get();
    if (res.data && res.data.length > 0) {
      const d = res.data[0];
      const { key: _k, updatedAt: _u, ...rest } = d;
      return rest;
    }
    return null;
  } catch (err) {
    console.warn('[CloudBase] 读取失败:', err);
    return null;
  }
}

/**
 * 获取 CloudBase 中所有数据
 */
export async function getAllFromCloudBase(): Promise<Record<string, any>> {
  if (!db) return {};
  try {
    const res = await db.collection('dailyData').get();
    const result: Record<string, any> = {};
    res.data.forEach((doc: any) => {
      const d = doc;
      const key = d.key || doc._id;
      const { key: _k, updatedAt: _u, ...rest } = d;
      result[key] = rest;
    });
    return result;
  } catch (err) {
    console.warn('[CloudBase] 批量读取失败:', err);
    return {};
  }
}

/**
 * 清理 CloudBase 中超过 N 天的过期数据
 */
export async function cleanupCloudBase(maxDays: number = 30): Promise<number> {
  if (!db) return 0;
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxDays);
    const cutoffISO = cutoff.toISOString();

    const res = await db.collection('dailyData').where({
      updatedAt: db.command.lt(cutoffISO)
    }).get();
    
    let deleted = 0;
    for (const doc of res.data) {
      await db.collection('dailyData').doc(doc._id).remove();
      deleted++;
    }
    
    return deleted;
  } catch (err) {
    console.warn('[CloudBase] 清理失败:', err);
    return 0;
  }
}

// ====== 共享数据操作（排休/缺勤原因/负责人，跨设备同步） ======

/**
 * 保存共享数据到 CloudBase
 * 集合：sharedData
 * 文档 ID：docId
 */
export async function saveSharedData(docId: string, data: any): Promise<boolean> {
  if (!db) {
    console.warn(`[CloudBase] saveSharedData(${docId}) 失败: db 未初始化`);
    return false;
  }
  try {
    const docRef = db.collection('sharedData').doc(docId);
    await docRef.set({
      ...data,
      updatedAt: new Date().toISOString(),
    });
    console.log(`[CloudBase] ✅ saveSharedData(${docId}) 成功`);
    return true;
  } catch (err) {
    console.error(`[CloudBase] ❌ saveSharedData(${docId}) 失败:`, err);
    return false;
  }
}

/**
 * 从 CloudBase 读取共享数据
 */
export async function readSharedData(docId: string): Promise<any | null> {
  if (!db) {
    console.warn(`[CloudBase] readSharedData(${docId}) 失败: db 未初始化`);
    return null;
  }
  try {
    const docRef = db.collection('sharedData').doc(docId);
    const res = await docRef.get();
    if (res.data && res.data.length > 0) {
      const d = res.data[0];
      const { updatedAt: _u, ...rest } = d;
      console.log(`[CloudBase] ✅ readSharedData(${docId}) 成功，数据条数: ${Object.keys(rest).length}`);
      return rest;
    }
    console.log(`[CloudBase] readSharedData(${docId}) 文档不存在`);
    return null;
  } catch (err) {
    console.error(`[CloudBase] ❌ readSharedData(${docId}) 失败:`, err);
    return null;
  }
}

/**
 * 清空 CloudBase 所有数据
 */
export async function clearCloudBase(): Promise<boolean> {
  if (!db) return false;
  try {
    const res = await db.collection('dailyData').get();
    
    for (const doc of res.data) {
      await db.collection('dailyData').doc(doc._id).remove();
    }
    
    return true;
  } catch (err) {
    console.warn('[CloudBase] 清空失败:', err);
    return false;
  }
}
