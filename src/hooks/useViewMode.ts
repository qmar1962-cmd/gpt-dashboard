import { useState } from 'react';
import { saveCollaborationData } from '../lib/collaborationApi';

export type ViewPage = 'dashboard' | 'data' | 'attendance' | 'monthly';

export function useViewMode() {
  const [viewMode, setViewMode] = useState<ViewPage>('dashboard');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingViewMode, setPendingViewMode] = useState<ViewPage>('dashboard');

  const safeSetViewMode = (next: ViewPage) => {
    if (viewMode === 'attendance' && next !== 'attendance') {
      if (localStorage.getItem('unsaved_group_leaders') === 'true') {
        setPendingViewMode(next);
        setShowLeaveConfirm(true);
        return;
      }
    }
    setViewMode(next);
  };

  const confirmLeave = async () => {
    setShowLeaveConfirm(false);
    const dataStr = localStorage.getItem('unsaved_group_leaders_data');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        await saveCollaborationData('group_leaders.json', data, 'Update group leaders');
        localStorage.setItem('gpt_dashboard_group_leaders', dataStr);
      } catch (e) {
        console.error('[useViewMode] 保存负责人到云端失败:', e);
      }
    }
    localStorage.removeItem('unsaved_group_leaders');
    localStorage.removeItem('unsaved_group_leaders_data');
    setViewMode(pendingViewMode);
  };

  const cancelLeave = () => {
    setShowLeaveConfirm(false);
    localStorage.removeItem('unsaved_group_leaders');
    localStorage.removeItem('unsaved_group_leaders_data');
    setViewMode(pendingViewMode);
  };

  return { viewMode, setViewMode, safeSetViewMode, showLeaveConfirm, confirmLeave, cancelLeave };
}
