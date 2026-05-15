import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Selection } from '../App';

// 省区/子中心类型定义（避免循环依赖）
interface SubCenter {
  id: string;
  name: string;
  score?: number;
  metrics?: Record<string, number>;
}
interface RegionData {
  id: string;
  province: string;
  totalScore: number;
  performanceScore: number;
  dimensions?: {
    job?: { score: number };
    salary?: { score: number };
    attendance15?: { score: number };
    attendance7?: { score: number };
  };
  subCenters?: SubCenter[];
}

interface SummaryChartProps {
  selection: Selection;
  /** 实际展示的 enriched 数据（含真实计算后的维度得分） */
  data: RegionData[];
}

export default function SummaryChart({ selection, data }: SummaryChartProps) {
  const dimensions = ['效能异常', '绩效异常', '连续出勤', '长期未出勤'];

  const chartData = dimensions.map(dim => {
    let score = 0;

    if (selection.type === 'all') {
      // 全局模式：所有省区的各维度平均分
      const validRegions = data.filter(r =>
        r.dimensions?.job !== undefined ||
        r.dimensions?.salary !== undefined ||
        r.dimensions?.attendance15 !== undefined ||
        r.dimensions?.attendance7 !== undefined
      );
      if (validRegions.length > 0) {
        score = validRegions.reduce((acc, curr) => {
          if (dim === '效能异常') return acc + (curr.dimensions?.job?.score ?? 0);
          if (dim === '绩效异常') return acc + (curr.dimensions?.salary?.score ?? 0);
          if (dim === '连续出勤') return acc + (curr.dimensions?.attendance15?.score ?? 0);
          return acc + (curr.dimensions?.attendance7?.score ?? 0);
        }, 0) / validRegions.length;
      }
    } else if (selection.type === 'region') {
      // 省区模式：该省区的维度得分
      const region = data.find(r => r.id === selection.id);
      if (region) {
        if (dim === '效能异常') score = region.dimensions?.job?.score ?? 0;
        else if (dim === '绩效异常') score = region.dimensions?.salary?.score ?? 0;
        else if (dim === '连续出勤') score = region.dimensions?.attendance15?.score ?? 0;
        else score = region.dimensions?.attendance7?.score ?? 0;
      }
    } else if (selection.type === 'center') {
      // 中心模式：该中心的四项得分之和
      for (const region of data) {
        const center = region.subCenters?.find((c: any) => c.id === selection.id);
        if (center) {
          if (dim === '效能异常') score = center.metrics?.job ?? 0;
          else if (dim === '绩效异常') score = center.metrics?.salary ?? 0;
          else if (dim === '连续出勤') score = center.metrics?.att15 ?? 0;
          else score = center.metrics?.att7 ?? 0;
          break;
        }
      }
    }
    
    return {
      subject: dim,
      A: Math.abs(score), // Radar usually works better with absolute values or we need to offset
      fullMark: 25,
    };
  });

  return (
    <div className="w-full h-full bg-white border border-neutral-200 p-4 flex flex-col items-center justify-center shadow-inner" id="summary-radar-chart">
       <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest mb-4">
         {selection.type === 'all' ? '维度平均指标综合分析' : `${selection.label} 维度指标`}
       </span>
       <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
          <PolarGrid stroke="#e5e5e5" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#888', fontStyle: 'italic', fontFamily: 'serif' }} />
          <Radar
            name="Score"
            dataKey="A"
            stroke={selection.type === 'all' ? "#000" : "#ef4444"}
            fill={selection.type === 'all' ? "#000" : "#ef4444"}
            fillOpacity={0.1}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
