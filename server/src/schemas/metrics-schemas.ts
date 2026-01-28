import { z } from 'zod';
import { MetricsPeriodSchema } from './common.js';

/**
 * GET /api/metrics/* query params
 */
export const MetricsQuerySchema = z.object({
  period: MetricsPeriodSchema.default('24h'),
  project: z.string().optional(),
});

/**
 * GET /api/metrics/tasks - query params (project only, no period)
 */
export const TaskMetricsQuerySchema = z.object({
  project: z.string().optional(),
});

/**
 * GET /api/metrics/budget - query params for budget metrics
 */
export const BudgetMetricsQuerySchema = z.object({
  project: z.string().optional(),
  tokenBudget: z.coerce.number().int().min(0).default(0),
  costBudget: z.coerce.number().min(0).default(0),
  warningThreshold: z.coerce.number().min(0).max(100).default(80),
});

export type MetricsQuery = z.infer<typeof MetricsQuerySchema>;
export type TaskMetricsQuery = z.infer<typeof TaskMetricsQuerySchema>;
export type BudgetMetricsQuery = z.infer<typeof BudgetMetricsQuerySchema>;
