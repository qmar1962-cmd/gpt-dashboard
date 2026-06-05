/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 版本：2026-05-26 - 重构：拆分组件，提取数据加载逻辑
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Zap, ArrowRight, BarChart3, Upload, Settings, CalendarDays, TrendingUp, Trash2 } from 'lucide-react';
import AttendanceModule from './components/AttendanceModule';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingOverlay from './components/LoadingOverlay';
import DataTable from './components/DataTable';
import SidePanel from './components/SidePanel';
import ConfigPanel from './components/ConfigPanel';
import DataManagerEnhanced from './components/DataManagerEnhanced';
import ReportModal from './components/ReportModal';
import MonthlyScorePanel from './components/MonthlyScorePanel';
import MetricHelpPanel from './components/MetricHelpPanel';
import ConfirmModal from './components/ConfirmModal';
import { PERFORMANCE_DATA } from './constants';
import { cn } from './lib/utils';
import { beijingDate, beijingDateCN } from './lib/dateUtils';
import { DataType } from './lib/types.js';
import { useAdminMode } from './hooks/useAdminMode';
import { useAuth } from './hooks/useAuth';
import { useViewMode } from './hooks/useViewMode';
import { useDataInit } from './hooks/useDataInit';
import { useEnrichedData } from './hooks/useEnrichedData';
import { useFilteredData } from './hooks/useFilteredData';
import { useMonthlyScore } from './hooks/useMonthlyScore';
import { clearAllCache } from './lib/idb';
import { loadCollaborationData } from './lib/collaborationApi';
import AlertToast, { AlertItem } from './components/AlertToast';

export type Selection = {
  type: 'all' | 'region' | 'center';
  id: string | null;
  label?: string;
};

