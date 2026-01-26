#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

const API_BASE = process.env.VK_API_URL || 'http://localhost:3001';

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'code' | 'research' | 'content' | 'automation';
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  project?: string;
  tags?: string[];
  created: string;
  updated: string;
  git?: {
    repo: string;
    branch: string;
    baseBranch: string;
    worktreePath?: string;
  };
  attempt?: {
    id: string;
    agent: string;
    status: string;
    started?: string;
    ended?: string;
  };
  review?: {
    decision?: 'approved' | 'changes-requested' | 'rejected';
    decidedAt?: string;
    summary?: string;
  };
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API error: ${res.status}`);
  }
  
  if (res.status === 204) return undefined as T;
  return res.json();
}

function formatTask(task: Task, verbose = false): string {
  const statusColors: Record<string, (s: string) => string> = {
    'todo': chalk.gray,
    'in-progress': chalk.yellow,
    'review': chalk.blue,
    'done': chalk.green,
  };
  
  const priorityColors: Record<string, (s: string) => string> = {
    'low': chalk.dim,
    'medium': chalk.white,
    'high': chalk.red,
  };
  
  const typeIcons: Record<string, string> = {
    'code': '💻',
    'research': '🔍',
    'content': '📝',
    'automation': '⚡',
  };
  
  const statusColor = statusColors[task.status] || chalk.white;
  const priorityColor = priorityColors[task.priority] || chalk.white;
  
  let line = `${typeIcons[task.type] || '•'} ${chalk.cyan(task.id.slice(-8))} `;
  line += statusColor(`[${task.status}]`) + ' ';
  line += priorityColor(`(${task.priority})`) + ' ';
  line += chalk.bold(task.title);
  
  if (task.project) {
    line += chalk.dim(` #${task.project}`);
  }
  
  if (verbose) {
    line += '\n';
    if (task.description) {
      line += chalk.dim(`   ${task.description.slice(0, 80)}${task.description.length > 80 ? '...' : ''}\n`);
    }
    if (task.git?.branch) {
      line += chalk.dim(`   🌿 ${task.git.branch}\n`);
    }
    if (task.attempt?.status === 'running') {
      line += chalk.yellow(`   🤖 Agent running (${task.attempt.agent})\n`);
    }
    if (task.review?.decision) {
      const decisionColors: Record<string, (s: string) => string> = {
        'approved': chalk.green,
        'changes-requested': chalk.yellow,
        'rejected': chalk.red,
      };
      const color = decisionColors[task.review.decision] || chalk.white;
      line += color(`   ✓ ${task.review.decision}\n`);
    }
  }
  
  return line;
}

function formatTaskJson(task: Task): string {
  return JSON.stringify(task, null, 2);
}

function formatTasksJson(tasks: Task[]): string {
  return JSON.stringify(tasks, null, 2);
}

const program = new Command();

program
  .name('vk')
  .description('Veritas Kanban CLI - Task management for AI agents')
  .version('0.1.0');

