/**
 * SummaryService Tests
 * Tests pure aggregation/formatting logic with no external dependencies.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SummaryService } from '../services/summary-service.js';
import type { Task } from '@veritas-kanban/shared';

// Helper to create a minimal task for testing
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task_${Math.random().toString(36).substring(7)}`,
    title: 'Test Task',
    type: 'code',
    status: 'todo',
    priority: 'medium',
    project: 'test-project',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    ...overrides,
  } as Task;
}

describe('SummaryService', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
  });

  describe('getOverallSummary', () => {
    it('should return empty summary for empty task list', () => {
      const result = service.getOverallSummary([]);
      expect(result.total).toBe(0);
      expect(result.byStatus.todo).toBe(0);
      expect(result.byStatus['in-progress']).toBe(0);
      expect(result.byStatus.blocked).toBe(0);
      expect(result.byStatus.done).toBe(0);
      expect(result.highPriority).toHaveLength(0);
      expect(Object.keys(result.byProject)).toHaveLength(0);
    });

    it('should count tasks by status correctly', () => {
      const tasks = [
        makeTask({ status: 'todo' }),
        makeTask({ status: 'todo' }),
        makeTask({ status: 'in-progress' }),
        makeTask({ status: 'blocked' }),
        makeTask({ status: 'done' }),
        makeTask({ status: 'done' }),
        makeTask({ status: 'done' }),
      ];

      const result = service.getOverallSummary(tasks);
      expect(result.total).toBe(7);
      expect(result.byStatus.todo).toBe(2);
      expect(result.byStatus['in-progress']).toBe(1);
      expect(result.byStatus.blocked).toBe(1);
      expect(result.byStatus.done).toBe(3);
    });

    it('should break down tasks by project', () => {
      const tasks = [
        makeTask({ project: 'alpha', status: 'done' }),
        makeTask({ project: 'alpha', status: 'in-progress' }),
        makeTask({ project: 'beta', status: 'todo' }),
        makeTask({ project: undefined }),
      ];

      const result = service.getOverallSummary(tasks);
      expect(result.byProject.alpha).toEqual({ total: 2, done: 1, inProgress: 1 });
      expect(result.byProject.beta).toEqual({ total: 1, done: 0, inProgress: 0 });
      expect(result.byProject.unassigned).toEqual({ total: 1, done: 0, inProgress: 0 });
    });

    it('should identify high priority non-done tasks', () => {
      const tasks = [
        makeTask({ priority: 'high', status: 'todo', title: 'Urgent 1' }),
        makeTask({ priority: 'high', status: 'in-progress', title: 'Urgent 2' }),
        makeTask({ priority: 'high', status: 'done', title: 'Finished' }),
        makeTask({ priority: 'medium', status: 'todo', title: 'Normal' }),
      ];

      const result = service.getOverallSummary(tasks);
      expect(result.highPriority).toHaveLength(2);
      expect(result.highPriority.map((t) => t.title)).toContain('Urgent 1');
      expect(result.highPriority.map((t) => t.title)).toContain('Urgent 2');
      expect(result.highPriority.map((t) => t.title)).not.toContain('Finished');
    });
  });

  describe('getRecentActivity', () => {
    it('should return empty for no tasks', () => {
      const result = service.getRecentActivity([], 24);
      expect(result.completed).toHaveLength(0);
      expect(result.highPriorityActive).toHaveLength(0);
      expect(result.period.hours).toBe(24);
    });

    it('should find recently completed tasks', () => {
      const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago
      const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago

      const tasks = [
        makeTask({ status: 'done', updated: recent, title: 'Recent Done' }),
        makeTask({ status: 'done', updated: old, title: 'Old Done' }),
        makeTask({ status: 'todo', updated: recent, title: 'Not Done' }),
      ];

      const result = service.getRecentActivity(tasks, 24);
      expect(result.completed).toHaveLength(1);
      expect(result.completed[0].title).toBe('Recent Done');
    });

    it('should find recently active high-priority tasks', () => {
      const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const tasks = [
        makeTask({
          priority: 'high',
          status: 'in-progress',
          updated: recent,
          title: 'Active High',
        }),
        makeTask({ priority: 'high', status: 'blocked', updated: recent, title: 'Blocked High' }),
        makeTask({ priority: 'high', status: 'todo', updated: recent, title: 'Todo High' }),
        makeTask({ priority: 'high', status: 'done', updated: recent, title: 'Done High' }),
        makeTask({
          priority: 'medium',
          status: 'in-progress',
          updated: recent,
          title: 'Medium Active',
        }),
        makeTask({ priority: 'high', status: 'in-progress', updated: old, title: 'Old High' }),
      ];

      const result = service.getRecentActivity(tasks, 24);
      expect(result.highPriorityActive).toHaveLength(2);
      expect(result.highPriorityActive.map((t) => t.title)).toContain('Active High');
      expect(result.highPriorityActive.map((t) => t.title)).toContain('Blocked High');
    });

    it('should use custom hours parameter', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

      const tasks = [makeTask({ status: 'done', updated: threeHoursAgo, title: 'Done 3h ago' })];

      // Within 4-hour window
      const result4h = service.getRecentActivity(tasks, 4);
      expect(result4h.completed).toHaveLength(1);

      // Outside 2-hour window
      const result2h = service.getRecentActivity(tasks, 2);
      expect(result2h.completed).toHaveLength(0);
    });
  });

  describe('getProjectProgress', () => {
    it('should return empty for no tasks', () => {
      const result = service.getProjectProgress([]);
      expect(result).toHaveLength(0);
    });

    it('should calculate project progress percentages', () => {
      const tasks = [
        makeTask({ project: 'alpha', status: 'done' }),
        makeTask({ project: 'alpha', status: 'done' }),
        makeTask({ project: 'alpha', status: 'todo' }),
        makeTask({ project: 'alpha', status: 'in-progress' }),
        makeTask({ project: 'beta', status: 'done' }),
        makeTask({ project: 'beta', status: 'done' }),
      ];

      const result = service.getProjectProgress(tasks);
      const alpha = result.find((p) => p.name === 'alpha');
      const beta = result.find((p) => p.name === 'beta');

      expect(alpha).toBeDefined();
      expect(alpha!.total).toBe(4);
      expect(alpha!.done).toBe(2);
      expect(alpha!.percent).toBe(50);

      expect(beta).toBeDefined();
      expect(beta!.total).toBe(2);
      expect(beta!.done).toBe(2);
      expect(beta!.percent).toBe(100);
    });

    it('should filter out projects with only 1 task', () => {
      const tasks = [
        makeTask({ project: 'solo', status: 'done' }),
        makeTask({ project: 'pair', status: 'done' }),
        makeTask({ project: 'pair', status: 'todo' }),
      ];

      const result = service.getProjectProgress(tasks);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('pair');
    });
  });

  describe('generateMemoryMarkdown', () => {
    it('should return default message for no activity', () => {
      const result = service.generateMemoryMarkdown([]);
      expect(result).toBe('No recent kanban activity.\n');
    });

    it('should include completed tasks section', () => {
      const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      const tasks = [
        makeTask({
          status: 'done',
          updated: recent,
          title: 'Finished Task',
          project: 'alpha',
          priority: 'high',
        }),
      ];

      const result = service.generateMemoryMarkdown(tasks, 24);
      expect(result).toContain('### Veritas Kanban - Completed Tasks');
      expect(result).toContain('✅ Finished Task');
      expect(result).toContain('(alpha)');
      expect(result).toContain('🔴');
    });

    it('should include active high-priority section', () => {
      const tasks = [
        makeTask({
          status: 'in-progress',
          priority: 'high',
          title: 'Important Work',
          project: 'beta',
        }),
        makeTask({ status: 'blocked', priority: 'high', title: 'Stuck Task', project: 'beta' }),
      ];

      const result = service.generateMemoryMarkdown(tasks);
      expect(result).toContain('### Active High-Priority Tasks');
      expect(result).toContain('🔄 Important Work');
      expect(result).toContain('👀 Stuck Task');
    });

    it('should include project progress section', () => {
      const tasks = [
        makeTask({ project: 'alpha', status: 'done' }),
        makeTask({ project: 'alpha', status: 'done' }),
        makeTask({ project: 'alpha', status: 'todo' }),
      ];

      const result = service.generateMemoryMarkdown(tasks);
      expect(result).toContain('### Project Progress');
      expect(result).toContain('**alpha**');
    });
  });
});
