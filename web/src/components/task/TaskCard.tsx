import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { Task, TaskType, TaskPriority } from '@veritas-kanban/shared';
import { Code, Search, FileText, Zap } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
}

const typeIcons: Record<TaskType, React.ReactNode> = {
  code: <Code className="h-3.5 w-3.5" />,
  research: <Search className="h-3.5 w-3.5" />,
  content: <FileText className="h-3.5 w-3.5" />,
  automation: <Zap className="h-3.5 w-3.5" />,
};

const typeColors: Record<TaskType, string> = {
  code: 'border-l-violet-500',
  research: 'border-l-cyan-500',
  content: 'border-l-orange-500',
  automation: 'border-l-emerald-500',
};

const priorityColors: Record<TaskPriority, string> = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-slate-500/20 text-slate-400',
};

export function TaskCard({ task, isDragging }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'group bg-card border border-border rounded-md p-3 cursor-grab active:cursor-grabbing',
        'hover:border-muted-foreground/50 transition-colors',
        'border-l-2',
        typeColors[task.type],
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground mt-0.5">
          {typeIcons[task.type]}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium leading-tight truncate">
            {task.title}
          </h3>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-2">
        {task.project && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {task.project}
          </span>
        )}
        <span className={cn(
          'text-xs px-1.5 py-0.5 rounded capitalize',
          priorityColors[task.priority]
        )}>
          {task.priority}
        </span>
      </div>
    </div>
  );
}
