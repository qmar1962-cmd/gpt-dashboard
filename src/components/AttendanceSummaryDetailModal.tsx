/**
 * AttendanceSummaryDetailModal.tsx
 * 汇总统计视图 - 点击百分比弹窗，显示出勤/未出勤人员明细
 */
import { useState, useEffect } from 'react';
import { X, UserCheck, UserX } from 'lucide-react';
import ATTENDANCE_MAP from '../data/attendanceMap.json';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 转运中心名称 */
  centerName: string;
  /** 二级部门 */
  dept2: string;
  /** 组别 */
  group: string;
  /** 日期字符串，如 "2026-05-01" */
  fullDate: string;
  /** 该中心所有人员行 */
  rows: Array<{ empId: string; name: string; role: string; dept2: string; group: string }>;
  /** 动态出勤数据（优先使用），结构: { empId: { date: boolean } } */
  attendanceData?: Record<string, Record<string, boolean>>;
}

export default function AttendanceSummaryDetailModal({
  open, onClose, centerName, dept2, group, fullDate, rows, attendanceData
}: Props) {
  const [presentList, setPresentList] = useState<Array<{ empId: string; name: string; role: string }>>([]);
  const [absentList, setAbsentList] = useState<Array<{ empId: string; name: string; role: string }>>([]);

  useEffect(() => {
    if (!open) return;

    // 优先使用动态数据（来自 IndexedDB），没有则回退到静态 JSON
    const attendanceMap = attendanceData || (ATTENDANCE_MAP as Record<string, Record<string, boolean>>);
    const present: Array<{ empId: string; name: string; role: string }> = [];
    const absent: Array<{ empId: string; name: string; role: string }> = [];

    rows.forEach(row => {
      if (row.dept2 !== dept2 || row.group !== group) return;
      const isPresent = attendanceMap[row.empId]?.[fullDate];
      if (isPresent === true) {
        present.push({ empId: row.empId, name: row.name, role: row.role });
      } else {
        // false 或无数据(undefined) 都算缺勤
        absent.push({ empId: row.empId, name: row.name, role: row.role });
      }
    });

    setPresentList(present);
    setAbsentList(absent);
  }, [open, dept2, group, fullDate, rows, attendanceData]);

  if (!open) return null;

  // "2026-05-01" → "5月1"
  const dateParts = fullDate.split('-');
  const dateLabel = `${parseInt(dateParts[1])}月${parseInt(dateParts[2])}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-zinc-800">
              {centerName} · {dept2} · {group}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">{dateLabel} 出勤明细</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
            <X size={18} className="text-zinc-400" />
          </button>
        </div>

        {/* Body - 左右并排布局 */}
        <div className="flex gap-6 overflow-hidden p-6 flex-1 min-h-0">
          {/* 出勤人员 */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <UserCheck size={15} className="text-emerald-500" />
              <h4 className="text-sm font-bold text-emerald-600">出勤人员（{presentList.length}人）</h4>
            </div>
            {presentList.length === 0 ? (
              <p className="text-xs text-zinc-400 py-2">无出勤人员</p>
            ) : (
              <div className="overflow-y-auto rounded-lg border border-emerald-100 flex-1 min-h-0">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-50 sticky top-0">
                      <th className="px-3 py-2 text-left font-bold text-emerald-700">工号</th>
                      <th className="px-3 py-2 text-left font-bold text-emerald-700">姓名</th>
                      <th className="px-3 py-2 text-left font-bold text-emerald-700">岗位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentList.map((p) => (
                      <tr key={p.empId} className="border-b border-emerald-50 hover:bg-emerald-50/50 transition-colors">
                        <td className="px-3 py-2 text-zinc-600 font-mono">{p.empId}</td>
                        <td className="px-3 py-2 text-zinc-800 font-bold">{p.name}</td>
                        <td className="px-3 py-2 text-zinc-600">{p.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 分隔线 */}
          <div className="w-px bg-zinc-200 shrink-0"></div>

          {/* 未出勤人员 */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <UserX size={15} className="text-red-500" />
              <h4 className="text-sm font-bold text-red-600">未出勤人员（{absentList.length}人）</h4>
            </div>
            {absentList.length === 0 ? (
              <p className="text-xs text-zinc-400 py-2">无未出勤人员</p>
            ) : (
              <div className="overflow-y-auto rounded-lg border border-red-100 flex-1 min-h-0">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-red-50 sticky top-0">
                      <th className="px-3 py-2 text-left font-bold text-red-700">工号</th>
                      <th className="px-3 py-2 text-left font-bold text-red-700">姓名</th>
                      <th className="px-3 py-2 text-left font-bold text-red-700">岗位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absentList.map((p) => (
                      <tr key={p.empId} className="border-b border-red-50 hover:bg-red-50/50 transition-colors">
                        <td className="px-3 py-2 text-zinc-600 font-mono">{p.empId}</td>
                        <td className="px-3 py-2 text-zinc-800 font-bold">{p.name}</td>
                        <td className="px-3 py-2 text-zinc-600">{p.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