export default function App() {
  // ── Hooks ──
  const { isLoggedIn, loggedInUser, isAdminLogin, handleLoginSuccess, handleLogout } = useAuth();
  const { viewMode, setViewMode, safeSetViewMode, showLeaveConfirm, confirmLeave, cancelLeave } = useViewMode();
  const { adminMode, toggleAdmin, exemptCenters, toggleExempt } = useAdminMode();
  const [configOpen, setConfigOpen] = useState(false);
  const [dashboardConfig, setDashboardConfig] = useState<any>(null);

  // 配置面板的豁免列表同步到 useAdminMode
  const handleConfigChange = useCallback((cfg: any) => {
    setDashboardConfig(cfg);
    if (cfg.exemptCenters) {
      localStorage.setItem('gpt_dashboard_exempt_centers', JSON.stringify(cfg.exemptCenters));
      window.location.reload();
    }
  }, []);
  const {
    loading, customData, rawDataState, salaryDataState,
    attendance15DataState, attendance7DataState, rosterDataState,
    workHoursHighDataState, workHoursLowDataState,
    dataFileName, handleDataLoaded: rawHandleDataLoaded, initError,
  } = useDataInit();

  // ── 数据加载等待 ──
  const loadingRef = useRef(loading.isLoading);
  useEffect(() => { loadingRef.current = loading.isLoading; }, [loading.isLoading]);
  const [loginWaiting, setLoginWaiting] = useState(false);

  const handleLoginWithReady = useCallback(async (name: string, empId: string, isAdmin: boolean) => {
    if (loadingRef.current) {
      setLoginWaiting(true);
      const start = Date.now();
      while (loadingRef.current && Date.now() - start < 30000) {
        await new Promise(r => setTimeout(r, 100));
      }
      setLoginWaiting(false);
    }
    handleLoginSuccess(name, empId, isAdmin);
  }, [handleLoginSuccess]);

  // ── 局部状态 ──
  const [selection, setSelection] = useState<Selection>({ type: 'all', id: null });
  const [reportOpen, setReportOpen] = useState(false);
  const [outsourcingData, setOutsourcingData] = useState<Record<string, number> | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  // 加载外包人数数据
  useEffect(() => {
    fetch('./database/outsourcing.json?t=' + Date.now(), { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setOutsourcingData(data); })
      .catch(() => {});
  }, []);

  // 加载未出勤原因（用于豁免判定）
  const [absenceReasons, setAbsenceReasons] = useState<Record<string, Record<string, Record<string, { reason: string }>>>>({});
  useEffect(() => {
    loadCollaborationData('absence_reasons.json')
      .then(data => { if (data) setAbsenceReasons(data); })
      .catch(() => {});
  }, []);

  // 6 小时自动登出，强制重新加载数据
  useEffect(() => {
    if (!isLoggedIn) return;
    const timer = setTimeout(() => {
      console.log('[自动登出] 6 小时会话到期，强制重新登录');
      handleLogout();
    }, 6 * 60 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [isLoggedIn, handleLogout]);

  // ── 派生数据 ──
  const displayData = customData && customData.length > 0 ? customData : PERFORMANCE_DATA;
  const enrichedData = useEnrichedData(
    displayData, rawDataState, salaryDataState, attendance15DataState,
    attendance7DataState, rosterDataState, workHoursHighDataState, workHoursLowDataState,
    outsourcingData, absenceReasons,
  );
  const filteredData = useFilteredData(enrichedData, exemptCenters);
  const { data: monthlyData, loading: monthlyLoading, monthLabel } = useMonthlyScore(monthOffset, displayData);

  const avgTotalScore = Math.round(filteredData.reduce((acc, curr) => acc + curr.totalScore, 0) / filteredData.length);
  const totalUnits = filteredData.length;

  // ── 告警通知 ──
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const allAlerts = (() => {
    const items: AlertItem[] = [];
    filteredData.forEach((prov: any) => {
      (prov.subCenters || []).forEach((c: any) => {
        // 得分骤降
        if (c.prevScore != null && (c.score || 0) < (c.prevScore || 0) - 10) {
          items.push({ id: `score-${c.id}`, center: c.name, province: prov.province, type: '得分骤降', detail: `${c.prevScore}→${c.score || 0}分`, severity: 5 });
        }
        // 效能异常恶化
        const jc = (c.abnormalCount || 0) - (c.prevAbnormalCount || 0);
        if (jc >= 2) {
          items.push({ id: `job-${c.id}`, center: c.name, province: prov.province, type: '效能异常恶化', detail: `${c.prevAbnormalCount || 0}→${c.abnormalCount}个`, severity: 4 });
        }
        // 工时高暴增
        const whc = (c.t2WhHighCount || 0) - (c.whHighPrevCount || 0);
        if (whc >= 5) {
          items.push({ id: `wh-${c.id}`, center: c.name, province: prov.province, type: '高工时暴增', detail: `${c.whHighPrevCount || 0}→${c.t2WhHighCount || 0}人`, severity: 3 });
        }
      });
    });
    return items.sort((a, b) => b.severity - a.severity).slice(0, 3);
  })();
  const visibleAlerts = allAlerts.filter(a => !dismissedAlerts.has(a.id));
  const handleDismissAlert = (id: string) => setDismissedAlerts(prev => new Set(prev).add(id));

  // 逐条自动消失（8秒后开始，每条间隔1.5秒）
  useEffect(() => {
    if (visibleAlerts.length === 0) return;
    const timers = visibleAlerts.map((a, i) =>
      setTimeout(() => handleDismissAlert(a.id), 8000 + i * 1500)
    );
    return () => timers.forEach(clearTimeout);
  }, [visibleAlerts.map(a => a.id).join(',')]);

  // ── 事件处理 ──
  const handleSelect = (newSelection: Selection) => {
    if (selection.id === newSelection.id && selection.type === newSelection.type) {
      setSelection({ type: 'all', id: null });
    } else {
      setSelection(newSelection);
    }
  };

  const handleDataLoaded = async (data: any[], fileName: string, newDataType: DataType, date: string) => {
    await rawHandleDataLoaded(data, fileName, newDataType, date);
    setViewMode('dashboard');
  };

  // ── 时间 ──
  const formattedDate = beijingDate(0);
  const formattedT2Date = beijingDateCN(-2);

  // ── 渲染 ──
  return (
    <>
      <LoadingOverlay
        isLoading={isLoggedIn && loading.isLoading}
        message={loading.message}
        progress={loading.progress}
      />

      {isLoggedIn && viewMode === 'dashboard' && (
        <AlertToast alerts={visibleAlerts} onDismiss={handleDismissAlert} />
      )}

      {initError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <span className="text-sm font-bold">数据加载失败：{initError}</span>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-white text-red-600 text-xs font-bold rounded hover:bg-red-50"
          >
            刷新重试
          </button>
        </div>
      )}

      {!isLoggedIn ? (
        <Login onLoginSuccess={handleLoginWithReady} dataLoading={loginWaiting} />
      ) : (
        <motion.div
          className="h-screen bg-[#faf7f2] text-slate-900 font-sans flex relative overflow-hidden px-6 pt-[64px] pb-6" id="bold-dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        >
          {/* Vertical Intelligence Sidebar */}
          <nav className="w-16 h-full border-r border-[#e8e2d9] flex flex-col items-center bg-[#faf7f2]">
            <div className="flex items-center gap-4 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold">报告：刘洋 {formattedDate}</span>
            </div>

            <div className="mt-auto mb-2 flex flex-col gap-3">
              {isAdminLogin && (
                <button
                  onClick={() => setConfigOpen(true)}
                  className="p-3 rounded-lg transition-all flex items-center justify-center bg-[#f0ebe3] text-[#8a8278] hover:bg-[#e8e2d9]"
                  title="看板配置"
                >
                  <Settings size={18} />
                </button>
              )}
              <button
                onClick={() => safeSetViewMode('dashboard')}
                className={`p-3 rounded-lg transition-all flex items-center justify-center ${
                  viewMode === 'dashboard'
                    ? 'bg-[#4a4540] text-white shadow-lg scale-110'
                    : 'bg-[#f0ebe3] text-[#8a8278] hover:bg-[#e8e2d9]'
                }`}
                title="数据看板"
              >
                <BarChart3 size={18} />
              </button>
              <button
                onClick={() => safeSetViewMode('attendance')}
                className={`p-3 rounded-lg transition-all flex items-center justify-center ${
                  viewMode === 'attendance'
                    ? 'bg-[#4a4540] text-white shadow-lg scale-110'
                    : 'bg-[#f0ebe3] text-[#8a8278] hover:bg-[#e8e2d9]'
                }`}
                title="中心考勤"
              >
                <CalendarDays size={18} />
              </button>
              <button
                onClick={() => safeSetViewMode('monthly')}
                className={`p-3 rounded-lg transition-all flex items-center justify-center ${
                  viewMode === 'monthly'
                    ? 'bg-[#4a4540] text-white shadow-lg scale-110'
                    : 'bg-[#f0ebe3] text-[#8a8278] hover:bg-[#e8e2d9]'
                }`}
                title="月度计分"
              >
                <TrendingUp size={18} />
              </button>
              {isAdminLogin && (
                <button
                  onClick={() => safeSetViewMode('data')}
                  className={`relative p-3 rounded-lg transition-all flex items-center justify-center ${
                    viewMode === 'data'
                      ? 'bg-[#4a4540] text-white shadow-lg scale-110'
                      : 'bg-[#f0ebe3] text-[#8a8278] hover:bg-[#e8e2d9]'
                  }`}
                  title="数据上传与管理"
                >
                  <Upload size={20} strokeWidth={2.5} />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#7a5a5a] rounded-full border-2 border-[#faf7f2] animate-pulse"></span>
                </button>
              )}
            </div>
          </nav>

          {/* Main Stream Area */}
          <div className="flex-1 flex flex-col overflow-auto [scrollbar-gutter:stable]">
            <header className="h-16 min-h-[64px] border-b border-[#e8e2d9] flex items-center justify-between px-12 bg-[#faf7f2] sticky top-0 z-50">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-black tracking-tighter leading-none">GPT 数据通报</h1>
                <p className="text-[10px] text-slate-400">华中大区 · 绩效数据复盘</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={async () => { await clearAllCache(); window.location.reload(); }}
                  className="text-[10px] text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                  title="清除所有本地缓存并重新加载"
                >
                  <Trash2 size={11} />清除缓存
                </button>
                <span className="text-[10px] font-mono bg-black text-white px-2.5 py-0.5 rounded">数据日期 {formattedT2Date}</span>
                <span className="text-[10px] text-[#7a5a5a] font-bold flex items-center gap-1"><ShieldAlert size={12} />高风险动态反馈</span>
                {loggedInUser && (
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="font-bold text-slate-700">
                      {loggedInUser.name}
                      {isAdminLogin && <span className="ml-1 text-amber-600">（管理员）</span>}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="text-slate-400 hover:text-red-500 transition-colors underline underline-offset-2"
                      title="退出登录"
                    >
                      退出
                    </button>
                  </div>
                )}
              </div>
            </header>

            <main className="flex-1 grid grid-cols-12 auto-rows-min overflow-visible">
              {viewMode === 'monthly' ? (
                <div className="col-span-12 h-full">
                  <ErrorBoundary label="月度计分模块">
                    <MonthlyScorePanel
                      data={monthlyData}
                      loading={monthlyLoading}
                      monthLabel={monthLabel}
                      monthOffset={monthOffset}
                      onOffsetChange={setMonthOffset}
                      exemptCenters={exemptCenters}
                    />
                  </ErrorBoundary>
                </div>
              ) : viewMode === 'data' ? (
                <div className="col-span-12">
                  <DataManagerEnhanced onDataLoaded={handleDataLoaded} />
                </div>
              ) : viewMode === 'attendance' ? (
                <div className="col-span-12">
                  <ErrorBoundary label="中心考勤模块">
                    <AttendanceModule />
                  </ErrorBoundary>
                </div>
              ) : (
                <ErrorBoundary label="数据看板">
                  {/* Main Visual & Registry */}
                  <div className="col-span-12 xl:col-span-9 border-r border-[#e8e2d9] bg-[#faf7f2]">
                    <div className="p-0">
                      <div className="px-8 py-4 flex items-center justify-between border-b border-[#e8e2d9]">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">全区均分</span>
                          <span className={cn("text-lg font-black tabular-nums", avgTotalScore >= 80 ? "text-[#3d5a3d]" : avgTotalScore >= 60 ? "text-[#3d4d5a]" : "text-[#5a4d3d]")}>{avgTotalScore} 分</span>
                          <MetricHelpPanel />
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>{selection.type === 'all' ? '全部中心' : selection.label}</span>
                          {customData && customData.length > 0 && <span className="text-[#7a5a5a] font-bold">• 自定义数据</span>}
                        </div>
                      </div>
                      <DataTable
                        data={filteredData}
                        onSelect={handleSelect}
                        currentSelection={selection}
                        adminMode={adminMode}
                        exemptCenters={exemptCenters}
                        onToggleExempt={toggleExempt}
                        rawData={rawDataState || undefined}
                        salaryData={salaryDataState || undefined}
                        attendance15Data={attendance15DataState || undefined}
                        attendance7Data={attendance7DataState || undefined}
                        rosterData={rosterDataState || undefined}
                        workHoursHighData={workHoursHighDataState || undefined}
                        workHoursLowData={workHoursLowDataState || undefined}
                        outsourcingData={outsourcingData}
                      />
                    </div>
                  </div>

                  {/* Tactical Sidebar */}
                  {/* Tactical Sidebar */}
                  <div className="col-span-12 xl:col-span-3">
                    <SidePanel selection={selection} data={filteredData} filteredData={filteredData} exemptCenters={exemptCenters} onOpenReport={() => setReportOpen(true)} onResetSelection={() => setSelection({ type: 'all', id: null })} />
                  </div>
                </ErrorBoundary>
              )}
            </main>

            <footer className="h-10 min-h-[40px] border-t border-[#e8e2d9] bg-[#faf7f2] flex items-center px-12 justify-between z-10">
              <div className="flex gap-6 items-center text-[10px] text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />实时流：活跃</span>
                <span>内部机密：4级加密</span>
              </div>
              <span className="text-[10px] text-slate-300">GPT Dashboard</span>
            </footer>
          </div>
          <ConfigPanel
            isOpen={configOpen}
            onClose={() => setConfigOpen(false)}
            centers={(() => {
              const list: { name: string; province: string }[] = [];
              filteredData.forEach((prov: any) => (prov.subCenters || []).forEach((c: any) => list.push({ name: c.name, province: prov.province })));
              return list;
            })()}
            onConfigChange={handleConfigChange}
          />
          <ReportModal
            isOpen={reportOpen}
            onClose={() => setReportOpen(false)}
            params={{
              filteredData,
              rawData: rawDataState || undefined,
              salaryData: salaryDataState || undefined,
              attendance15Data: attendance15DataState || undefined,
              attendance7Data: attendance7DataState || undefined,
              workHoursHighData: workHoursHighDataState || undefined,
              workHoursLowData: workHoursLowDataState || undefined,
            }}
          />
        </motion.div>
      )}

      <ConfirmModal
        isOpen={showLeaveConfirm}
        title="有未保存的负责人修改"
        message="中心考勤界面有未保存的负责人修改，离开前是否保存到云端？"
        confirmText="保存并离开"
        cancelText="不保存，直接离开"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </>
  );
}
