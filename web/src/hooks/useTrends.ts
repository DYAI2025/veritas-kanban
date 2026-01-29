import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/helpers';

export type TrendsPeriod = '7d' | '30d';

export interface DailyTrendPoint {
  date: string; // YYYY-MM-DD
  runs: number;
  successes: number;
  failures: number;
  errors: number;
  successRate: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  avgDurationMs: number;
}

export interface TrendsData {
  period: TrendsPeriod;
  daily: DailyTrendPoint[];
}

const API_BASE = '/api';

async function fetchTrends(period: TrendsPeriod, project?: string): Promise<TrendsData> {
  const params = new URLSearchParams();
  params.set('period', period);
  if (project) {
    params.set('project', project);
  }

  return apiFetch<TrendsData>(`${API_BASE}/metrics/trends?${params}`);
}

export function useTrends(period: TrendsPeriod = '7d', project?: string) {
  return useQuery({
    queryKey: ['trends', period, project],
    queryFn: () => fetchTrends(period, project),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });
}

// Utility functions for chart formatting
export function formatDate(dateStr: string, period: TrendsPeriod): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (period === '7d') {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
