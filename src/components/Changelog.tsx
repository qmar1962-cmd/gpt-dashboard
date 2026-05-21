import React, { useState } from 'react';
import { History, X, ChevronDown, ChevronUp, Sparkles, Bug, Zap, FileText } from 'lucide-react';

interface ChangelogEntry {
  date: string;
  version: string;
  title: string;
  summary: string;
  type: 'feature' | 'fix' | 'optimize';
  details: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-05-21',
    version: 'v2.6.0',
    title: '班组负责人批量编辑 + 协作数据修复',
    summary: '支持批量编辑班组负责人，修复协作数据中文乱码问题',
    type: 'feature',
    details: [
      '【新增】班组负责人批量编辑模式：修改后暂存本地，黄色提示条提醒未保存，统一点击"保存到云端"上传',
      '【新增】离开考勤界面时保存提醒：切换 Tab 或刷新/关闭页面时弹窗提醒保存未提交的修改',
      '【新增】未保存修改刷新不丢失：修改负责人后未保存，刷新页面修改仍在本地',
      '【修复】协作数据 UTF-8 编码修复：解决保存后排休计划、未出勤原因等中文内容乱码问题',
      '【优化】弹窗界面美化：原生 alert/confirm 替换为 WPS 风格美观弹窗（白色圆角 + 半透明遮罩 + 缩放动画）',
      '【优化】口径说明更新：新增排休计划、未出勤原因、中心负责人、班组负责人的存储方式说明',
    ],
  },
  {
    date: '2026-05-19',
    version: 'v2.5.0',
    title: '协作数据存储架构升级',
    summary: '排休计划、未出勤原因、中心/班组负责人改为 GitHub API 协作存储',
    type: 'feature',
    details: [
      '【新增】排休计划协作编辑：支持为连续出勤≥15天的员工添加排休计划，存储于 GitHub 仓库 leave_plans.json',
      '【新增】未出勤原因协作编辑：支持为连续未出勤≥7天的员工添加未出勤原因，存储于 GitHub 仓库 absence_reasons.json',
      '【新增】中心负责人编辑：支持设置中心考勤负责人，存储于 GitHub 仓库 center_meta.json',
      '【新增】班组负责人编辑：支持设置各班组负责人，存储于 GitHub 仓库 group_leaders.json',
      '【新增】多人协作支持：所有协作数据通过 GitHub API 读写，所有用户共享，实时同步',
    ],
  },
];

const typeConfig = {
  feature: { icon: <Sparkles size={12} />, label: '新增', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  fix: { icon: <Bug size={12} />, label: '修复', color: 'bg-red-50 text-red-700 border-red-200' },
  optimize: { icon: <Zap size={12} />, label: '优化', color: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function Changelog() {
  const [open, setOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <>
      {/* 按钮 */}
      <button
        onClick={() => setOpen(true)}
        title="更新日志"
        className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors"
      >
        <History size={14} className="text-zinc-500" />
      </button>

      {/* 弹窗 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* 面板 */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col animate-[fadeIn_0.2s_ease-out]">
            {/* 头部 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-zinc-700" />
                <h3 className="text-sm font-bold text-zinc-800">更新日志</h3>
                <span className="text-[10px] text-zinc-400 font-medium">{CHANGELOG[0]?.version}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <X size={14} className="text-zinc-400" />
              </button>
            </div>

            {/* 列表 */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {CHANGELOG.map((entry, idx) => {
                const cfg = typeConfig[entry.type];
                const isExpanded = expandedIndex === idx;
                return (
                  <div
                    key={idx}
                    className="border border-zinc-100 rounded-xl overflow-hidden hover:border-zinc-200 transition-colors"
                  >
                    {/* 简要行 */}
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                      className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-zinc-50/50 transition-colors"
                    >
                      {/* 类型标签 */}
                      <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.color}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-zinc-800">{entry.title}</span>
                          <span className="text-[10px] text-zinc-400 font-medium">{entry.date}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate">{entry.summary}</p>
                      </div>

                      {/* 展开箭头 */}
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-zinc-400 shrink-0 mt-1" />
                      ) : (
                        <ChevronDown size={14} className="text-zinc-400 shrink-0 mt-1" />
                      )}
                    </button>

                    {/* 详情展开区 */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-zinc-50/50">
                        <ul className="space-y-2">
                          {entry.details.map((detail, dIdx) => (
                            <li key={dIdx} className="flex items-start gap-2 text-[11px] text-zinc-600 leading-relaxed">
                              <span className="shrink-0 w-1 h-1 rounded-full bg-zinc-400 mt-1.5" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 底部 */}
            <div className="px-5 py-3 border-t border-zinc-100 text-center">
              <span className="text-[10px] text-zinc-400">如有问题请联系刘杨</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
