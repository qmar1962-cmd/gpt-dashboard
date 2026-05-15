/**
 * 全局加载动画组件
 * 优化版本：移除性能消耗大的动画，使用CSS原生动画
 */
import { Loader2 } from 'lucide-react';
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
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 z-[9999] pointer-events-auto',
        fullscreen
          ? 'fixed inset-0 bg-white/95'
          : 'relative min-h-[200px] w-full'
      )}
    >
      {/* 主加载动画 */}
      <div className="flex flex-col items-center gap-4">
        {/* 旋转加载图标 - 使用CSS动画替代复杂motion */}
        <div className="relative flex items-center justify-center w-14 h-14">
          <Loader2
            size={48}
            className="text-red-600 animate-spin-faster"
            strokeWidth={2.5}
          />
        </div>

        {/* 加载文案 */}
        <div className="text-center">
          <p className="text-sm font-bold text-zinc-700">{message}</p>
          {/* 可选进度条 */}
          {progress !== undefined && (
            <div className="mt-3 w-48">
              <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-zinc-400">{progress}%</p>
            </div>
          )}
        </div>
      </div>
    </div>
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
