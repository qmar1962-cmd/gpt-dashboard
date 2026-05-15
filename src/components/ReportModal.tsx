/**
 * 详情报告弹窗 — 展示自动生成的文字报告
 */
import { useState, useEffect } from 'react';
import { X, Copy, Check, Download, FileText } from 'lucide-react';
import { generateReport, renderReportAsText, type FullReport } from '../lib/reportGenerator';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: {
    filteredData: any[];
    rawData?: any[];
    salaryData?: any[];
    attendanceData?: any[];
    attendance15Data?: any[];
    attendance7Data?: any[];
  };
}

export default function ReportModal({ isOpen, onClose, params }: ReportModalProps) {
  const [copied, setCopied] = useState(false);
  const [report, setReport] = useState<FullReport | null>(null);
  const [textContent, setTextContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 打开弹窗时重新生成报告（基于 params）
  useEffect(() => {
    if (!isOpen) return;
    try {
      setError(null);
      const rep = generateReport(params);
      const text = renderReportAsText(rep);
      setReport(rep);
      setTextContent(text);
    } catch (e: any) {
      console.error('[ReportModal] 报告生成失败:', e);
      setError(e?.message || '报告生成失败，请检查数据');
      setReport(null);
      setTextContent('');
    }
  }, [isOpen, params]);

  if (!isOpen) return null;

  // 错误状态 UI
  if (error || !report) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div
          className="bg-white w-[90%] max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={20} />
              <h2 className="text-base font-black">报告生成失败</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="p-6 text-center">
            <p className="text-red-600 font-medium mb-2">生成详情报告时出错</p>
            <p className="text-sm text-zinc-500">{error || '未知错误，请检查数据是否完整'}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-lg hover:bg-zinc-800 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = textContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GPT数据通报_${report?.dateStr || 'report'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 统计各维度异常数
  let totalJob = 0, totalSalary = 0, totalAtt15 = 0, totalAtt7 = 0;
  report.provinces.forEach(p => p.centers.forEach(c => {
    totalJob += c.jobAbnormalCount;
    totalSalary += c.salaryCount;
    totalAtt15 += c.att15Count;
    totalAtt7 += c.att7Count;
  }));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-[90%] max-w-4xl max-h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="bg-black text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-red-500" />
            <div>
              <h2 className="text-lg font-black tracking-tight">GPT 数据通报 — 详情报告</h2>
              <p className="text-[10px] text-zinc-400 font-mono">{report.reportDate} · 全区均分 {report.overallScore} 分</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 统计条 */}
        <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center gap-6 shrink-0">
          {[
            { label: '效能异常', value: totalJob, unit: '个' },
            { label: '绩效异常', value: totalSalary, unit: '人' },
            { label: '连续出勤', value: totalAtt15, unit: '人' },
            { label: '长期未出勤', value: totalAtt7, unit: '人' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className={`font-mono font-bold text-sm ${s.value > 0 ? 'text-red-600' : 'text-zinc-400'}`}>{s.value}</span>
              <span className="text-[10px] text-zinc-500">{s.label}{s.unit}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-[11px] font-black uppercase tracking-wide rounded hover:bg-zinc-800 transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? '已复制' : '复制'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-[11px] font-black uppercase tracking-wide rounded hover:bg-red-700 transition-colors"
            >
              <Download size={13} />
              下载
            </button>
          </div>
        </div>

        {/* 报告正文 */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {/* 执行摘要 */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-2">📋 执行摘要</h3>
            <p className="text-sm leading-relaxed text-zinc-700">{report.summary}</p>
          </div>

          {/* 各省区详情 */}
          {report.provinces.map(prov => (
            <div key={prov.province} className="mb-6 last:mb-0">
              <div className="flex items-center gap-3 mb-3 pb-2 border-b-2 border-zinc-100">
                <span className="text-xl font-black italic">#{prov.ranking}</span>
                <span className="text-base font-black">{prov.province}</span>
                <span className="text-xs text-zinc-400">负责人：{prov.responsible}</span>
                <span className={`ml-auto px-2.5 py-0.5 rounded font-mono font-bold text-sm ${prov.totalScore >= 80 ? 'bg-emerald-100 text-emerald-700' : prov.totalScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {prov.totalScore}分
                </span>
              </div>

              <div className="space-y-3 pl-4">
                {prov.centers.map(center => {
                  const hasIssue = center.jobAbnormalCount > 0 || center.salaryCount > 0 || center.att15Count > 0 || center.att7Count > 0;
                  return (
                    <div key={center.centerName} className={`p-3 rounded-lg border ${hasIssue ? 'border-red-200 bg-red-50/30' : 'border-zinc-200 bg-zinc-50/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black">{center.centerName}</span>
                          <span className="text-[10px] text-zinc-400">({center.responsible})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-sm ${center.score >= 80 ? 'bg-emerald-100 text-emerald-700' : center.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {center.score}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* 效能异常 */}
                        <div className={`p-2 rounded ${center.jobAbnormalCount > 0 ? 'bg-red-50' : 'bg-zinc-100'}`}>
                          <span className="text-zinc-500">效能异常</span>
                          <div className="font-mono font-bold">{
                            center.jobAbnormalCount > 0
                              ? <span className="text-red-600">{center.jobAbnormalCount} 个 <span className="text-[10px] text-zinc-400">(前一天 {center.jobPrevCount})</span></span>
                              : <span className="text-zinc-400">—</span>
                          }</div>
                        </div>

                        {/* 绩效异常 */}
                        <div className={`p-2 rounded ${center.salaryCount > 0 ? 'bg-red-50' : 'bg-zinc-100'}`}>
                          <span className="text-zinc-500">绩效异常</span>
                          <div className="font-mono font-bold">{
                            center.salaryCount > 0
                              ? <span className="text-red-600">{center.salaryCount} 人 <span className="text-[10px] text-zinc-400">({center.salaryCoverage})</span></span>
                              : <span className="text-zinc-400">—</span>
                          }</div>
                        </div>

                        {/* 连续出勤 */}
                        <div className={`p-2 rounded ${center.att15Count > 0 ? 'bg-red-50' : 'bg-zinc-100'}`}>
                          <span className="text-zinc-500">连续出勤</span>
                          <div className="font-mono font-bold">{
                            center.att15Count > 0
                              ? <span className="text-red-600">{center.att15Count} 人 <span className="text-[10px] text-zinc-400">({center.att15Rate})</span></span>
                              : <span className="text-zinc-400">—</span>
                          }</div>
                        </div>

                        {/* 长期未出勤 */}
                        <div className={`p-2 rounded ${center.att7Count > 0 ? 'bg-red-50' : 'bg-zinc-100'}`}>
                          <span className="text-zinc-500">长期未出勤</span>
                          <div className="font-mono font-bold">{
                            center.att7Count > 0
                              ? <span className="text-red-600">{center.att7Count} 人</span>
                              : <span className="text-zinc-400">—</span>
                          }</div>
                        </div>
                      </div>

                      {/* 明细展开 */}
                      {hasIssue && center.jobAbnormalCount > 0 && (
                        <div className="mt-2 pt-2 border-t border-red-100">
                          <p className="text-[10px] text-red-500 font-black uppercase mb-1">效能异常明细</p>
                          <div className="space-y-1">
                            {center.jobDetails?.slice(0, 5).map((d, i) => (
                              <div key={i} className="text-xs text-zinc-600 pl-2 border-l-2 border-red-300">
                                {d.jobName}：偏离 +{d.deviation}%（实际 {d.actualValue} / 目标 {d.targetValue}）
                              </div>
                            ))}
                            {center.jobDetails && center.jobDetails.length > 5 && (
                              <div className="text-[10px] text-zinc-400">... 等 {center.jobDetails.length} 条</div>
                            )}
                          </div>
                        </div>
                      )}
                      {hasIssue && center.salaryCount > 0 && (
                        <div className="mt-2 pt-2 border-t border-red-100">
                          <p className="text-[10px] text-red-500 font-black uppercase mb-1">绩效异常明细</p>
                          <div className="space-y-1">
                            {center.salaryDetails?.slice(0, 5).map((d, i) => (
                              <div key={i} className="text-xs text-zinc-600 pl-2 border-l-2 border-red-300">
                                {d.name}（{d.jobName}）：均值偏离 +{d.avgDeviation}%
                              </div>
                            ))}
                            {center.salaryDetails && center.salaryDetails.length > 5 && (
                              <div className="text-[10px] text-zinc-400">... 等 {center.salaryDetails.length} 条</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-200 text-[10px] text-zinc-400 text-right shrink-0">
          由 GPT 数据通报系统自动生成 · {report.generatedAt}
        </div>
      </div>
    </div>
  );
}
