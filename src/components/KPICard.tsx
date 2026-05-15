import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface KPICardProps {
  label: string;
  value: string | number;
  description?: string;
  trend?: number;
  inverted?: boolean;
  className?: string;
}

export default function KPICard({ label, value, description, trend, inverted, className }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-6 flex flex-col justify-center border-zinc-200 transition-colors",
        inverted ? "bg-zinc-900 text-white" : "bg-white text-zinc-900",
        className
      )}
      id={`kpi-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span className={cn(
        "text-[9px] uppercase font-bold tracking-[0.2em] block mb-1",
        inverted ? "opacity-50" : "text-zinc-400"
      )}>
        {label}
      </span>
      <span className={cn(
        "text-3xl font-black tracking-tighter leading-none mb-1",
        trend !== undefined && trend > 0 && !inverted ? "text-emerald-600" : ""
      )}>
        {value}
      </span>
      {description && (
        <div className="flex flex-col gap-1">
          <p className={cn(
            "text-[8px] uppercase font-bold tracking-tight opacity-50"
          )}>
            {description}
          </p>
          {trend !== undefined && (
            <span className={cn(
              "text-[8px] font-mono w-fit px-1 py-0.5 rounded-sm",
              trend > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
            )}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