// List tasks
program
  .command('list')
  .alias('ls')
  .description('List tasks')
  .option('-s, --status <status>', 'Filter by status (todo, in-progress, review, done)')
  .option('-t, --type <type>', 'Filter by type (code, research, content, automation)')
  .option('-p, --project <project>', 'Filter by project')
  .option('-v, --verbose', 'Show more details')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const tasks = await api<Task[]>('/api/tasks');
      
      let filtered = tasks;
      if (options.status) {
        filtered = filtered.filter(t => t.status === options.status);
      }
      if (options.type) {
        filtered = filtered.filter(t => t.type === options.type);
      }
      if (options.project) {
        filtered = filtered.filter(t => t.project === options.project);
      }
      
      if (options.json) {
        console.log(formatTasksJson(filtered));
      } else if (filtered.length === 0) {
        console.log(chalk.dim('No tasks found'));
      } else {
        filtered.forEach(task => console.log(formatTask(task, options.verbose)));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Show task details
program
  .command('show <id>')
  .description('Show task details')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      // Support partial ID matching
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      if (options.json) {
        console.log(formatTaskJson(task));
      } else {
        console.log(formatTask(task, true));
        console.log(chalk.dim('─'.repeat(60)));
        console.log(chalk.dim(`ID: ${task.id}`));
        console.log(chalk.dim(`Created: ${new Date(task.created).toLocaleString()}`));
        console.log(chalk.dim(`Updated: ${new Date(task.updated).toLocaleString()}`));
        if (task.tags?.length) {
          console.log(chalk.dim(`Tags: ${task.tags.join(', ')}`));
        }
        if (task.description) {
          console.log('\n' + task.description);
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Create task
program
  .command('create <title>')
  .description('Create a new task')
  .option('-t, --type <type>', 'Task type (code, research, content, automation)', 'code')
  .option('-p, --project <project>', 'Project name')
  .option('-d, --description <desc>', 'Task description')
  .option('--priority <priority>', 'Priority (low, medium, high)', 'medium')
  .option('--json', 'Output as JSON')
  .action(async (title, options) => {
    try {
      const task = await api<Task>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          type: options.type,
          project: options.project,
          description: options.description || '',
          priority: options.priority,
        }),
      });
      
      if (options.json) {
        console.log(formatTaskJson(task));
      } else {
        console.log(chalk.green('✓ Task created'));
        console.log(formatTask(task, true));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Update task
program
  .command('update <id>')
  .description('Update a task')
  .option('-s, --status <status>', 'New status')
  .option('-t, --type <type>', 'New type')
  .option('-p, --project <project>', 'New project')
  .option('--priority <priority>', 'New priority')
  .option('--title <title>', 'New title')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      // Support partial ID matching
      const tasks = await api<Task[]>('/api/tasks');
      const existing = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!existing) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      const updates: Record<string, unknown> = {};
      if (options.status) updates.status = options.status;
      if (options.type) updates.type = options.type;
      if (options.project) updates.project = options.project;
      if (options.priority) updates.priority = options.priority;
      if (options.title) updates.title = options.title;
      
      if (Object.keys(updates).length === 0) {
        console.error(chalk.yellow('No updates specified'));
        process.exit(1);
      }
      
      const task = await api<Task>(`/api/tasks/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      
      if (options.json) {
        console.log(formatTaskJson(task));
      } else {
        console.log(chalk.green('✓ Task updated'));
        console.log(formatTask(task, true));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Start agent on task
program
  .command('start <id>')
  .description('Start an agent on a task')
  .option('-a, --agent <agent>', 'Agent to use (claude-code, amp, copilot, gemini)', 'claude-code')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      // Support partial ID matching
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      if (task.type !== 'code') {
        console.error(chalk.red('Can only start agents on code tasks'));
        process.exit(1);
      }
      
      if (!task.git?.worktreePath) {
        console.error(chalk.red('Task needs a worktree first. Create one via the UI.'));
        process.exit(1);
      }
      
      const result = await api<{ attemptId: string }>(`/api/agents/${task.id}/start`, {
        method: 'POST',
        body: JSON.stringify({ agent: options.agent }),
      });
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.green(`✓ Agent started: ${options.agent}`));
        console.log(chalk.dim(`Attempt ID: ${result.attemptId}`));
        console.log(chalk.dim(`Working in: ${task.git.worktreePath}`));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Stop agent
program
  .command('stop <id>')
  .description('Stop a running agent')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      await api(`/api/agents/${task.id}/stop`, { method: 'POST' });
      
      if (options.json) {
        console.log(JSON.stringify({ stopped: true }));
      } else {
        console.log(chalk.yellow('✓ Agent stopped'));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Archive task
program
  .command('archive <id>')
  .description('Archive a completed task')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      await api(`/api/tasks/${task.id}/archive`, { method: 'POST' });
      
      if (options.json) {
        console.log(JSON.stringify({ archived: true }));
      } else {
        console.log(chalk.green('✓ Task archived'));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Delete task
program
  .command('delete <id>')
  .description('Delete a task')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
      
      if (options.json) {
        console.log(JSON.stringify({ deleted: true }));
      } else {
        console.log(chalk.green('✓ Task deleted'));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// === Automation Commands ===

// List pending automation tasks
program
  .command('automation:pending')
  .alias('ap')
  .description('List automation tasks pending execution')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const tasks = await api<Task[]>('/api/automation/pending');
      
      if (options.json) {
        console.log(formatTasksJson(tasks));
      } else if (tasks.length === 0) {
        console.log(chalk.dim('No pending automation tasks'));
      } else {
        console.log(chalk.bold('Pending Automation Tasks:\n'));
        tasks.forEach(task => console.log(formatTask(task, true)));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// List running automation tasks
program
  .command('automation:running')
  .alias('ar')
  .description('List currently running automation tasks')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const tasks = await api<Task[]>('/api/automation/running');
      
      if (options.json) {
        console.log(formatTasksJson(tasks));
      } else if (tasks.length === 0) {
        console.log(chalk.dim('No running automation tasks'));
      } else {
        console.log(chalk.bold('Running Automation Tasks:\n'));
        tasks.forEach(task => console.log(formatTask(task, true)));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Start automation task (for Veritas to call)
program
  .command('automation:start <id>')
  .alias('as')
  .description('Start an automation task via Veritas sub-agent')
  .option('-s, --session <key>', 'Clawdbot session key')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      const result = await api<{ taskId: string; attemptId: string; title: string; description: string }>(`/api/automation/${task.id}/start`, {
        method: 'POST',
        body: JSON.stringify({ sessionKey: options.session }),
      });
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.green('✓ Automation started'));
        console.log(chalk.dim(`Task: ${result.title}`));
        console.log(chalk.dim(`Attempt: ${result.attemptId}`));
        if (result.description) {
          console.log(chalk.dim(`\nDescription:\n${result.description}`));
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Complete automation task
program
  .command('automation:complete <id>')
  .alias('ac')
  .description('Mark an automation task as complete')
  .option('-r, --result <text>', 'Result summary')
  .option('-f, --failed', 'Mark as failed instead of complete')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      const result = await api<{ taskId: string; status: string }>(`/api/automation/${task.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          result: options.result,
          status: options.failed ? 'failed' : 'complete',
        }),
      });
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.status === 'complete') {
          console.log(chalk.green('✓ Automation completed'));
        } else {
          console.log(chalk.yellow('✓ Automation marked as failed'));
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// === Notification Commands ===

// Send a notification
program
  .command('notify <message>')
  .description('Create a notification')
  .option('-t, --type <type>', 'Notification type (info, error, milestone, high_priority)', 'info')
  .option('--title <title>', 'Notification title')
  .option('--task <id>', 'Related task ID')
  .option('--json', 'Output as JSON')
  .action(async (message, options) => {
    try {
      const notification = await api<{ id: string; type: string; title: string }>('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          type: options.type,
          title: options.title || (options.type === 'error' ? 'Error' : options.type === 'milestone' ? 'Milestone' : 'Notification'),
          message,
          taskId: options.task,
        }),
      });
      
      if (options.json) {
        console.log(JSON.stringify(notification, null, 2));
      } else {
        console.log(chalk.green('✓ Notification created'));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Check for notifications
program
  .command('notify:check')
  .description('Check for tasks that need notifications')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const result = await api<{ checked: number; created: number }>('/api/notifications/check', {
        method: 'POST',
      });
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.dim(`Checked ${result.checked} tasks`));
        if (result.created > 0) {
          console.log(chalk.yellow(`Created ${result.created} new notifications`));
        } else {
          console.log(chalk.dim('No new notifications'));
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Get pending notifications
program
  .command('notify:pending')
  .description('Get pending notifications formatted for Teams')
  .option('--json', 'Output raw JSON')
  .option('--mark-sent', 'Mark notifications as sent after output')
  .action(async (options) => {
    try {
      const result = await api<{ count: number; messages: { id: string; type: string; text: string; timestamp: string }[] }>('/api/notifications/pending');
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.count === 0) {
        console.log(chalk.dim('No pending notifications'));
      } else {
        result.messages.forEach(msg => {
          console.log(msg.text);
          console.log(chalk.dim('─'.repeat(40)));
        });
      }
      
      if (options.markSent && result.count > 0) {
        const ids = result.messages.map(m => m.id);
        await api('/api/notifications/mark-sent', {
          method: 'POST',
          body: JSON.stringify({ ids }),
        });
        console.log(chalk.dim(`Marked ${ids.length} notifications as sent`));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// List all notifications
program
  .command('notify:list')
  .description('List all notifications')
  .option('-u, --unsent', 'Show only unsent notifications')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const url = options.unsent ? '/api/notifications?unsent=true' : '/api/notifications';
      const notifications = await api<{ id: string; type: string; title: string; message: string; sent: boolean; timestamp: string }[]>(url);
      
      if (options.json) {
        console.log(JSON.stringify(notifications, null, 2));
      } else if (notifications.length === 0) {
        console.log(chalk.dim('No notifications'));
      } else {
        const typeIcons: Record<string, string> = {
          agent_complete: '✅',
          agent_failed: '❌',
          needs_review: '👀',
          task_done: '🎉',
          high_priority: '🔴',
          error: '⚠️',
          milestone: '🏆',
          info: 'ℹ️',
        };
        
        notifications.forEach(n => {
          const icon = typeIcons[n.type] || '•';
          const sent = n.sent ? chalk.dim('[sent]') : chalk.yellow('[pending]');
          console.log(`${icon} ${chalk.bold(n.title)} ${sent}`);
          console.log(chalk.dim(`   ${n.message.slice(0, 60)}${n.message.length > 60 ? '...' : ''}`));
        });
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Clear notifications
program
  .command('notify:clear')
  .description('Clear all notifications')
  .action(async () => {
    try {
      await api('/api/notifications', { method: 'DELETE' });
      console.log(chalk.green('✓ Notifications cleared'));
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// === Memory Sync Commands ===

// Show summary
program
  .command('summary')
  .description('Show task summary')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const summary = await api<{
        total: number;
        byStatus: Record<string, number>;
        byProject: Record<string, { total: number; done: number; inProgress: number }>;
        highPriority: { id: string; title: string; status: string; project?: string }[];
      }>('/api/summary');
      
      if (options.json) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log(chalk.bold('\n📊 Veritas Kanban Summary\n'));
        
        console.log(chalk.dim('Status:'));
        console.log(`  To Do:       ${summary.byStatus.todo}`);
        console.log(`  In Progress: ${summary.byStatus['in-progress']}`);
        console.log(`  Review:      ${summary.byStatus.review}`);
        console.log(`  Done:        ${summary.byStatus.done}`);
        
        const projects = Object.entries(summary.byProject);
        if (projects.length > 0) {
          console.log(chalk.dim('\nProjects:'));
          projects.forEach(([name, stats]) => {
            const percent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
            console.log(`  ${name}: ${stats.done}/${stats.total} (${percent}%)`);
          });
        }
        
        if (summary.highPriority.length > 0) {
          console.log(chalk.red('\n🔴 High Priority:'));
          summary.highPriority.forEach(t => {
            console.log(`  ${t.title} [${t.status}]${t.project ? ` #${t.project}` : ''}`);
          });
        }
        
        console.log();
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Get memory-formatted summary
program
  .command('memory')
  .description('Get task summary formatted for memory files')
  .option('-h, --hours <n>', 'Hours to look back', '24')
  .option('-o, --output <file>', 'Append to file instead of stdout')
  .option('--json', 'Output recent tasks as JSON instead')
  .action(async (options) => {
    try {
      if (options.json) {
        const recent = await api<unknown>(`/api/summary/recent?hours=${options.hours}`);
        console.log(JSON.stringify(recent, null, 2));
      } else {
        const res = await fetch(`${API_BASE}/api/summary/memory?hours=${options.hours}`);
        const markdown = await res.text();
        
        if (options.output) {
          const fs = await import('fs/promises');
          const path = await import('path');
          
          // Expand ~ to home dir
          let outputPath = options.output;
          if (outputPath.startsWith('~')) {
            outputPath = path.join(process.env.HOME || '', outputPath.slice(1));
          }
          
          // Append to file
          await fs.appendFile(outputPath, '\n' + markdown);
          console.log(chalk.green(`✓ Appended to ${outputPath}`));
        } else {
          console.log(markdown);
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

program.parse();
