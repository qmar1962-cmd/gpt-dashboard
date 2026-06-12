import React, { useState, useEffect, useRef } from 'react';
import { X, Download, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { idbGetRawData } from '../lib/idb';
import { exportRawDataExcel } from '../lib/rawDataExport';
import { cn } from '../lib/utils';

interface DateRangeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DateRangeExportModal({ isOpen, onClose }: DateRangeExportModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [selectingStart, setSelectingStart] = useState(true);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // 从 IndexedDB 的多种原始数据中提取所有可用日期
    const types = ['job_performance', 'salary_performance', 'attendance_15days', 'attendance_7days', 'work_hours_high', 'work_hours_low'];
    Promise.all(types.map(t => idbGetRawData(t))).then(results => {
      const dates = new Set<string>();
      for (const r of results) {
        if (!r) continue;
        for (const row of r.rawData) {
          const d = (row['数据日期'] || row.日期 || row.date || '').toString().slice(0, 10);
          if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) dates.add(d);
        }
      }
      setAvailableDates(dates);
    });
    // 重置状态
    setStartDate(null);
    setEndDate(null);
    setSelectingStart(true);
    setViewDate(new Date());
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  const fmtMD = (d: string) => { const p = d.split('-'); return `${parseInt(p[1])}/${parseInt(p[2])}`; };

  const isInRange = (d: string) => {
    if (startDate && endDate) return d >= startDate && d <= endDate;
    if (startDate && hoverDate && !selectingStart) {
      const [a, b] = startDate < hoverDate ? [startDate, hoverDate] : [hoverDate, startDate];
      return d >= a && d <= b;
    }
    return d === startDate;
  };

  const handleDayClick = (ds: string) => {
    if (!availableDates.has(ds)) return; // 只能选有数据的日期
    if (selectingStart || !startDate) {
      setStartDate(ds);
      setEndDate(null);
      setSelectingStart(false);
    } else {
      setStartDate(startDate < ds ? startDate : ds);
      setEndDate(startDate < ds ? ds : startDate);
    }
  };

  const handleExport = async () => {
    if (!startDate) return;
    const end = endDate || startDate;
    setIsExporting(true);
    try {
      await exportRawDataExcel(startDate, end);
      onClose();
    } catch (e) {
      console.error('[导出] 失败:', e);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-150"
        onClick={handleOverlayClick}
      />
      <div className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] bg-[#faf7f2] rounded-xl shadow-2xl border border-[#e8e2d9] animate-in zoom-in-95 duration-150 origin-center">
        {/* 标题 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#e8e2d9]">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">导出原始数据</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* 月份导航 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e8e2d9]">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-bold text-slate-700">{year}年{month + 1}月</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 星期头 */}
        <div className="grid grid-cols-7 px-3 py-1 border-b border-slate-50">
          {weekDays.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-0.5">{d}</div>)}
        </div>

        {/* 日历格子 */}
        <div className="grid grid-cols-7 p-3 gap-0.5">
          {Array.from({ length: (firstDay + 6) % 7 }, (_, i) => <div key={`e-${i}`} className="h-7" />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hasData = availableDates.has(ds);
            const inR = isInRange(ds);
            const isS = ds === startDate;
            const isE = ds === endDate;
            return (
              <button
                key={d}
                onClick={() => handleDayClick(ds)}
                onMouseEnter={() => setHoverDate(ds)}
                disabled={!hasData}
                className={cn(
                  "h-7 text-[11px] font-medium rounded-md flex items-center justify-center transition-all",
                  !hasData && "text-slate-200 cursor-not-allowed",
                  hasData && !inR && "hover:bg-slate-100 text-slate-600 cursor-pointer",
                  inR && !isS && !isE && "bg-blue-50 text-blue-700",
                  (isS || isE) && "bg-blue-500 text-white font-bold",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* 已选范围提示 */}
        <div className="px-5 py-2 border-t border-[#e8e2d9] bg-[#f0ebe3]/50">
          <p className="text-[10px] text-slate-500 text-center">
            {startDate ? (
              endDate
                ? <>已选：<span className="font-bold text-blue-600">{fmtMD(startDate)} ~ {fmtMD(endDate)}</span></>
                : <>起点 <span className="font-bold text-blue-600">{fmtMD(startDate)}</span>，点击另一个日期选终点</>
            ) : '点击有数据的日期选择起始日期'}
          </p>
        </div>

        {/* 按钮 */}
        <div className="px-5 pb-4 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[12px] font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || !startDate}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={12} />
            {isExporting ? '导出中...' : '导出 Excel'}
          </button>
        </div>
      </div>
    </>
  );
}
