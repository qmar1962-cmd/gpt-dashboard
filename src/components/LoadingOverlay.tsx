/**
 * 全局加载动画组件
 * 优化版本：移除性能消耗大的动画，使用CSS原生动画
 */
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  progress?: number; // 0-100，可选进度条
  fullscreen?: boolean; // 是否全屏覆盖，默认 true
}

export default function LoadingOverlay({
  isLoading,
  message = '加载中...',
  progress,
  fullscreen = true,
}: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="loading-overlay"
          className={cn(
            'flex flex-col items-center justify-center gap-4 z-[9999] pointer-events-auto',
            fullscreen
              ? 'fixed inset-0 bg-[#0a0a0a]'
              : 'relative min-h-[200px] w-full'
          )}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        >
      {/* 呼吸光晕 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full animate-lamp-breathe pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,200,100,0.12) 0%, rgba(255,180,60,0.04) 40%, transparent 70%)' }}
      />

      {/* 主加载动画 */}
      <div className="relative flex flex-col items-center gap-4">
        {/* 灯泡光效 */}
        <div className="relative flex items-center justify-center w-14 h-14">
          <div className="absolute inset-0 rounded-full animate-lamp-breathe"
            style={{ boxShadow: '0 0 30px 8px rgba(255,200,100,0.15), 0 0 80px 20px rgba(255,180,60,0.08)' }}
          />
          <Loader2
            size={40}
            className="text-amber-400/80 animate-spin-faster"
            strokeWidth={2}
          />
        </div>

        {/* 加载文案 */}
        <div className="text-center">
          <p className="text-sm font-bold text-white/50">{message}</p>
          {/* 可选进度条 */}
          {progress !== undefined && (
            <div className="mt-3 w-48">
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500/60 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-white/30">{progress}%</p>
            </div>
          )}
        </div>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 小型加载指示器（用于按钮内或局部区域）
 */
export function LoadingSpinner({ size = 16 }: { size?: number }) {
  return (
    <Loader2
      size={size}
      className="animate-spin-faster text-current"
      strokeWidth={2.5}
    />
  );
}
