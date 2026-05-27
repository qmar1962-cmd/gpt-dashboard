import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Selection } from '../App';

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
    workHoursHigh?: { score: number };
    workHoursLow?: { score: number };
  };
  subCenters?: SubCenter[];
}

interface SummaryChartProps {
  selection: Selection;
  data: RegionData[];
}

type DimDef = { name: string; field: keyof RegionData['dimensions']; centerField: string; fullMark: number };

const DIMENSIONS: DimDef[] = [
  { name: '效能异常',  field: 'job',           centerField: 'job',            fullMark: 25 },
  { name: '绩效异常',  field: 'salary',         centerField: 'salary',         fullMark: 15 },
  { name: '连续出勤',  field: 'attendance15',   centerField: 'att15',          fullMark: 25 },
  { name: '长期未出勤',field: 'attendance7',    centerField: 'att7',           fullMark: 25 },
  { name: '日工时高',  field: 'workHoursHigh',  centerField: 'workHoursHigh',  fullMark: 5  },
  { name: '日工时低',  field: 'workHoursLow',   centerField: 'workHoursLow',   fullMark: 5  },
];

export default function SummaryChart({ selection, data }: SummaryChartProps) {
  const chartData = DIMENSIONS.map(({ name, field, centerField, fullMark }) => {
    let score = 0;

    if (selection.type === 'all') {
      const validRegions = data.filter(r => r.dimensions?.[field] !== undefined);
      if (validRegions.length > 0) {
        score = validRegions.reduce((acc, curr) => acc + (curr.dimensions?.[field]?.score ?? 0), 0) / validRegions.length;
      }
    } else if (selection.type === 'region') {
      const region = data.find(r => r.id === selection.id);
      if (region) score = region.dimensions?.[field]?.score ?? 0;
    } else if (selection.type === 'center') {
      for (const region of data) {
        const center = region.subCenters?.find((c: any) => c.id === selection.id);
        if (center) { score = center.metrics?.[centerField] ?? 0; break; }
      }
    }

    return { subject: name, A: score, fullMark };
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
