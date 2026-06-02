/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 版本：2026-05-26 - 重构：拆分组件，提取数据加载逻辑
 */

import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, Zap, ArrowRight, BarChart3, Upload, Settings, CalendarDays } from 'lucide-react';
import AttendanceModule from './components/AttendanceModule';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingOverlay from './components/LoadingOverlay';
import DataTable from './components/DataTable';
import SidePanel from './components/SidePanel';
import ConfigPanel from './components/ConfigPanel';
import DataManagerEnhanced from './components/DataManagerEnhanced';
import ReportModal from './components/ReportModal';
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

  // ── 局部状态 ──
  const [selection, setSelection] = useState<Selection>({ type: 'all', id: null });
  const [reportOpen, setReportOpen] = useState(false);
  const [outsourcingData, setOutsourcingData] = useState<Record<string, number> | null>(null);

  // 加载外包人数数据
  useEffect(() => {
    fetch('./database/outsourcing.json?t=' + Date.now(), { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setOutsourcingData(data); })
      .catch(() => {});
  }, []);

  // ── 派生数据 ──
  const displayData = customData && customData.length > 0 ? customData : PERFORMANCE_DATA;
  const enrichedData = useEnrichedData(
    displayData, rawDataState, salaryDataState, attendance15DataState,
    attendance7DataState, rosterDataState, workHoursHighDataState, workHoursLowDataState,
    outsourcingData,
  );
  const filteredData = useFilteredData(enrichedData, exemptCenters);

  const avgTotalScore = Math.round(filteredData.reduce((acc, curr) => acc + curr.totalScore, 0) / filteredData.length);
  const totalUnits = filteredData.length;

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
        isLoading={loading.isLoading}
        message={loading.message}
        progress={loading.progress}
      />

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
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="min-h-screen bg-white text-slate-900 font-sans flex relative overflow-hidden" id="bold-dashboard">
          {/* Vertical Intelligence Sidebar */}
          <nav className="w-16 h-full border-r border-slate-200 flex flex-col items-center justify-center bg-white">
            <div className="flex items-center gap-4 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold">报告：刘洋 {formattedDate}</span>
            </div>

            <div className="mt-auto mb-8 flex flex-col gap-4">
              <button
                onClick={() => setConfigOpen(true)}
                className="p-3 rounded-lg transition-all flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-slate-200"
                title="看板配置"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => safeSetViewMode('dashboard')}
                className={`p-3 rounded-lg transition-all flex items-center justify-center ${
                  viewMode === 'dashboard'
                    ? 'bg-blue-600 text-white shadow-lg scale-110'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="数据看板"
              >
                <BarChart3 size={18} />
              </button>
              <button
                onClick={() => safeSetViewMode('attendance')}
                className={`p-3 rounded-lg transition-all flex items-center justify-center ${
                  viewMode === 'attendance'
                    ? 'bg-blue-600 text-white shadow-lg scale-110'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="中心考勤"
              >
                <CalendarDays size={18} />
              </button>
              {isAdminLogin && (
                <button
                  onClick={() => safeSetViewMode('data')}
                  className={`relative p-3 rounded-lg transition-all flex items-center justify-center ${
                    viewMode === 'data'
                      ? 'bg-blue-600 text-white shadow-lg scale-110'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title="数据上传与管理"
                >
                  <Upload size={20} strokeWidth={2.5} />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                </button>
              )}
            </div>
          </nav>

          {/* Main Stream Area */}
          <div className="flex-1 flex flex-col overflow-auto h-screen [scrollbar-gutter:stable]">
            <header className="h-16 min-h-[64px] border-b border-slate-200 flex items-center justify-between px-12 bg-white sticky top-0 z-50">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-black tracking-tighter leading-none">GPT 数据通报</h1>
                <p className="text-[10px] text-slate-400">华中大区 · 绩效数据复盘</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-mono bg-black text-white px-2.5 py-0.5 rounded">数据日期 {formattedT2Date}</span>
                <span className="text-[10px] text-red-500 font-bold flex items-center gap-1"><ShieldAlert size={12} />高风险动态反馈</span>
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
              {viewMode === 'data' ? (
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
                  <div className="col-span-12 xl:col-span-9 border-r border-slate-200 bg-white">
                    <div className="p-0">
                      <div className="px-8 py-4 flex items-center justify-between border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">全区均分</span>
                          <span className={cn("text-lg font-black tabular-nums", avgTotalScore >= 80 ? "text-emerald-600" : avgTotalScore >= 60 ? "text-blue-600" : "text-amber-600")}>{avgTotalScore} 分</span>
                          <MetricHelpPanel />
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>{selection.type === 'all' ? '全部中心' : selection.label}</span>
                          {customData && customData.length > 0 && <span className="text-red-500 font-bold">• 自定义数据</span>}
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

            <footer className="h-20 min-h-[80px] border-t border-slate-200 bg-white flex items-center px-12 justify-between z-10">
              <div className="flex gap-8 items-center text-[10px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span>实时流：活跃</span>
                </div>
                <div className="h-4 w-px bg-slate-300"></div>
                <span className="opacity-40">内部机密：4级加密</span>
              </div>
              <div className="flex gap-2">
                <div className="w-1 h-1 bg-slate-900"></div>
                <div className="w-1 h-1 bg-slate-900"></div>
                <div className="w-1 h-1 bg-slate-900"></div>
                <div className="w-8 h-1 bg-slate-900 ml-4"></div>
              </div>
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
        </div>
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
