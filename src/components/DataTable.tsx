import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, Ban, CheckCircle2, ExternalLink, X, Download, TrendingUp } from 'lucide-react';
import { RegionalData } from '../types';
import { cn, formatNumber } from '../lib/utils';
import { getWeeklyEfficiencyDetail, WeeklyDetail, getWeeklySalaryDetail, SalaryWeeklyDetail, getWeeklyAttendance15Detail, Attendance15WeeklyDetail, getWeeklyAttendance7Detail, Attendance7WeeklyDetail, getWorkHoursHighDetail, WorkHoursHighWeeklyDetail, getWorkHoursLowDetail, WorkHoursLowWeeklyDetail } from '../lib/dataProcessor';
import { loadCollaborationData } from '../lib/collaborationApi';
import EfficiencyDetailModal from './EfficiencyDetailModal';
import SalaryDetailModal from './SalaryDetailModal';
import Attendance15DetailModal from './Attendance15DetailModal';
import Attendance7DetailModal from './Attendance7DetailModal';
import WorkHoursHighDetailModal from './WorkHoursHighDetailModal';
import WorkHoursLowDetailModal from './WorkHoursLowDetailModal';
import CenterTrendModal from './CenterTrendModal';

import { Selection } from '../App';

interface DataTableProps {
  data: RegionalData[];
  onSelect?: (selection: Selection) => void;
  currentSelection?: Selection;
  adminMode?: boolean;
  exemptCenters?: Set<string>;
  onToggleExempt?: (centerId: string) => void;
  rawData?: any[];
  salaryData?: any[];
  attendance15Data?: any[];
  attendance7Data?: any[];
  rosterData?: any[];
  workHoursHighData?: any[];
  workHoursLowData?: any[];
  outsourcingData?: Record<string, number> | null;
}

