import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

// Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyAA1-irnxrZvHa3yuvSR-j2Q116mrbcRBE",
  authDomain: "gpt-day.firebaseapp.com",
  projectId: "gpt-day",
  storageBucket: "gpt-day.firebasestorage.app",
  messagingSenderId: "317463926945",
  appId: "1:317463926945:web:f598512266aa0f9c53f8e0",
  measurementId: "G-DQ6VZ33JE4"
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let firebaseReady = false;

/**
 * 初始化 Firebase，失败时静默降级到 localStorage
 */
export async function initFirebase(): Promise<boolean> {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);

    // 测试连接：尝试读一个不存在的文档
    const testRef = doc(db, '_health', 'ping');
    await getDoc(testRef);

    firebaseReady = true;
    return true;
  } catch (err) {
    console.warn('[Firebase] 初始化失败，降级到 localStorage:', err);
    firebaseReady = false;
    return false;
  }
}

/**
 * Firebase 是否可用
 */
export function isFirebaseReady(): boolean {
  return firebaseReady && db !== null;
}

// ====== Firestore 数据操作 ======

/**
 * 保存每日数据到 Firestore
 * 文档路径：dailyData/{centerId}_{dataType}_{date}
 */
export async function saveToFirestore(
  key: string,
  data: any
): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, 'dailyData', key);
    await setDoc(docRef, {
      ...data,
      key,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn('[Firebase] 写入失败:', err);
    return false;
  }
}

/**
 * 从 Firestore 读取单条数据
 */
export async function readFromFirestore(key: string): Promise<any | null> {
  if (!db) return null;
  try {
    const docRef = doc(db, 'dailyData', key);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const d = snap.data();
      // 返回数据时去掉 Firestore 元数据字段
      const { key: _k, updatedAt: _u, ...rest } = d;
      return rest;
    }
    return null;
  } catch (err) {
    console.warn('[Firebase] 读取失败:', err);
    return null;
  }
}

/**
 * 获取 Firestore 中所有数据
 */
export async function getAllFromFirestore(): Promise<Record<string, any>> {
  if (!db) return {};
  try {
    const colRef = collection(db, 'dailyData');
    const snap = await getDocs(colRef);
    const result: Record<string, any> = {};
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const key = d.key || docSnap.id;
      const { key: _k, updatedAt: _u, ...rest } = d;
      result[key] = rest;
    });
    return result;
  } catch (err) {
    console.warn('[Firebase] 批量读取失败:', err);
    return {};
  }
}

/**
 * 清理 Firestore 中超过 N 天的过期数据
 */
export async function cleanupFirestore(maxDays: number = 30): Promise<number> {
  if (!db) return 0;
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxDays);
    const cutoffISO = cutoff.toISOString();

    const colRef = collection(db, 'dailyData');
    const snap = await getDocs(colRef);
    let deleted = 0;

    const batch = writeBatch(db);
    let ops = 0;

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.updatedAt && d.updatedAt < cutoffISO) {
        batch.delete(docSnap.ref);
        deleted++;
        ops++;
        // Firestore batch 限制 500 次操作
        if (ops >= 490) {
          batch.commit();
          ops = 0;
        }
      }
    });

    if (ops > 0) {
      await batch.commit();
    }

    return deleted;
  } catch (err) {
    console.warn('[Firebase] 清理失败:', err);
    return 0;
  }
}

/**
 * 清空 Firestore 所有数据
 */
export async function clearFirestore(): Promise<boolean> {
  if (!db) return false;
  try {
    const colRef = collection(db, 'dailyData');
    const snap = await getDocs(colRef);

    const batch = writeBatch(db);
    let ops = 0;

    snap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      ops++;
      if (ops >= 490) {
        batch.commit();
        ops = 0;
      }
    });

    if (ops > 0) {
      await batch.commit();
    }

    return true;
  } catch (err) {
    console.warn('[Firebase] 清空失败:', err);
    return false;
  }
}
