export interface GPTDimension {
  name: string;
  score: number;
  weight: number;
  metrics: {
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'neutral';
  }[];
}

export interface RegionalData {
  id: string;
  province: string;
  city?: string;
  responsible: string;
  performanceScore: number;
  ranking: number;
  totalScore: number;
  dimensions: {
    job: GPTDimension;
    salary: GPTDimension;
    attendance15: GPTDimension;
    attendance7: GPTDimension;
  };
  subCenters?: {
    id: string;
    name: string;
    responsible: string;
    score: number;
    metrics: {
      job: number;
      salary: number;
      att15: number;
      att7: number;
    };
  }[];
}

export interface DashboardStats {
  totalUnits: number;
  avgTotalScore: number;
  topPerformingProvince: string;
  lowestPerformingProvince: string;
}
