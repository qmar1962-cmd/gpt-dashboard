import { useMemo } from 'react';

/**
 * 豁免中心过滤器
 * 过滤掉被豁免的中心，重新计算省区得分
 */
export function useFilteredData(enrichedData: any[], exemptCenters: Set<string>) {
  return useMemo(() => {
    if (exemptCenters.size === 0) return enrichedData;
    return enrichedData.map(province => {
      const activeCenters = (province.subCenters || []).filter(
        (c: any) => !exemptCenters.has(c.id)
      );
      const newTotal = activeCenters.length > 0
        ? Math.round(activeCenters.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / activeCenters.length)
        : 0;
      return {
        ...province,
        totalScore: newTotal,
        performanceScore: newTotal,
      };
    });
  }, [enrichedData, exemptCenters]);
}
