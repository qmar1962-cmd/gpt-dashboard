import React, { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  destructive?: boolean; // 确认按钮是否为危险操作（红色）
}

export default function ConfirmModal({ isOpen, title, message, confirmText = '确认', cancelText = '取消', onConfirm, onCancel, destructive = false }: ConfirmModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onCancel();
  };

  return (
    <>
      {/* 遮罩 */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-150"
        onClick={handleOverlayClick}
      />
      {/* 弹窗 */}
      <div className="fixed z-[201] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] bg-white rounded-xl shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-150 origin-center">
        {/* 标题 */}
        <div className="px-5 pt-5 pb-3 border-b border-zinc-100">
          <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
        </div>
        {/* 内容 */}
        <div className="px-5 py-4">
          <p className="text-[12px] text-zinc-600 leading-relaxed">{message}</p>
        </div>
        {/* 按钮 */}
        <div className="px-5 pb-4 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-[12px] font-medium text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 text-[12px] font-medium text-white rounded-lg transition-colors ${
              destructive
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-zinc-900 hover:bg-zinc-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
}
