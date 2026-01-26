import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useConfig, useRepoBranches } from '@/hooks/useConfig';
import { 
  useWorktreeStatus, 
  useCreateWorktree, 
  useDeleteWorktree, 
  useRebaseWorktree, 
  useMergeWorktree 
} from '@/hooks/useWorktree';
import { 
  GitBranch, 
  FolderGit2, 
  Loader2, 
  AlertCircle, 
  Play, 
  ExternalLink,
  RefreshCw,
  GitMerge,
  Trash2,
  FileCode,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { Task, TaskGit } from '@veritas-kanban/shared';
import { cn } from '@/lib/utils';

interface GitSectionProps {
  task: Task;
  onGitChange: (git: Partial<TaskGit> | undefined) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function WorktreeStatus({ task }: { task: Task }) {
  const hasWorktree = !!task.git?.worktreePath;
  const { data: status, isLoading, error } = useWorktreeStatus(task.id, hasWorktree);
  
  const createWorktree = useCreateWorktree();
  const deleteWorktree = useDeleteWorktree();
  const rebaseWorktree = useRebaseWorktree();
  const mergeWorktree = useMergeWorktree();

  const handleOpenInVSCode = () => {
    if (task.git?.worktreePath) {
      // Use vscode:// protocol to open
      window.open(`vscode://file/${task.git.worktreePath}`, '_blank');
    }
  };

  if (!task.git?.repo || !task.git?.branch) {
    return null;
  }

  // No worktree yet - show create button
  if (!hasWorktree) {
    return (
      <div className="mt-3 pt-3 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => createWorktree.mutate(task.id)}
          disabled={createWorktree.isPending}
        >
          {createWorktree.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Create Worktree
        </Button>
        {createWorktree.error && (
          <p className="text-xs text-red-500 mt-2">
            {(createWorktree.error as Error).message}
          </p>
        )}
      </div>
    );
  }

  // Loading worktree status
  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading worktree status...
        </div>
      </div>
    );
  }

  // Error loading status
  if (error) {
    return (
      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          {(error as Error).message}
        </div>
      </div>
    );
  }

  // Show worktree status
  return (
    <div className="mt-3 pt-3 border-t space-y-3">
      {/* Status indicators */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Worktree active</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {status && (
            <>
              {status.aheadBehind.ahead > 0 && (
                <span className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" />
                  {status.aheadBehind.ahead} ahead
                </span>
              )}
              {status.aheadBehind.behind > 0 && (
                <span className="flex items-center gap-1 text-amber-500">
                  <ArrowDown className="h-3 w-3" />
                  {status.aheadBehind.behind} behind
                </span>
              )}
              {status.hasChanges && (
                <span className="flex items-center gap-1">
                  <FileCode className="h-3 w-3" />
                  {status.changedFiles} changed
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenInVSCode}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open in VS Code
        </Button>

        {status && status.aheadBehind.behind > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => rebaseWorktree.mutate(task.id)}
            disabled={rebaseWorktree.isPending}
          >
            {rebaseWorktree.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Rebase
          </Button>
        )}

        {status && status.aheadBehind.ahead > 0 && !status.hasChanges && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" size="sm">
                <GitMerge className="h-3 w-3 mr-1" />
                Merge
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Merge to {task.git?.baseBranch}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will merge {task.git?.branch} into {task.git?.baseBranch}, push to remote, 
                  delete the worktree, and mark the task as Done.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => mergeWorktree.mutate(task.id)}
                  disabled={mergeWorktree.isPending}
                >
                  {mergeWorktree.isPending ? 'Merging...' : 'Merge & Complete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Trash2 className="h-3 w-3 mr-1" />
              Delete Worktree
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete worktree?</AlertDialogTitle>
              <AlertDialogDescription>
                {status?.hasChanges 
                  ? 'Warning: This worktree has uncommitted changes that will be lost.'
                  : 'This will remove the worktree but keep the branch.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteWorktree.mutate({ 
                  taskId: task.id, 
                  force: status?.hasChanges 
                })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Worktree path */}
      <div className="text-xs text-muted-foreground font-mono truncate">
        {task.git.worktreePath}
      </div>
    </div>
  );
}

export function GitSection({ task, onGitChange }: GitSectionProps) {
  const { data: config, isLoading: configLoading } = useConfig();
  const [selectedRepo, setSelectedRepo] = useState<string>(task.git?.repo || '');
  const [baseBranch, setBaseBranch] = useState<string>(task.git?.baseBranch || '');
  const [featureBranch, setFeatureBranch] = useState<string>(task.git?.branch || '');
  const [autoGenerateBranch, setAutoGenerateBranch] = useState(!task.git?.branch);

  const { data: branches, isLoading: branchesLoading } = useRepoBranches(selectedRepo || undefined);

  // Get the repo config for the selected repo
  const repoConfig = useMemo(() => {
    return config?.repos.find(r => r.name === selectedRepo);
  }, [config, selectedRepo]);

  // Auto-generate feature branch name from task title
  useEffect(() => {
    if (autoGenerateBranch && task.title) {
      const slug = slugify(task.title);
      setFeatureBranch(`feature/${slug}`);
    }
  }, [task.title, autoGenerateBranch]);

  // Set default base branch when repo changes
  useEffect(() => {
    if (repoConfig && !baseBranch) {
      setBaseBranch(repoConfig.defaultBranch);
    }
  }, [repoConfig, baseBranch]);

  // Sync from task.git when it changes
  useEffect(() => {
    if (task.git) {
      setSelectedRepo(task.git.repo || '');
      setBaseBranch(task.git.baseBranch || '');
      setFeatureBranch(task.git.branch || '');
      setAutoGenerateBranch(!task.git.branch);
    }
  }, [task.id]); // Only re-sync when task changes

  // Update parent when values change
  const handleRepoChange = (repo: string) => {
    setSelectedRepo(repo);
    const newRepoConfig = config?.repos.find(r => r.name === repo);
    const newBaseBranch = newRepoConfig?.defaultBranch || 'main';
    setBaseBranch(newBaseBranch);
    
    onGitChange({
      repo,
      baseBranch: newBaseBranch,
      branch: featureBranch,
    });
  };

  const handleBaseBranchChange = (branch: string) => {
    setBaseBranch(branch);
    onGitChange({
      repo: selectedRepo,
      baseBranch: branch,
      branch: featureBranch,
    });
  };

  const handleFeatureBranchChange = (branch: string) => {
    setFeatureBranch(branch);
    setAutoGenerateBranch(false);
    onGitChange({
      repo: selectedRepo,
      baseBranch,
      branch,
    });
  };

  const handleClearGit = () => {
    setSelectedRepo('');
    setBaseBranch('');
    setFeatureBranch('');
    setAutoGenerateBranch(true);
    onGitChange(undefined);
  };

  // Don't allow editing if worktree exists
  const isLocked = !!task.git?.worktreePath;

  if (configLoading) {
    return (
      <div className="space-y-2">
        <Label className="text-muted-foreground flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Git Integration
        </Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (!config?.repos.length) {
    return (
      <div className="space-y-2">
        <Label className="text-muted-foreground flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Git Integration
        </Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-md border border-dashed">
          <AlertCircle className="h-4 w-4" />
          No repositories configured. Add one in Settings.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Git Integration
        </Label>
        {selectedRepo && !isLocked && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={handleClearGit}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="grid gap-3 p-3 rounded-md border bg-muted/30">
        {/* Repository Selection */}
        <div className="grid gap-1.5">
          <Label className="text-xs">Repository</Label>
          <Select 
            value={selectedRepo} 
            onValueChange={handleRepoChange}
            disabled={isLocked}
          >
            <SelectTrigger className={cn(isLocked && 'opacity-60')}>
              <SelectValue placeholder="Select repository..." />
            </SelectTrigger>
            <SelectContent>
              {config.repos.map((repo) => (
                <SelectItem key={repo.name} value={repo.name}>
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="h-3 w-3" />
                    {repo.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRepo && (
          <>
            {/* Base Branch */}
            <div className="grid gap-1.5">
              <Label className="text-xs">Base Branch</Label>
              {branchesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground h-9 px-3">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading branches...
                </div>
              ) : (
                <Select 
                  value={baseBranch} 
                  onValueChange={handleBaseBranchChange}
                  disabled={isLocked}
                >
                  <SelectTrigger className={cn(isLocked && 'opacity-60')}>
                    <SelectValue placeholder="Select base branch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Feature Branch */}
            <div className="grid gap-1.5">
              <Label className="text-xs">Feature Branch</Label>
              <Input
                value={featureBranch}
                onChange={(e) => handleFeatureBranchChange(e.target.value)}
                placeholder="feature/my-feature"
                disabled={isLocked}
                className={cn(isLocked && 'opacity-60')}
              />
              {autoGenerateBranch && featureBranch && !isLocked && (
                <p className="text-xs text-muted-foreground">
                  Auto-generated from task title
                </p>
              )}
            </div>

            {/* Worktree Status */}
            <WorktreeStatus task={task} />
          </>
        )}
      </div>
    </div>
  );
}
