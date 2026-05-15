import { useState, useEffect, useCallback } from 'react';

const ADMIN_KEY = 'gpt_dashboard_admin_mode';
const EXEMPT_KEY = 'gpt_dashboard_exempt_centers';

/**
 * 管理员模式 Hook
 * - adminMode: 当前是否处于管理员模式
 * - toggleAdmin: 开关管理员模式（需要密码）
 * - exemptCenters: 豁免中心 ID 集合（这些中心不计入得分）
 * - toggleExempt: 切换某个中心的豁免状态
 * - isExempt: 查询某中心是否被豁免
 */
export function useAdminMode() {
  const [adminMode, setAdminMode] = useState<boolean>(false);
  const [exemptCenters, setExemptCenters] = useState<Set<string>>(new Set());

  // 初始化：从 localStorage 读取豁免列表
  useEffect(() => {
    try {
      const stored = localStorage.getItem(EXEMPT_KEY);
      if (stored) {
        const arr: string[] = JSON.parse(stored);
        setExemptCenters(new Set(arr));
      }
    } catch {
      // 忽略读取错误
    }
  }, []);

  // 持久化豁免列表
  const saveExempt = useCallback((set: Set<string>) => {
    localStorage.setItem(EXEMPT_KEY, JSON.stringify(Array.from(set)));
  }, []);

  // 开关管理员模式
  const toggleAdmin = useCallback(() => {
    setAdminMode(prev => !prev);
  }, []);

  // 切换中心豁免状态
  const toggleExempt = useCallback((centerId: string) => {
    setExemptCenters(prev => {
      const next = new Set(prev);
      if (next.has(centerId)) {
        next.delete(centerId);
      } else {
        next.add(centerId);
      }
      saveExempt(next);
      return next;
    });
  }, [saveExempt]);

  // 查询某中心是否被豁免
  const isExempt = useCallback((centerId: string) => {
    return exemptCenters.has(centerId);
  }, [exemptCenters]);

  return {
    adminMode,
    toggleAdmin,
    exemptCenters,
    toggleExempt,
    isExempt,
  };
}