interface DetailModalState {
  isOpen: boolean;
  centerName: string;
  provinceName: string;
  weeklyData: WeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

interface SalaryModalState {
  isOpen: boolean;
  centerName: string;
  provinceName: string;
  weeklyData: SalaryWeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

interface Attendance15ModalState {
  isOpen: boolean;
  centerName: string;
  provinceName: string;
  weeklyData: Attendance15WeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

interface Attendance7ModalState {
  isOpen: boolean;
  centerName: string;
  provinceName: string;
  weeklyData: Attendance7WeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

export default function DataTable({ data, onSelect, currentSelection, adminMode, exemptCenters, onToggleExempt, rawData, salaryData, attendance15Data, attendance7Data, rosterData, workHoursHighData, workHoursLowData, outsourcingData }: DataTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({ 'shanghai-prov': true });
  // 中心元数据（负责人等）
  const [centerMeta, setCenterMeta] = useState<Record<string, Record<string, string>>>({});

  // 加载中心元数据
  useEffect(() => {
    loadCollaborationData('center_meta.json').then(meta => {
      setCenterMeta(meta);
    }).catch(e => console.error('[DataTable] 加载中心元数据失败:', e));
  }, []);

  // 获取中心负责人（优先使用协作数据）
  const getCenterResponsible = (centerName: string, fallback?: string) => {
    return centerMeta[centerName]?.['考勤负责人'] || fallback || '';
  };
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    isOpen: false,
    centerName: '',
    provinceName: '',
    weeklyData: [],
    currentCount: 0,
    prevCount: 0,
  });
  const [salaryModal, setSalaryModal] = useState<SalaryModalState>({
    isOpen: false,
    centerName: '',
    provinceName: '',
    weeklyData: [],
    currentCount: 0,
    prevCount: 0,
  });
  const [attendance15Modal, setAttendance15Modal] = useState<Attendance15ModalState>({
    isOpen: false,
    centerName: '',
    provinceName: '',
    weeklyData: [],
    currentCount: 0,
    prevCount: 0,
  });
  const [attendance7Modal, setAttendance7Modal] = useState<Attendance7ModalState>({
    isOpen: false,
    centerName: '',
    provinceName: '',
    weeklyData: [],
    currentCount: 0,
    prevCount: 0,
  });
  const [workHoursHighModal, setWorkHoursHighModal] = useState<any>({
    isOpen: false,
    centerName: '',
    provinceName: '',
    weeklyData: [],
    currentCount: 0,
    prevCount: 0,
  });
  const [workHoursLowModal, setWorkHoursLowModal] = useState<any>({
    isOpen: false,
    centerName: '',
    provinceName: '',
    weeklyData: [],
    currentCount: 0,
    prevCount: 0,
  });
  const [trendModal, setTrendModal] = useState<{ centerName: string; provinceName: string } | null>(null);
  // 非操明细弹窗
  const [nonOpDetail, setNonOpDetail] = useState<{ centerName: string; nonOpCount: number; rosterTotal: number; outsourced: number; nonOpRatio: number; departments?: Record<string, number>; positions?: Record<string, { dept: string; count: number }>; staffingStandard?: { departments: { dept: string; standard: number; actual: number; diff: number }[]; totalStandard: number; totalActual: number; posStandards: { pos: string; standard: number; rule: string }[] } } | null>(null);
  const [nonOpTab, setNonOpTab] = useState<'dept' | 'pos'>('dept');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const toggleRow = (id: string, e: React.MouseEvent) => {
    // Avoid double trigger if clicking on something that also selects
    e.stopPropagation();
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRegionClick = (item: RegionalData) => {
    if (onSelect) {
      onSelect({ type: 'region', id: item.id, label: item.province });
    }
  };

  const handleCenterClick = (center: any, item: RegionalData) => {
    if (onSelect) {
      onSelect({ type: 'center', id: center.id, label: `${item.province} - ${center.name}` });
    }
  };

  const handleExportExcel = async () => {
    const rows: any[] = [];
    data.forEach((item: any) => {
      (item.subCenters || []).forEach((c: any) => {
        rows.push({
          '省区': item.province, '中心': c.name, '得分': c.score ?? 0,
          '非操占比': c.nonOpRatio != null ? c.nonOpRatio + '%' : '',
          '综合管幅': c.compositeScope ?? '', '组长管幅': c.leaderScope ?? '',
          '综合超目标': c.compOverTarget ?? '', '组长超目标': c.leadOverTarget ?? '',
          '效能异常(个)': c.abnormalCount ?? 0, '绩效异常(人)': c.t2SalaryCount ?? 0,
          '绩效覆盖率': c.salaryCoverage || '', '连续出勤≥15天(人)': c.att15Count ?? 0,
          '连续出勤触发率': c.att15Rate || '', '长期未出勤≥7天(人)': c.att7Count ?? 0,
          '日工时高>12.5h(人)': c.t2WhHighCount ?? 0, '日工时高触发率': c.whHighRate || '',
          '日工时低≤8h(人)': c.t2WhLowCount ?? 0,
        });
      });
    });
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map((k: string) => ({ wch: Math.max(k.length * 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '绩效通报');
    XLSX.writeFile(wb, 'GPT绩效通报_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  };

  return (
    <div className="w-full border-t border-slate-200 bg-white" id="performance-data-table">
      {/* Toolbar */}
      <div className="flex items-center justify-end px-4 py-1.5 bg-slate-50 border-b border-slate-100">
        <button onClick={handleExportExcel} className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"><Download size={12} />导出 Excel</button>
      </div>
      {/* Table Header */}
      <div className="grid grid-cols-[50px_160px_80px_80px_100px_100px_1fr] bg-slate-100/80 backdrop-blur-sm border-b border-slate-200 py-3 px-4 sticky top-[95px] z-20">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">排名</div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">分区 / 负责人</div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">得分</div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">非操</div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">管幅</div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">超目标</div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">各维度明细</div>
      </div>

      <div className="flex flex-col">
        {[...data].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)).map((item, idx) => (
          <React.Fragment key={item.id}>
            {/* Province Row */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
              onClick={() => handleRegionClick(item)}
              className={cn(
                "grid grid-cols-[50px_160px_80px_80px_100px_100px_1fr] items-center py-5 px-4 border-b border-slate-100 cursor-pointer group transition-all",
                currentSelection?.id === item.id ? "bg-slate-900 text-white shadow-[0_0_30px_rgba(0,0,0,0.2)] z-20" : 
                expandedRows[item.id] ? "bg-white shadow-[0_0_25px_rgba(0,0,0,0.03)] z-10" : "bg-white hover:bg-slate-50/50"
              )}
            >
              <div className={cn(
                "text-3xl font-black italic tracking-tighter transition-opacity",
                currentSelection?.id === item.id ? "opacity-100" : "opacity-10 group-hover:opacity-100"
              )}>#{idx + 1}</div>
              
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="font-black text-base uppercase tracking-tighter leading-none mb-1">{item.province}</span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest leading-none",
                    currentSelection?.id === item.id ? "opacity-60" : "opacity-30"
                  )}>{item.responsible}</span>
                </div>
                {item.subCenters && (
                   <div 
                     onClick={(e) => toggleRow(item.id, e)}
                     className={cn("transition-transform duration-300 p-2 hover:bg-black/10 rounded-full", expandedRows[item.id] ? "rotate-180" : "")}
                   >
                     <ChevronDown size={14} className={currentSelection?.id === item.id ? "opacity-100" : "opacity-20"} />
                   </div>
                )}
              </div>

              <div className="text-right flex justify-end items-center gap-2 pr-4">
                <div className={cn(
                  "px-3 py-1 font-mono font-black text-sm",
                  item.performanceScore < 0 ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                )}>
                  {formatNumber(item.performanceScore)}
                </div>
              </div>

              {/* 省区非操占比（各中心平均） */}
              <div className="text-right flex justify-end items-center pr-4">
                {(() => {
                  const centersWithNonOp = (item.subCenters || []).filter((c: any) => c.nonOpRatio !== undefined);
                  if (centersWithNonOp.length > 0) {
                    const avg = centersWithNonOp.reduce((s: number, c: any) => s + (c.nonOpRatio || 0), 0) / centersWithNonOp.length;
                    return <span className="font-black text-base tracking-tighter">{avg.toFixed(2)}%</span>;
                  }
                  return <span className="text-sm font-bold text-slate-300">—</span>;
                })()}
              </div>

              <div className="text-right pr-4 flex flex-col items-end justify-center gap-1">
                {(() => {
                  const centersWithScope = (item.subCenters || []).filter((c: any) => c.compositeScope !== undefined);
                  if (centersWithScope.length > 0) {
                    const avgComp = centersWithScope.reduce((s: number, c: any) => s + (c.compositeScope || 0), 0) / centersWithScope.length;
                    const avgLead = centersWithScope.reduce((s: number, c: any) => s + (c.leaderScope || 0), 0) / centersWithScope.length;
                    return (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-slate-400 leading-none">综合</span>
                          <span className="font-black text-xl tracking-tighter leading-none">{avgComp.toFixed(1)}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-slate-400 leading-none">组长</span>
                          <span className="font-black text-base tracking-tighter text-slate-500 leading-none">{avgLead.toFixed(1)}</span>
                        </div>
                      </>
                    );
                  }
                  return <span className="text-sm font-bold text-slate-300">—</span>;
                })()}
              </div>

              {/* 超目标列 */}
              <div className="text-right pr-4 flex flex-col items-end justify-center gap-1">
                {(() => {
                  const centersWithScope = (item.subCenters || []).filter((c: any) => c.compositeScope !== undefined);
                  if (centersWithScope.length > 0) {
                    const sumCompOT = centersWithScope.reduce((s: number, c: any) => s + (c.compOverTarget || 0), 0);
                    const sumLeadOT = centersWithScope.reduce((s: number, c: any) => s + (c.leadOverTarget || 0), 0);
                    return (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-slate-400 leading-none">综合</span>
                          <span className={cn("font-black text-base font-mono tracking-tighter leading-none", sumCompOT > 0 ? "text-red-500" : sumCompOT < 0 ? "text-emerald-500" : "text-slate-400")}>{sumCompOT > 0 ? '+' : ''}{sumCompOT.toFixed(1)}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-slate-400 leading-none">组长</span>
                          <span className={cn("font-black text-xs font-mono tracking-tighter text-slate-500 leading-none", sumLeadOT > 0 ? "!text-red-400" : sumLeadOT < 0 ? "!text-emerald-400" : "")}>{sumLeadOT > 0 ? '+' : ''}{sumLeadOT.toFixed(1)}</span>
                        </div>
                      </>
                    );
                  }
                  return <span className="text-sm font-bold text-slate-300">—</span>;
                })()}
              </div>

              <div className="grid grid-cols-[repeat(6,1fr)] gap-2 pl-4 border-l border-slate-100 min-w-0">
                <DimensionCell label="效能异常" score={item.dimensions?.job?.score ?? 0} metrics={item.dimensions?.job?.metrics ?? []} />
                <DimensionCell label="绩效异常" score={item.dimensions?.salary?.score ?? 0} metrics={item.dimensions?.salary?.metrics ?? []} />
                <DimensionCell label="连续出勤" score={item.dimensions?.attendance15?.score ?? 0} metrics={item.dimensions?.attendance15?.metrics ?? []} />
                <DimensionCell label="长期未出勤" score={item.dimensions?.attendance7?.score ?? 0} metrics={item.dimensions?.attendance7?.metrics ?? []} />
                <DimensionCell label="日工时高" score={item.dimensions?.workHoursHigh?.score ?? 0} metrics={item.dimensions?.workHoursHigh?.metrics ?? []} />
                <DimensionCell label="日工时低" score={item.dimensions?.workHoursLow?.score ?? 0} metrics={item.dimensions?.workHoursLow?.metrics ?? []} />
              </div>
            </motion.div>

            {/* Sub-Center Rows */}
            <AnimatePresence>
              {expandedRows[item.id] && item.subCenters?.map((center) => {
                const exempt = exemptCenters?.has(center.id) ?? false;
                return (
                <motion.div
                  key={center.id}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onClick={() => !adminMode && handleCenterClick(center, item)}
                  className={cn(
                    "grid grid-cols-[50px_160px_80px_80px_100px_100px_1fr] items-center py-3 px-4 border-b border-slate-50 transition-all",
                    adminMode ? "cursor-default" : "cursor-pointer",
                    exempt ? "opacity-40" : "",
                    currentSelection?.id === center.id && !adminMode ? "bg-red-600 text-white" : "bg-slate-50/20 hover:bg-slate-100/50 last:border-b-slate-200"
                  )}
                >
                  <div />
                  <div className="flex items-center gap-2">
                    {/* 管理员模式：豁免开关 */}
                    {adminMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExempt?.(center.id);
                        }}
                        title={exempt ? '点击恢复考核' : '点击豁免（不计入得分）'}
                        className={cn(
                          "flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide transition-all border",
                          exempt
                            ? "bg-slate-200 text-slate-400 border-slate-300 hover:bg-red-50 hover:border-red-300 hover:text-red-500"
                            : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-red-50 hover:border-red-300 hover:text-red-500"
                        )}
                      >
                        {exempt
                          ? <><Ban size={10} /> 豁免</>
                          : <><CheckCircle2 size={10} /> 考核</>
                        }
                      </button>
                    )}
                    <div className={cn(
                      "flex flex-col pl-4 border-l-4",
                      currentSelection?.id === center.id && !adminMode ? "border-white" : "border-slate-900"
                    )}>
                      <span className="font-black text-xs uppercase tracking-tight">{center.name}中心</span>
                            <button onClick={(e) => { e.stopPropagation(); setTrendModal({ centerName: center.name, provinceName: item.province }); }} className="ml-1.5 p-0.5 hover:bg-blue-50 rounded transition-colors" title="历史趋势"><TrendingUp size={11} className="text-blue-400 hover:text-blue-600" /></button>
                      <span className={cn(
                        "text-[9px] font-bold",
                        currentSelection?.id === center.id && !adminMode ? "opacity-80" : "opacity-30"
                      )}>{getCenterResponsible(center.name, center.responsible)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <span className={cn(
                      "text-[10px] font-black px-2 py-1 rounded tracking-tight",
                      (center.score || 0) >= 80 ? "bg-emerald-100 text-emerald-700" :
                      (center.score || 0) >= 60 ? "bg-blue-100 text-blue-700" :
                      (center.score || 0) >= 40 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {center.score ?? 0}
                    </span>
                  </div>
                  {/* 非操占比 */}
                  <div className={cn(
                    "text-right flex justify-end items-center pr-4",
                    currentSelection?.id === center.id ? "opacity-100" : "opacity-40"
                  )}>
                    {center.nonOpRatio !== undefined
                      ? <button
                          onClick={(e) => { e.stopPropagation(); setNonOpDetail({ centerName: center.name, nonOpCount: center.nonOpCount ?? 0, rosterTotal: center.rosterInService ?? 0, outsourced: center.outsourced ?? 0, nonOpRatio: center.nonOpRatio, departments: center.nonOpDepartments, positions: center.nonOpPositions, staffingStandard: center.staffingStandard }); }}
                          className="font-black text-sm tracking-tighter hover:text-red-500 hover:underline underline-offset-2 transition-colors cursor-pointer"
                          title="点击查看非操明细"
                        >{center.nonOpRatio.toFixed(2)}%</button>
                      : <span className="text-xs font-bold text-slate-300">—</span>
                    }
                  </div>
                  <div className={cn(
                    "text-right pr-4 flex flex-col items-end justify-center gap-1",
                    currentSelection?.id === center.id ? "opacity-100" : "opacity-40"
                  )}>
                    {center.compositeScope !== undefined ? (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-slate-400 leading-none">综合</span>
                          <span className="font-black text-base tracking-tighter leading-none">{center.compositeScope?.toFixed(1)}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-slate-400 leading-none">组长</span>
                          <span className="font-black text-xs tracking-tighter text-slate-500 leading-none">{center.leaderScope?.toFixed(1)}</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-slate-300">—</span>
                    )}
                  </div>

                  {/* 超目标列 */}
                  <div className={cn(
                    "text-right pr-4 flex flex-col items-end justify-center gap-1",
                    currentSelection?.id === center.id ? "opacity-100" : "opacity-40"
                  )}>
                    {center.compositeScope !== undefined ? (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-slate-400 leading-none">综合</span>
                          <span className={cn("font-black text-xs font-mono tracking-tighter leading-none", (center.compOverTarget || 0) > 0 ? "text-red-500" : (center.compOverTarget || 0) < 0 ? "text-emerald-500" : "text-slate-400")}>{(center.compOverTarget || 0) > 0 ? '+' : ''}{(center.compOverTarget || 0).toFixed(1)}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-slate-400 leading-none">组长</span>
                          <span className={cn("font-black text-[10px] font-mono tracking-tighter text-slate-500 leading-none", (center.leadOverTarget || 0) > 0 ? "!text-red-400" : (center.leadOverTarget || 0) < 0 ? "!text-emerald-400" : "")}>{(center.leadOverTarget || 0) > 0 ? '+' : ''}{(center.leadOverTarget || 0).toFixed(1)}</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-slate-300">—</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[repeat(6,1fr)] gap-2 pl-4 border-l border-slate-100 min-w-0">
                    <div
                      className={cn(
                        "flex flex-col border-l border-slate-200 pl-3 py-1 group relative min-w-0 overflow-hidden",
                        rawData && rawData.length > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      )}
                      title={rawData && rawData.length > 0 ? "" : "请上传岗位效能异常数据以查看详情"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (rawData && rawData.length > 0) {
                          const weekly = getWeeklyEfficiencyDetail(rawData, center.name, item.province);
                          setDetailModal({
                            isOpen: true,
                            centerName: center.name,
                            provinceName: item.province,
                            weeklyData: weekly,
                            currentCount: center.abnormalCount || 0,
                            prevCount: center.prevAbnormalCount || 0,
                          });
                        }
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight flex items-center gap-1">
                          效能异常
                          {rawData && rawData.length > 0 && (
                            <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                          )}
                        </span>
                        <span className={cn(
                          "text-sm font-black px-1.5 py-0.5 rounded bg-slate-50 text-slate-900 transition-colors",
                          rawData && rawData.length > 0 && "group-hover:bg-slate-100"
                        )}>{center.metrics?.job ?? 0}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">前一天</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.prevAbnormalCount || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">个数</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.abnormalCount || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex flex-col border-l border-slate-200 pl-3 py-1 group relative min-w-0 overflow-hidden",
                        salaryData && salaryData.length > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      )}
                      title={salaryData && salaryData.length > 0 ? "" : "请上传薪资异常数据以查看详情"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (salaryData && salaryData.length > 0) {
                          const weekly = getWeeklySalaryDetail(salaryData, center.name, item.province);
                          setSalaryModal({
                            isOpen: true,
                            centerName: center.name,
                            provinceName: item.province,
                            weeklyData: weekly,
                            currentCount: center.metrics.salary || 0,
                            prevCount: center.prevSalaryCount || 0,
                          });
                        }
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight flex items-center gap-1">
                          绩效异常
                          {salaryData && salaryData.length > 0 && (
                            <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                          )}
                        </span>
                        <span className={cn(
                          "text-sm font-black px-1.5 py-0.5 rounded bg-slate-50 text-slate-900 transition-colors",
                          salaryData && salaryData.length > 0 && "group-hover:bg-slate-100"
                        )}>{center.metrics?.salary ?? 0}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">覆盖率</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.salaryCoverage || '0%'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">算薪</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.salaryCount || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex flex-col border-l border-slate-200 pl-3 py-1 group relative min-w-0 overflow-hidden",
                        attendance15Data && attendance15Data.length > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      )}
                      title={attendance15Data && attendance15Data.length > 0 ? "" : "请上传连续15日出勤数据以查看详情"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (attendance15Data && attendance15Data.length > 0) {
                          const weekly = getWeeklyAttendance15Detail(attendance15Data, center.name, item.province);
                          setAttendance15Modal({
                            isOpen: true,
                            centerName: center.name,
                            provinceName: item.province,
                            weeklyData: weekly,
                            currentCount: center.att15Count || 0,
                            prevCount: (center.att15Count || 0) - (center.att15New || 0),
                          });
                        }
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight flex items-center gap-1">
                          连续出勤
                          {attendance15Data && attendance15Data.length > 0 && (
                            <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                          )}
                        </span>
                        <span className={cn(
                          "text-sm font-black px-1.5 py-0.5 rounded bg-slate-50 text-slate-900 transition-colors",
                          attendance15Data && attendance15Data.length > 0 && "group-hover:bg-slate-100"
                        )}>{center.metrics?.att15 ?? 0}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">触发率</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.att15Rate || '0%'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">新增</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.att15New || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex flex-col border-l border-slate-200 pl-3 py-1 group relative min-w-0 overflow-hidden",
                        attendance7Data && attendance7Data.length > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      )}
                      title={attendance7Data && attendance7Data.length > 0 ? "" : "请上传连续7日未出勤数据以查看详情"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (attendance7Data && attendance7Data.length > 0) {
                          const weekly = getWeeklyAttendance7Detail(attendance7Data, center.name, item.province);
                          setAttendance7Modal({
                            isOpen: true,
                            centerName: center.name,
                            provinceName: item.province,
                            weeklyData: weekly,
                            currentCount: center.att7Count || 0,
                            prevCount: (center.att7Count || 0) - (center.att7New || 0),
                          });
                        }
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight flex items-center gap-1">
                          长期未出勤
                          {attendance7Data && attendance7Data.length > 0 && (
                            <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                          )}
                        </span>
                        <span className={cn(
                          "text-sm font-black px-1.5 py-0.5 rounded bg-slate-50 text-slate-900 transition-colors",
                          attendance7Data && attendance7Data.length > 0 && "group-hover:bg-slate-100"
                        )}>{center.metrics?.att7 ?? 0}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">异常</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.att7Count || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">新增</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.att7New || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex flex-col border-l border-slate-200 pl-3 py-1 group relative min-w-0 overflow-hidden",
                        workHoursHighData && workHoursHighData.length > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      )}
                      title={workHoursHighData && workHoursHighData.length > 0 ? "" : "请上传日工时高数据以查看详情"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (workHoursHighData && workHoursHighData.length > 0) {
                          const weekly = getWorkHoursHighDetail(workHoursHighData, center.name, item.province);
                          setWorkHoursHighModal({
                            isOpen: true,
                            centerName: center.name,
                            provinceName: item.province,
                            weeklyData: weekly,
                            currentCount: center.whHighCount || 0,
                            prevCount: (center.whHighCount || 0) - (center.whHighNew || 0),
                          });
                        }
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight flex items-center gap-1">
                          日工时高
                          {workHoursHighData && workHoursHighData.length > 0 && (
                            <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                          )}
                        </span>
                        <span className={cn(
                          "text-sm font-black px-1.5 py-0.5 rounded bg-slate-50 text-slate-900 transition-colors",
                          workHoursHighData && workHoursHighData.length > 0 && "group-hover:bg-slate-100"
                        )}>{center.metrics?.workHoursHigh ?? 0}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">触发率</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.whHighRate || '0%'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">新增</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.whHighNew || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex flex-col border-l border-slate-200 pl-3 py-1 group relative min-w-0 overflow-hidden",
                        workHoursLowData && workHoursLowData.length > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      )}
                      title={workHoursLowData && workHoursLowData.length > 0 ? "" : "请上传日工时低数据以查看详情"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (workHoursLowData && workHoursLowData.length > 0) {
                          const weekly = getWorkHoursLowDetail(workHoursLowData, center.name, item.province);
                          setWorkHoursLowModal({
                            isOpen: true,
                            centerName: center.name,
                            provinceName: item.province,
                            weeklyData: weekly,
                            currentCount: center.whLowCount || 0,
                            prevCount: (center.whLowCount || 0) - (center.whLowNew || 0),
                          });
                        }
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight flex items-center gap-1">
                          日工时低
                          {workHoursLowData && workHoursLowData.length > 0 && (
                            <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                          )}
                        </span>
                        <span className={cn(
                          "text-sm font-black px-1.5 py-0.5 rounded bg-slate-50 text-slate-900 transition-colors",
                          workHoursLowData && workHoursLowData.length > 0 && "group-hover:bg-slate-100"
                        )}>{center.metrics?.workHoursLow ?? 0}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">异常人数</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.whLowCount || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">新增</span>
                          <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{center.whLowNew || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>
          </React.Fragment>
        ))}
      </div>

      {/* 效能异常详情弹窗 */}
      <EfficiencyDetailModal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal(prev => ({ ...prev, isOpen: false }))}
        centerName={detailModal.centerName}
        provinceName={detailModal.provinceName}
        weeklyData={detailModal.weeklyData}
        currentCount={detailModal.currentCount}
        prevCount={detailModal.prevCount}
      />

      {/* 绩效异常详情弹窗 */}
      <SalaryDetailModal
        isOpen={salaryModal.isOpen}
        onClose={() => setSalaryModal(prev => ({ ...prev, isOpen: false }))}
        centerName={salaryModal.centerName}
        provinceName={salaryModal.provinceName}
        weeklyData={salaryModal.weeklyData}
        currentCount={salaryModal.currentCount}
        prevCount={salaryModal.prevCount}
      />

      {/* 连续出勤详情弹窗 */}
      <Attendance15DetailModal
        isOpen={attendance15Modal.isOpen}
        onClose={() => setAttendance15Modal(prev => ({ ...prev, isOpen: false }))}
        centerName={attendance15Modal.centerName}
        provinceName={attendance15Modal.provinceName}
        weeklyData={attendance15Modal.weeklyData}
        currentCount={attendance15Modal.currentCount}
        prevCount={attendance15Modal.prevCount}
      />

      {/* 长期未出勤详情弹窗 */}
      <Attendance7DetailModal
        isOpen={attendance7Modal.isOpen}
        onClose={() => setAttendance7Modal(prev => ({ ...prev, isOpen: false }))}
        centerName={attendance7Modal.centerName}
        provinceName={attendance7Modal.provinceName}
        weeklyData={attendance7Modal.weeklyData}
        currentCount={attendance7Modal.currentCount}
        prevCount={attendance7Modal.prevCount}
      />

      {/* 日工时高详情弹窗 */}
      <WorkHoursHighDetailModal
        isOpen={workHoursHighModal.isOpen}
        onClose={() => setWorkHoursHighModal(prev => ({ ...prev, isOpen: false }))}
        centerName={workHoursHighModal.centerName}
        provinceName={workHoursHighModal.provinceName}
        weeklyData={workHoursHighModal.weeklyData}
        currentCount={workHoursHighModal.currentCount}
        prevCount={workHoursHighModal.prevCount}
      />

      {/* 日工时低详情弹窗 */}
      <WorkHoursLowDetailModal
        isOpen={workHoursLowModal.isOpen}
        onClose={() => setWorkHoursLowModal(prev => ({ ...prev, isOpen: false }))}
        centerName={workHoursLowModal.centerName}
        provinceName={workHoursLowModal.provinceName}
        weeklyData={workHoursLowModal.weeklyData}
        currentCount={workHoursLowModal.currentCount}
        prevCount={workHoursLowModal.prevCount}
      />

      {/* 非操明细弹窗 */}
      <AnimatePresence>
        {nonOpDetail && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]" onClick={() => setNonOpDetail(null)} />
            {(() => { return (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-[70] p-6 w-[600px] max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-sm">{nonOpDetail.centerName}中心 · 非操明细</h3>
                    <button onClick={() => setNonOpDetail(null)} className="p-1 hover:bg-slate-100 rounded text-slate-400"><X size={14} /></button>
                  </div>
                  {/* 汇总行 */}
                  <div className="flex items-center gap-4 mb-3 text-[11px]">
                    <span className="text-slate-500">在职 <b className="text-slate-800">{nonOpDetail.rosterTotal}</b></span>
                    <span className="text-slate-500">外包 <b className="text-slate-800">{nonOpDetail.outsourced}</b></span>
                    <span className="text-slate-500">总人数 <b className="text-slate-800">{nonOpDetail.rosterTotal + nonOpDetail.outsourced}</b></span>
                    <span className="text-slate-500">非操占比 <b className="text-red-600">{nonOpDetail.nonOpRatio.toFixed(2)}%</b></span>
                  </div>
                  {/* 维度切换 */}
                  <div className="flex gap-1 mb-3">
                    <button onClick={() => setNonOpTab('dept')} className={nonOpTab === 'dept' ? "px-3 py-1 text-[10px] font-bold bg-slate-900 text-white rounded" : "px-3 py-1 text-[10px] font-bold bg-slate-100 text-slate-500 rounded hover:bg-slate-200"}>部门维度</button>
                    <button onClick={() => setNonOpTab('pos')} className={nonOpTab === 'pos' ? "px-3 py-1 text-[10px] font-bold bg-slate-900 text-white rounded" : "px-3 py-1 text-[10px] font-bold bg-slate-100 text-slate-500 rounded hover:bg-slate-200"}>岗位维度</button>
                  </div>
                  {/* 部门维度 */}
                  {nonOpTab === 'dept' && nonOpDetail.staffingStandard && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-3 py-2 bg-slate-900 text-[10px] font-bold text-slate-400">
                        <div>部门</div><div className="text-right">标准</div><div className="text-right">实际</div><div className="text-right">差额</div>
                      </div>
                      {nonOpDetail.staffingStandard.departments.map(d => (
                        <div key={d.dept} className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-3 py-2 border-b border-slate-50 text-[11px] hover:bg-slate-50/50">
                          <div className="font-medium text-slate-700">{d.dept}</div>
                          <div className="text-right font-mono text-slate-500">{d.standard}</div>
                          <div className="text-right font-mono font-bold text-slate-800">{d.actual || '—'}</div>
                          <div className={d.diff > 0 ? "text-right font-mono font-bold text-red-600" : d.diff < 0 ? "text-right font-mono font-bold text-emerald-600" : "text-right font-mono text-slate-400"}>
                            {d.diff > 0 ? '+' : ''}{d.diff !== 0 ? d.diff : '0'}
                          </div>
                        </div>
                      ))}
                      <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-3 py-2 bg-slate-50 text-[11px] font-bold">
                        <div>合计</div>
                        <div className="text-right font-mono text-slate-700">{nonOpDetail.staffingStandard.totalStandard}</div>
                        <div className="text-right font-mono text-slate-800">{nonOpDetail.staffingStandard.totalActual}</div>
                        <div className={nonOpDetail.staffingStandard.totalActual - nonOpDetail.staffingStandard.totalStandard > 0 ? "text-right font-mono text-red-600" : "text-right font-mono text-emerald-600"}>
                          {(() => { const d = nonOpDetail.staffingStandard.totalActual - nonOpDetail.staffingStandard.totalStandard; return (d > 0 ? '+' : '') + d; })()}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* 岗位维度 */}
                  {nonOpTab === 'pos' && nonOpDetail.positions && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-[1fr_70px_70px_60px] gap-2 px-3 py-2 bg-slate-900 text-[10px] font-bold text-slate-400">
                        <div>岗位</div><div className="text-right">标准</div><div className="text-right">实际</div><div className="text-right">差额</div>
                      </div>
                      {(() => {
                        // 按配置标准表顺序排列，匹配实际数据
                        const actualPos: Record<string, number> = {};
                        Object.entries(nonOpDetail.positions!).forEach(([key, val]) => {
                          const pos = key.split('|')[1] || key;
                          actualPos[pos] = (actualPos[pos] || 0) + val.count;
                        });
                        const posStandards = nonOpDetail.staffingStandard?.posStandards || [];
                        const matched = new Set<string>();
                        const rows: { pos: string; standard: number; actual: number; rule: string }[] = [];
                        posStandards.forEach((ps: any) => {
                          let actual = actualPos[ps.pos] || 0;
                          if (actual === 0) {
                            const fuzzyKey = Object.keys(actualPos).find(k => k.includes(ps.pos) || ps.pos.includes(k));
                            if (fuzzyKey) { actual = actualPos[fuzzyKey]; matched.add(fuzzyKey); }
                          }
                          matched.add(ps.pos);
                          rows.push({ pos: ps.pos, standard: ps.standard, actual, rule: ps.rule });
                        });
                        Object.entries(actualPos).forEach(([pos, count]) => {
                          if (!matched.has(pos) && ![...matched].some(m => pos.includes(m) || m.includes(pos))) {
                            rows.push({ pos, standard: 0, actual: count, rule: '无配置标准' });
                          }
                        });
                        return rows.map(r => (
                          <React.Fragment key={r.pos}>
                            <div className="grid grid-cols-[1fr_70px_70px_60px] gap-2 px-3 py-2 border-b border-slate-50 text-[11px] hover:bg-slate-50/50 cursor-pointer" onClick={() => setExpandedRule(expandedRule === r.pos ? null : r.pos)}>
                              <div className="font-medium text-slate-700 truncate flex items-center gap-1">
                                {r.pos}
                                {r.rule && <span className="text-slate-300 text-[9px]">ⓘ</span>}
                              </div>
                              <div className="text-right font-mono text-slate-500">{r.standard > 0 ? r.standard : '—'}</div>
                              <div className="text-right font-mono font-bold text-slate-800">{r.actual || '—'}</div>
                              <div className={(r.actual - r.standard) > 0 ? "text-right font-mono font-bold text-red-600" : (r.actual - r.standard) < 0 ? "text-right font-mono font-bold text-emerald-600" : "text-right font-mono text-slate-400"}>
                                {r.standard > 0 ? ((r.actual - r.standard) > 0 ? '+' : '') + (r.actual - r.standard) : '—'}
                              </div>
                            </div>
                            {expandedRule === r.pos && (
                              <div className="px-3 py-1.5 bg-amber-50 text-[10px] text-amber-700 border-b border-slate-50">{r.rule}</div>
                            )}
                          </React.Fragment>
                        ));
                      })()}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 pt-2">* 非操作 = 花名册(排除中心操作/中心现场管理+特殊岗位) + 外包。部门维度对标配置标准表。</p>
                </motion.div>
              );
            })()}
          </>
        )}
      </AnimatePresence>

      {/* Scoring Rules Footer */}
      <div className="p-8 bg-slate-50 border-t border-slate-200 mt-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">计分规则解析</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <div className="rule-item">
              <span className="text-[9px] font-bold block opacity-50 uppercase">岗位绩效异常</span>
              <p className="text-[11px] font-medium leading-relaxed">当月最后一天触发的岗位数量，每触发1个岗位扣5分。</p>
            </div>
            <div className="rule-item">
              <span className="text-[9px] font-bold block opacity-50 uppercase">个人薪资异常占比</span>
              <p className="text-[11px] font-medium leading-relaxed">个人薪资模块考核：覆盖率 ≤ 3% 得 15 分；覆盖率 &gt; 3%，每增加 1% 扣 3 分，最低 0 分。</p>
            </div>
            <div className="rule-item">
              <span className="text-[9px] font-bold block opacity-50 uppercase">日工时高（&gt;12.5h）</span>
              <p className="text-[11px] font-medium leading-relaxed">日均触发占比 ≤ 10% 得 5 分；占比 &gt; 10%，每增加 1% 扣 1 分（四舍五入），最低 0 分。</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rule-item">
              <span className="text-[9px] font-bold block opacity-50 uppercase">连出勤15天异常占比</span>
              <p className="text-[11px] font-medium leading-relaxed">覆盖率 &le; 3% 不扣分；覆盖率 &gt; 3%，每增加1%扣5分。当月连续出勤 &gt; 30天，过程中每出现1人扣2分。</p>
            </div>
            <div className="rule-item">
              <span className="text-[9px] font-bold block opacity-50 uppercase">连未出勤7天异常</span>
              <p className="text-[11px] font-medium leading-relaxed">过程中出现1人扣2分，累计计分（不含病假、伤残、跨组织架构等特殊情况）。</p>
            </div>
            <div className="rule-item">
              <span className="text-[9px] font-bold block opacity-50 uppercase">日工时低（≤8h）</span>
              <p className="text-[11px] font-medium leading-relaxed">每出现1人扣1分，满分5分，最低0分。</p>
            </div>
          </div>
        </div>
      </div>
      <CenterTrendModal isOpen={trendModal !== null} centerName={trendModal?.centerName || ""} provinceName={trendModal?.provinceName || ""} onClose={() => setTrendModal(null)} />
    </div>
  );
}

function DimensionCell({ label, score, metrics }: { label: string, score: number, metrics: any[] }) {
  return (
    <div className="flex flex-col border-l border-slate-200 pl-3 py-1 min-w-0">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight truncate">{label}</span>
        <span className={cn(
          "text-sm font-black px-1.5 py-0.5 rounded flex-shrink-0",
          score < 0 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-900"
        )}>
          {score}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {metrics.map((m, i) => (
          <div key={i} className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
            <span className="opacity-40 truncate">{m.label}</span>
            <span className="font-mono text-slate-600 flex-shrink-0 ml-1">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DimensionMini({ score, label, active }: { score: number, label: string, active?: boolean }) {
  return (
    <div className={cn(
      "pl-4 border-l flex items-center justify-between group/mini flex-1",
      active ? "border-white/20" : "border-slate-100"
    )}>
      <div className="flex flex-col">
        <span className={cn(
          "text-[8px] font-black uppercase transition-colors",
          active ? "text-white/60" : "text-slate-300 group-hover/mini:text-slate-500"
        )}>{label}</span>
        <span className={cn(
          "text-[11px] font-black leading-none", 
          score < 0 ? (active ? "text-white underline decoration-red-500 underline-offset-2" : "text-red-500") : (active ? "text-white" : "text-slate-500")
        )}>{score}</span>
      </div>
      <div className={cn(
         "w-10 h-1 ml-2 rounded-full overflow-hidden",
         active ? "bg-white/20" : "bg-slate-100"
      )}>
        <div 
          className={cn(
            "h-full transition-all duration-500", 
            score < 0 ? (active ? "bg-white" : "bg-red-500") : (active ? "bg-white" : "bg-slate-800")
          )} 
          style={{ width: `${Math.max(5, Math.min(100, (Math.abs(score) / 25) * 100))}%` }} 
        />
      </div>
    </div>
  );
}
