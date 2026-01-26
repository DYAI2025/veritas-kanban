import { useState, useEffect, useMemo } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Task, TaskType } from '@veritas-kanban/shared';

export interface FilterState {
  search: string;
  project: string | null;
  type: TaskType | null;
}

interface FilterBarProps {
  tasks: Task[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const typeLabels: Record<TaskType, string> = {
  code: '💻 Code',
  research: '🔍 Research',
  content: '📝 Content',
  automation: '⚡ Automation',
};

export function FilterBar({ tasks, filters, onFiltersChange }: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters, onFiltersChange]);

  // Sync search input with filters (e.g., when cleared externally)
  useEffect(() => {
    if (filters.search !== searchInput) {
      setSearchInput(filters.search);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  // Get unique projects from tasks
  const projects = useMemo(() => {
    const projectSet = new Set<string>();
    tasks.forEach(task => {
      if (task.project) {
        projectSet.add(task.project);
      }
    });
    return Array.from(projectSet).sort();
  }, [tasks]);

  // Count active filters
  const activeFilterCount = [
    filters.search,
    filters.project,
    filters.type,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchInput('');
    onFiltersChange({ search: '', project: null, type: null });
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Project filter */}
      <Select
        value={filters.project || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, project: value === 'all' ? null : value })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Projects</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project} value={project}>
              {project}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Type filter */}
      <Select
        value={filters.type || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, type: value === 'all' ? null : (value as TaskType) })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {(Object.entries(typeLabels) as [TaskType, string][]).map(([type, label]) => (
            <SelectItem key={type} value={type}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Active filter indicator & clear */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Filter className="h-3 w-3" />
            {activeFilterCount} active
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}

// URL sync helpers
export function filtersToSearchParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.project) params.set('project', filters.project);
  if (filters.type) params.set('type', filters.type);
  return params;
}

export function searchParamsToFilters(params: URLSearchParams): FilterState {
  return {
    search: params.get('q') || '',
    project: params.get('project') || null,
    type: (params.get('type') as TaskType) || null,
  };
}

// Filter function
export function filterTasks(tasks: Task[], filters: FilterState): Task[] {
  return tasks.filter((task) => {
    // Search filter (title + description)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const titleMatch = task.title.toLowerCase().includes(searchLower);
      const descMatch = task.description?.toLowerCase().includes(searchLower);
      if (!titleMatch && !descMatch) return false;
    }

    // Project filter
    if (filters.project && task.project !== filters.project) {
      return false;
    }

    // Type filter
    if (filters.type && task.type !== filters.type) {
      return false;
    }

    return true;
  });
}
