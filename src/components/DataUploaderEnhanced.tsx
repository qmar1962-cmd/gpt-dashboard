import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileSpreadsheet, FileText, X, CheckCircle, AlertCircle, Database } from 'lucide-react';
import { cn } from '../lib/utils';
import { DataType } from '../types/data';
import TemplateSelector, { TEMPLATE_LABELS } from './TemplateSelector';
import * as xlsx from 'xlsx';

/**
 * 将各种格式的日期值统一转换为 YYYY-MM-DD 字符串
 * 支持：Excel 序列号（数字/数字字符串）、YYYY/MM/DD、YYYY-MM-DD、M/D/YY
 */
function normalizeDateValue(rawValue: any): string {
  if (typeof rawValue === 'number') {
    // Excel 序列号转 UTC 日期（25569 = 1970-01-01 对应的 Excel 天数）
    const d = new Date((rawValue - 25569) * 86400000);
    return d.toISOString().split('T')[0];
  }
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    // 纯数字字符串 → Excel 序列号
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const d = new Date((parseFloat(trimmed) - 25569) * 86400000);
      return d.toISOString().split('T')[0];
    }
    // M/D/YY 格式（如 4/1/26）→ 补全为 YYYY-MM-DD
    const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (mdyMatch) {
      let year = parseInt(mdyMatch[3]);
      if (year < 100) year += 2000; // 26 → 2026
      const month = String(parseInt(mdyMatch[1])).padStart(2, '0');
      const day = String(parseInt(mdyMatch[2])).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // YYYY/MM/DD 或已是 YYYY-MM-DD
    return trimmed.replace(/\//g, '-');
  }
  return String(rawValue || '');
}

/**
 * 遍历数据行，将所有日期类字段统一转为 YYYY-MM-DD
 */
function normalizeDatesInData(data: any[]): void {
  const dateFieldNames = ['数据日期', '日期', 'date', 'Date'];
  data.forEach(row => {
    for (const key of Object.keys(row)) {
      // 精确匹配日期字段名
      if (dateFieldNames.includes(key)) {
        row[key] = normalizeDateValue(row[key]);
      }
    }
  });
}

interface DataUploaderProps {
  onFileProcessed: (data: any[], fileName: string, dataType: DataType, date: string) => void;
  onError?: (error: string) => void;
}

export default function DataUploader({ onFileProcessed, onError }: DataUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DataType | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback(async (file: File) => {
    if (!selectedTemplate) {
      const errorMsg = '请先选择数据模板类型';
      setStatusMessage(errorMsg);
      setUploadStatus('error');
      onError?.(errorMsg);
      return;
    }

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];

    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      const errorMsg = `不支持的文件格式：${fileExtension}，请上传 Excel (.xlsx, .xls) 或 CSV 文件`;
      setStatusMessage(errorMsg);
      setUploadStatus('error');
      onError?.(errorMsg);
      return;
    }

    setIsProcessing(true);
    setUploadStatus('idle');
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      let workbook;
      
      // 检查是否为 CSV 文件
      if (fileExtension === '.csv') {
        // CSV 文件需要处理编码问题
        const decoder = new TextDecoder('gbk');
        const decodedText = decoder.decode(arrayBuffer);
        workbook = xlsx.read(decodedText, { type: 'string' });
      } else {
        // Excel 文件直接读取
        workbook = xlsx.read(arrayBuffer, { type: 'array' });
      }
      
      // 读取第一个工作表
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // 转换为 JSON 数据（raw 模式保留原始值，后处理统一日期格式）
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonData.length === 0) {
        throw new Error('文件内容为空，请检查文件是否正确');
      }

      // 后处理：统一日期字段为 YYYY-MM-DD 格式
      normalizeDatesInData(jsonData);

      // 提取日期
      const date = jsonData[0].数据日期 || jsonData[0].date || new Date().toISOString().split('T')[0];

      onFileProcessed(jsonData, file.name, selectedTemplate, date);
      setStatusMessage(`成功解析 ${jsonData.length} 行数据`);
      setUploadStatus('success');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '文件解析失败，请检查文件格式';
      setStatusMessage(errorMsg);
      setUploadStatus('error');
      onError?.(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [onFileProcessed, onError, selectedTemplate]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const resetUpload = () => {
    setUploadStatus('idle');
    setStatusMessage('');
    setFileName('');
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-10">
      {/* 模板选择器 */}
      <TemplateSelector 
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
      />

      {/* 文件上传区域 */}
      <AnimatePresence>
        {selectedTemplate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="w-full max-w-5xl mx-auto">
              <div className="mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-zinc-900 rounded-full"></div>
                <p className="text-sm font-bold text-zinc-600">
                  上传 {TEMPLATE_LABELS[selectedTemplate]} 数据
                </p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "relative border-2 border-dashed rounded-xl p-14 text-center transition-all duration-300",
                  isDragging 
                    ? "border-zinc-900 bg-zinc-50" 
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isProcessing}
                />

                <div className="flex flex-col items-center gap-4">
                  {isProcessing ? (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-14 h-14 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin"
                    />
                  ) : uploadStatus === 'success' ? (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center"
                    >
                      <CheckCircle size={28} className="text-white" />
                    </motion.div>
                  ) : uploadStatus === 'error' ? (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <AlertCircle size={28} className="text-white" />
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center"
                    >
                      <Upload size={28} className="text-zinc-400" />
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    {isProcessing ? (
                      <p className="text-zinc-500 font-medium">正在解析文件...</p>
                    ) : uploadStatus === 'success' ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-1"
                      >
                        <p className="text-emerald-600 font-bold">{statusMessage}</p>
                        <p className="text-xs text-zinc-400">文件：{fileName}</p>
                        <button
                          onClick={resetUpload}
                          className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
                        >
                          继续上传其他文件
                        </button>
                      </motion.div>
                    ) : uploadStatus === 'error' ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-1"
                      >
                        <p className="text-red-600 font-medium">{statusMessage}</p>
                        <button
                          onClick={resetUpload}
                          className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
                        >
                          重新上传
                        </button>
                      </motion.div>
                    ) : (
                      <>
                        <p className="text-base font-bold text-zinc-600">
                          拖拽文件到此处，或点击选择文件
                        </p>
                        <p className="text-sm text-zinc-400">
                          支持 Excel (.xlsx, .xls) 和 CSV (.csv)
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* 存储说明 */}
              <div className="mt-6 flex items-start gap-3 text-xs text-zinc-400">
                <Database size={16} className="mt-0.5 flex-shrink-0" />
                <p>数据按日期存储到本地数据库，自动保留 30 天，刷新页面不丢失。</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
