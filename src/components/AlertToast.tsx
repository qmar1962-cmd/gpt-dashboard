/**
 * 顶部浮动告警通知
 * 液态玻璃风格，支持滑动关闭
 */
import { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

export interface AlertItem {
  id: string;
  center: string;
  province: string;
  type: string;
  detail: string;
  severity: number;
}

interface Props {
  alerts: AlertItem[];
  onDismiss: (id: string) => void;
}

function ToastItem({ alert, onDismiss }: { alert: AlertItem; onDismiss: (id: string) => void }) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, -80, 0, 80, 150], [0, 0.5, 1, 0.5, 0]);
  const [dismissed, setDismissed] = useState(false);

  const handleDragEnd = () => {
    if (Math.abs(x.get()) > 80) {
      setDismissed(true);
      onDismiss(alert.id);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: dismissed ? (x.get() > 0 ? 200 : -200) : 0, y: -20, scale: 0.95, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="pointer-events-auto cursor-grab active:cursor-grabbing"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      style={{ x, opacity }}
      onDragEnd={handleDragEnd}
    >
      <div
        className="relative flex items-center gap-3 px-4 py-3 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(74, 69, 64, 0.85)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* 左侧图标 */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#7a5a5a]/40 flex items-center justify-center">
          <AlertTriangle size={15} className="text-[#d4b8b8]" />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-[#e0dcd6]">{alert.center}</span>
            <span className="text-[10px] text-[#b0a89c]">· {alert.province}</span>
          </div>
          <p className="text-[11px] text-[#b0a89c] mt-0.5 truncate">
            {alert.type} {alert.detail}
          </p>
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={() => { setDismissed(true); onDismiss(alert.id); }}
          className="flex-shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={13} className="text-[#b0a89c]" />
        </button>
      </div>
    </motion.div>
  );
}

export default function AlertToast({ alerts, onDismiss }: Props) {
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[420px] pointer-events-none">
      <AnimatePresence mode="popLayout">
        {alerts.map((alert) => (
          <ToastItem key={alert.id} alert={alert} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
