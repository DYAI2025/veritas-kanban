import { getTelemetryService, type TelemetryService } from './telemetry-service.js';
import { TaskService } from './task-service.js';
import type { 
  TaskStatus, 
  RunTelemetryEvent, 
  TokenTelemetryEvent,
  AnyTelemetryEvent 
} from '@veritas-kanban/shared';

export type MetricsPeriod = '24h' | '7d';

export interface TaskMetrics {
  byStatus: Record<TaskStatus, number>;
  total: number;
  completed: number;  // done + archived
  archived: number;
}

export interface RunMetrics {
  period: MetricsPeriod;
  runs: number;
  successes: number;
  failures: number;
  errors: number;
  errorRate: number;   // (failures + errors) / runs
  successRate: number; // successes / runs
}

export interface TokenMetrics {
  period: MetricsPeriod;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  runs: number;
  perSuccessfulRun: {
    avg: number;
    p50: number;
    p95: number;
  };
}

export interface DurationMetrics {
  period: MetricsPeriod;
  runs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
}

export class MetricsService {
  private telemetry: TelemetryService;
  private taskService: TaskService;

  constructor() {
    this.telemetry = getTelemetryService();
    this.taskService = new TaskService();
  }

  /**
   * Get timestamp for start of period
   */
  private getPeriodStart(period: MetricsPeriod): string {
    const now = new Date();
    if (period === '24h') {
      now.setHours(now.getHours() - 24);
    } else {
      now.setDate(now.getDate() - 7);
    }
    return now.toISOString();
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get task counts by status
   */
  async getTaskMetrics(project?: string): Promise<TaskMetrics> {
    const [activeTasks, archivedTasks] = await Promise.all([
      this.taskService.listTasks(),
      this.taskService.listArchivedTasks(),
    ]);

    // Filter by project if specified
    const filteredActive = project 
      ? activeTasks.filter(t => t.project === project)
      : activeTasks;
    const filteredArchived = project
      ? archivedTasks.filter(t => t.project === project)
      : archivedTasks;

    // Count by status
    const byStatus: Record<TaskStatus, number> = {
      'todo': 0,
      'in-progress': 0,
      'review': 0,
      'done': 0,
    };

    for (const task of filteredActive) {
      byStatus[task.status]++;
    }

    const archived = filteredArchived.length;
    const total = filteredActive.length + archived;
    const completed = byStatus['done'] + archived;

    return {
      byStatus,
      total,
      completed,
      archived,
    };
  }

  /**
   * Get run metrics (error rate, success rate)
   */
  async getRunMetrics(period: MetricsPeriod, project?: string): Promise<RunMetrics> {
    const since = this.getPeriodStart(period);
    
    const events = await this.telemetry.getEvents({
      type: ['run.completed', 'run.error'],
      since,
      ...(project && { project }),
    });

    let successes = 0;
    let failures = 0;
    let errors = 0;

    for (const event of events) {
      if (event.type === 'run.error') {
        errors++;
      } else if (event.type === 'run.completed') {
        const runEvent = event as RunTelemetryEvent;
        if (runEvent.success) {
          successes++;
        } else {
          failures++;
        }
      }
    }

    const runs = successes + failures + errors;
    const errorRate = runs > 0 ? (failures + errors) / runs : 0;
    const successRate = runs > 0 ? successes / runs : 0;

    return {
      period,
      runs,
      successes,
      failures,
      errors,
      errorRate,
      successRate,
    };
  }

  /**
   * Get token metrics
   */
  async getTokenMetrics(period: MetricsPeriod, project?: string): Promise<TokenMetrics> {
    const since = this.getPeriodStart(period);
    
    const events = await this.telemetry.getEvents({
      type: 'run.tokens',
      since,
      ...(project && { project }),
    });

    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    const tokensPerRun: number[] = [];

    for (const event of events) {
      const tokenEvent = event as TokenTelemetryEvent;
      totalTokens += tokenEvent.totalTokens;
      inputTokens += tokenEvent.inputTokens;
      outputTokens += tokenEvent.outputTokens;
      tokensPerRun.push(tokenEvent.totalTokens);
    }

    // Sort for percentile calculations
    tokensPerRun.sort((a, b) => a - b);

    const runs = events.length;
    const avg = runs > 0 ? totalTokens / runs : 0;
    const p50 = this.percentile(tokensPerRun, 50);
    const p95 = this.percentile(tokensPerRun, 95);

    return {
      period,
      totalTokens,
      inputTokens,
      outputTokens,
      runs,
      perSuccessfulRun: {
        avg: Math.round(avg),
        p50,
        p95,
      },
    };
  }

  /**
   * Get duration metrics
   */
  async getDurationMetrics(period: MetricsPeriod, project?: string): Promise<DurationMetrics> {
    const since = this.getPeriodStart(period);
    
    const events = await this.telemetry.getEvents({
      type: 'run.completed',
      since,
      ...(project && { project }),
    });

    const durations: number[] = [];

    for (const event of events) {
      const runEvent = event as RunTelemetryEvent;
      if (runEvent.durationMs !== undefined && runEvent.durationMs > 0) {
        durations.push(runEvent.durationMs);
      }
    }

    // Sort for percentile calculations
    durations.sort((a, b) => a - b);

    const runs = durations.length;
    const sum = durations.reduce((a, b) => a + b, 0);
    const avgMs = runs > 0 ? Math.round(sum / runs) : 0;
    const p50Ms = this.percentile(durations, 50);
    const p95Ms = this.percentile(durations, 95);

    return {
      period,
      runs,
      avgMs,
      p50Ms,
      p95Ms,
    };
  }

  /**
   * Get all metrics in one call (for dashboard)
   */
  async getAllMetrics(period: MetricsPeriod = '24h', project?: string): Promise<{
    tasks: TaskMetrics;
    runs: RunMetrics;
    tokens: TokenMetrics;
    duration: DurationMetrics;
  }> {
    const [tasks, runs, tokens, duration] = await Promise.all([
      this.getTaskMetrics(project),
      this.getRunMetrics(period, project),
      this.getTokenMetrics(period, project),
      this.getDurationMetrics(period, project),
    ]);

    return { tasks, runs, tokens, duration };
  }
}

// Singleton instance
let instance: MetricsService | null = null;

export function getMetricsService(): MetricsService {
  if (!instance) {
    instance = new MetricsService();
  }
  return instance;
}
