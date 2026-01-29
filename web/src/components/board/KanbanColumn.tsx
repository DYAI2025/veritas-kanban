import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { TaskCard } from '@/components/task/TaskCard';
import { isTaskBlocked, getTaskBlockers } from '@/hooks/useTasks';
import { useBulkTaskMetrics } from '@/hooks/useBulkTaskMetrics';
import { useFeatureSettings } from '@/hooks/useFeatureSettings';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import type { Task, TaskStatus } from '@veritas-kanban/shared';

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  allTasks: Task[];
  onTaskClick?: (task: Task) => void;
  selectedTaskId?: string | null;
}

const columnColors: Record<TaskStatus, string> = {
  todo: 'border-t-slate-500',
  'in-progress': 'border-t-blue-500',
  blocked: 'border-t-red-500',
  done: 'border-t-green-500',
};

export function KanbanColumn({
  id,
  title,
  tasks,
  allTasks,
  onTaskClick,
  selectedTaskId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { settings: featureSettings } = useFeatureSettings();
  const showDoneMetrics = featureSettings.board.showDoneMetrics;

  // Get task IDs for done column to fetch bulk metrics
  const doneTaskIds = useMemo(() => {
    if (id !== 'done' || !showDoneMetrics) return [];
    return tasks.map((t) => t.id);
  }, [id, tasks, showDoneMetrics]);

  // Fetch bulk metrics only for done column
  const { data: metricsMap } = useBulkTaskMetrics(doneTaskIds, id === 'done' && showDoneMetrics);

  return (
    <div
      ref={setNodeRef}
      role="region"
      aria-label={`${title} column, ${tasks.length} tasks`}
      className={cn(
        'flex flex-col rounded-lg bg-muted/50 border-t-2 transition-all',
        columnColors[id],
        isOver && 'ring-2 ring-primary/50 bg-muted/70'
      )}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <span
          className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
          aria-live="polite"
        >
          {tasks.length}
        </span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 min-h-[calc(100vh-200px)] overflow-y-auto">
          {tasks.length === 0 ? (
            <div
              className={cn(
                'flex items-center justify-center h-24 text-sm text-muted-foreground rounded-md border-2 border-dashed',
                isOver && 'border-primary/50 bg-primary/5'
              )}
            >
              {isOver ? 'Drop here' : 'No tasks'}
            </div>
          ) : (
            tasks.map((task) => {
              const blocked = isTaskBlocked(task, allTasks);
              const blockers = blocked ? getTaskBlockers(task, allTasks) : [];
              const taskMetrics =
                id === 'done' && showDoneMetrics ? metricsMap?.get(task.id) : undefined;
              return (
                <ErrorBoundary key={task.id} level="widget">
                  <TaskCard
                    task={task}
                    onClick={() => onTaskClick?.(task)}
                    isSelected={task.id === selectedTaskId}
                    isBlocked={blocked}
                    blockerTitles={blockers.map((b) => b.title)}
                    cardMetrics={taskMetrics}
                  />
                </ErrorBoundary>
              );
            })
          )}
        </div>
      </SortableContext>
    </div>
  );
}
