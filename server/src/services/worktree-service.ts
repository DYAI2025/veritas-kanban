import fs from 'fs/promises';
import path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import { ConfigService } from './config-service.js';
import { TaskService } from './task-service.js';
import type { Task } from '@veritas-kanban/shared';

// Default paths
const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const WORKTREES_DIR = path.join(PROJECT_ROOT, '.veritas-kanban', 'worktrees');

export interface WorktreeInfo {
  path: string;
  branch: string;
  baseBranch: string;
  aheadBehind: {
    ahead: number;
    behind: number;
  };
  hasChanges: boolean;
  changedFiles: number;
}

export interface WorktreeServiceOptions {
  worktreesDir?: string;
}

export class WorktreeService {
  private worktreesDir: string;
  private configService: ConfigService;
  private taskService: TaskService;

  constructor(options: WorktreeServiceOptions = {}) {
    this.worktreesDir = options.worktreesDir || WORKTREES_DIR;
    this.configService = new ConfigService();
    this.taskService = new TaskService();
  }

  private async ensureWorktreesDir(): Promise<void> {
    await fs.mkdir(this.worktreesDir, { recursive: true });
  }

  private expandPath(p: string): string {
    return p.replace(/^~/, process.env.HOME || '');
  }

  private async getRepoGit(repoName: string): Promise<{ git: SimpleGit; repoPath: string }> {
    const config = await this.configService.getConfig();
    const repo = config.repos.find(r => r.name === repoName);
    
    if (!repo) {
      throw new Error(`Repository "${repoName}" not found in config`);
    }

    const repoPath = this.expandPath(repo.path);
    const git = simpleGit(repoPath);
    
    return { git, repoPath };
  }

  async createWorktree(taskId: string): Promise<WorktreeInfo> {
    await this.ensureWorktreesDir();

    // Get task
    const task = await this.taskService.getTask(taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" not found`);
    }

    if (task.type !== 'code') {
      throw new Error('Worktrees can only be created for code tasks');
    }

    if (!task.git?.repo || !task.git?.branch || !task.git?.baseBranch) {
      throw new Error('Task must have git repo, branch, and base branch configured');
    }

    const { git, repoPath } = await this.getRepoGit(task.git.repo);
    const worktreePath = path.join(this.worktreesDir, taskId);

    // Check if worktree already exists
    const worktreeExists = await fs.access(worktreePath).then(() => true).catch(() => false);
    if (worktreeExists) {
      throw new Error('Worktree already exists for this task');
    }

    // Fetch latest from remote
    try {
      await git.fetch();
    } catch (e) {
      // Ignore fetch errors (might be offline)
      console.warn('Could not fetch from remote:', e);
    }

    // Check if branch already exists
    const branches = await git.branchLocal();
    const branchExists = branches.all.includes(task.git.branch);

    if (branchExists) {
      // Use existing branch
      await git.raw(['worktree', 'add', worktreePath, task.git.branch]);
    } else {
      // Create new branch from base
      await git.raw(['worktree', 'add', '-b', task.git.branch, worktreePath, task.git.baseBranch]);
    }

    // Update task with worktree path
    await this.taskService.updateTask(taskId, {
      git: {
        ...task.git,
        worktreePath,
      },
    });

    // Get worktree status
    return this.getWorktreeStatus(taskId);
  }

  async getWorktreeStatus(taskId: string): Promise<WorktreeInfo> {
    const task = await this.taskService.getTask(taskId);
    if (!task?.git?.worktreePath) {
      throw new Error('Task does not have an active worktree');
    }

    const worktreePath = task.git.worktreePath;
    const worktreeGit = simpleGit(worktreePath);

    // Get branch info
    const status = await worktreeGit.status();
    
    // Get ahead/behind info
    let aheadBehind = { ahead: 0, behind: 0 };
    try {
      const { git: repoGit } = await this.getRepoGit(task.git.repo);
      
      // Fetch to get latest
      await repoGit.fetch().catch(() => {});
      
      // Compare with base branch
      const log = await worktreeGit.raw([
        'rev-list',
        '--left-right',
        '--count',
        `${task.git.baseBranch}...HEAD`
      ]);
      const [behind, ahead] = log.trim().split('\t').map(Number);
      aheadBehind = { ahead: ahead || 0, behind: behind || 0 };
    } catch (e) {
      console.warn('Could not get ahead/behind info:', e);
    }

    return {
      path: worktreePath,
      branch: task.git.branch,
      baseBranch: task.git.baseBranch,
      aheadBehind,
      hasChanges: !status.isClean(),
      changedFiles: status.files.length,
    };
  }

  async deleteWorktree(taskId: string, force: boolean = false): Promise<void> {
    const task = await this.taskService.getTask(taskId);
    if (!task?.git?.worktreePath) {
      throw new Error('Task does not have an active worktree');
    }

    const worktreePath = task.git.worktreePath;
    
    // Check for uncommitted changes
    if (!force) {
      const worktreeGit = simpleGit(worktreePath);
      const status = await worktreeGit.status();
      
      if (!status.isClean()) {
        throw new Error('Worktree has uncommitted changes. Use force=true to delete anyway.');
      }
    }

    // Get main repo git
    const { git: repoGit } = await this.getRepoGit(task.git.repo);
    
    // Remove worktree
    await repoGit.raw(['worktree', 'remove', worktreePath, force ? '--force' : ''].filter(Boolean));

    // Update task to remove worktree path
    await this.taskService.updateTask(taskId, {
      git: {
        ...task.git,
        worktreePath: undefined,
      },
    });
  }

  async rebaseWorktree(taskId: string): Promise<WorktreeInfo> {
    const task = await this.taskService.getTask(taskId);
    if (!task?.git?.worktreePath) {
      throw new Error('Task does not have an active worktree');
    }

    const worktreeGit = simpleGit(task.git.worktreePath);
    
    // Fetch latest
    await worktreeGit.fetch();
    
    // Rebase onto base branch
    await worktreeGit.rebase([`origin/${task.git.baseBranch}`]);

    return this.getWorktreeStatus(taskId);
  }

  async mergeWorktree(taskId: string): Promise<void> {
    const task = await this.taskService.getTask(taskId);
    if (!task?.git?.worktreePath || !task.git?.repo) {
      throw new Error('Task does not have an active worktree');
    }

    const { git: repoGit, repoPath } = await this.getRepoGit(task.git.repo);
    
    // Checkout base branch in main repo
    await repoGit.checkout(task.git.baseBranch);
    
    // Pull latest
    await repoGit.pull();
    
    // Merge feature branch
    await repoGit.merge([task.git.branch]);
    
    // Push
    await repoGit.push();

    // Delete worktree
    await this.deleteWorktree(taskId, true);

    // Update task status to done
    await this.taskService.updateTask(taskId, {
      status: 'done',
    });
  }

  async openInVSCode(taskId: string): Promise<string> {
    const task = await this.taskService.getTask(taskId);
    if (!task?.git?.worktreePath) {
      throw new Error('Task does not have an active worktree');
    }

    // Return the command to open in VS Code
    // The frontend can use this to open via a protocol handler or display instructions
    return `code "${task.git.worktreePath}"`;
  }
}
