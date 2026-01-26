#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const API_BASE = process.env.VK_API_URL || 'http://localhost:3001';

// Task type definition
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
    decision?: string;
    decidedAt?: string;
    summary?: string;
  };
}

// API helper
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

// Tool input schemas
const ListTasksSchema = z.object({
  status: z.enum(['todo', 'in-progress', 'review', 'done']).optional(),
  type: z.enum(['code', 'research', 'content', 'automation']).optional(),
  project: z.string().optional(),
});

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['code', 'research', 'content', 'automation']).default('code'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  project: z.string().optional(),
});

const UpdateTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in-progress', 'review', 'done']).optional(),
  type: z.enum(['code', 'research', 'content', 'automation']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  project: z.string().optional(),
});

const TaskIdSchema = z.object({
  id: z.string().min(1),
});

const StartAgentSchema = z.object({
  id: z.string().min(1),
  agent: z.enum(['claude-code', 'amp', 'copilot', 'gemini', 'veritas']).default('claude-code'),
});

const StartAutomationSchema = z.object({
  id: z.string().min(1),
  sessionKey: z.string().optional(),
});

const CompleteAutomationSchema = z.object({
  id: z.string().min(1),
  result: z.string().optional(),
  failed: z.boolean().default(false),
});

// Create MCP server
const server = new Server(
  {
    name: 'veritas-kanban',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Find task by ID (supports partial matching)
async function findTask(id: string): Promise<Task | null> {
  const tasks = await api<Task[]>('/api/tasks');
  return tasks.find(t => t.id === id || t.id.endsWith(id)) || null;
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_tasks',
        description: 'List all tasks in Veritas Kanban. Can filter by status, type, or project.',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['todo', 'in-progress', 'review', 'done'],
              description: 'Filter by task status',
            },
            type: {
              type: 'string',
              enum: ['code', 'research', 'content', 'automation'],
              description: 'Filter by task type',
            },
            project: {
              type: 'string',
              description: 'Filter by project name',
            },
          },
        },
      },
      {
        name: 'get_task',
        description: 'Get details of a specific task by ID (supports partial ID matching)',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID or partial ID (last 6+ characters)',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'create_task',
        description: 'Create a new task in Veritas Kanban',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Task title',
            },
            description: {
              type: 'string',
              description: 'Task description',
            },
            type: {
              type: 'string',
              enum: ['code', 'research', 'content', 'automation'],
              description: 'Task type (default: code)',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Task priority (default: medium)',
            },
            project: {
              type: 'string',
              description: 'Project name',
            },
          },
          required: ['title'],
        },
      },
      {
        name: 'update_task',
        description: 'Update an existing task',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID or partial ID',
            },
            title: {
              type: 'string',
              description: 'New title',
            },
            description: {
              type: 'string',
              description: 'New description',
            },
            status: {
              type: 'string',
              enum: ['todo', 'in-progress', 'review', 'done'],
              description: 'New status',
            },
            type: {
              type: 'string',
              enum: ['code', 'research', 'content', 'automation'],
              description: 'New type',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'New priority',
            },
            project: {
              type: 'string',
              description: 'New project',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'start_agent',
        description: 'Start an AI coding agent on a code task (requires worktree)',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID or partial ID',
            },
            agent: {
              type: 'string',
              enum: ['claude-code', 'amp', 'copilot', 'gemini'],
              description: 'Agent to use (default: claude-code)',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'stop_agent',
        description: 'Stop a running agent on a task',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID or partial ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'archive_task',
        description: 'Archive a completed task',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID or partial ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_task',
        description: 'Delete a task permanently',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID or partial ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'list_pending_automation',
        description: 'List automation tasks waiting to be executed by Veritas',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_running_automation',
        description: 'List automation tasks currently being executed',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'start_automation',
        description: 'Start an automation task via Veritas sub-agent',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID or partial ID',
            },
            sessionKey: {
              type: 'string',
              description: 'Clawdbot session key (optional)',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'complete_automation',
        description: 'Mark an automation task as complete or failed',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID or partial ID',
            },
            result: {
              type: 'string',
              description: 'Result summary',
            },
            failed: {
              type: 'boolean',
              description: 'Mark as failed instead of complete',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_summary',
        description: 'Get overall kanban summary (status counts, projects, high-priority)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_memory_summary',
        description: 'Get task summary formatted for memory files (completed tasks, active high-priority, project progress)',
        inputSchema: {
          type: 'object',
          properties: {
            hours: {
              type: 'number',
              description: 'Hours to look back (default: 24)',
            },
          },
        },
      },
      {
        name: 'create_notification',
        description: 'Create a notification (for Teams delivery)',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['info', 'error', 'milestone', 'high_priority', 'agent_complete', 'agent_failed', 'needs_review', 'task_done'],
              description: 'Notification type',
            },
            title: {
              type: 'string',
              description: 'Notification title',
            },
            message: {
              type: 'string',
              description: 'Notification message',
            },
            taskId: {
              type: 'string',
              description: 'Related task ID (optional)',
            },
          },
          required: ['type', 'title', 'message'],
        },
      },
      {
        name: 'get_pending_notifications',
        description: 'Get pending notifications formatted for Teams',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'check_notifications',
        description: 'Check for tasks that need notifications (review ready, agent failed, etc.)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_tasks': {
        const params = ListTasksSchema.parse(args || {});
        let tasks = await api<Task[]>('/api/tasks');

        if (params.status) {
          tasks = tasks.filter(t => t.status === params.status);
        }
        if (params.type) {
          tasks = tasks.filter(t => t.type === params.type);
        }
        if (params.project) {
          tasks = tasks.filter(t => t.project === params.project);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasks, null, 2),
            },
          ],
        };
      }

      case 'get_task': {
        const { id } = TaskIdSchema.parse(args);
        const task = await findTask(id);

        if (!task) {
          return {
            content: [{ type: 'text', text: `Task not found: ${id}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
        };
      }

      case 'create_task': {
        const params = CreateTaskSchema.parse(args);
        const task = await api<Task>('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(params),
        });

        return {
          content: [
            {
              type: 'text',
              text: `Task created: ${task.id}\n${JSON.stringify(task, null, 2)}`,
            },
          ],
        };
      }

      case 'update_task': {
        const { id, ...updates } = UpdateTaskSchema.parse(args);
        const task = await findTask(id);

        if (!task) {
          return {
            content: [{ type: 'text', text: `Task not found: ${id}` }],
            isError: true,
          };
        }

        const updated = await api<Task>(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });

        return {
          content: [
            {
              type: 'text',
              text: `Task updated: ${updated.id}\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        };
      }

      case 'start_agent': {
        const { id, agent } = StartAgentSchema.parse(args);
        const task = await findTask(id);

        if (!task) {
          return {
            content: [{ type: 'text', text: `Task not found: ${id}` }],
            isError: true,
          };
        }

        if (task.type !== 'code') {
          return {
            content: [{ type: 'text', text: 'Can only start agents on code tasks' }],
            isError: true,
          };
        }

        if (!task.git?.worktreePath) {
          return {
            content: [{ type: 'text', text: 'Task needs a worktree first' }],
            isError: true,
          };
        }

        const result = await api<{ attemptId: string }>(`/api/agents/${task.id}/start`, {
          method: 'POST',
          body: JSON.stringify({ agent }),
        });

        return {
          content: [
            {
              type: 'text',
              text: `Agent started: ${agent}\nAttempt ID: ${result.attemptId}\nWorking in: ${task.git.worktreePath}`,
            },
          ],
        };
      }

      case 'stop_agent': {
        const { id } = TaskIdSchema.parse(args);
        const task = await findTask(id);

        if (!task) {
          return {
            content: [{ type: 'text', text: `Task not found: ${id}` }],
            isError: true,
          };
        }

        await api(`/api/agents/${task.id}/stop`, { method: 'POST' });

        return {
          content: [{ type: 'text', text: 'Agent stopped' }],
        };
      }

      case 'archive_task': {
        const { id } = TaskIdSchema.parse(args);
        const task = await findTask(id);

        if (!task) {
          return {
            content: [{ type: 'text', text: `Task not found: ${id}` }],
            isError: true,
          };
        }

        await api(`/api/tasks/${task.id}/archive`, { method: 'POST' });

        return {
          content: [{ type: 'text', text: `Task archived: ${task.id}` }],
        };
      }

      case 'delete_task': {
        const { id } = TaskIdSchema.parse(args);
        const task = await findTask(id);

        if (!task) {
          return {
            content: [{ type: 'text', text: `Task not found: ${id}` }],
            isError: true,
          };
        }

        await api(`/api/tasks/${task.id}`, { method: 'DELETE' });

        return {
          content: [{ type: 'text', text: `Task deleted: ${task.id}` }],
        };
      }

      case 'list_pending_automation': {
        const tasks = await api<Task[]>('/api/automation/pending');
        return {
          content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
        };
      }

      case 'list_running_automation': {
        const tasks = await api<Task[]>('/api/automation/running');
        return {
          content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
        };
      }

      case 'start_automation': {
        const { id, sessionKey } = StartAutomationSchema.parse(args);
        const task = await findTask(id);

        if (!task) {
          return {
            content: [{ type: 'text', text: `Task not found: ${id}` }],
            isError: true,
          };
        }

        const result = await api<{ taskId: string; attemptId: string; title: string; description: string }>(
          `/api/automation/${task.id}/start`,
          {
            method: 'POST',
            body: JSON.stringify({ sessionKey }),
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: `Automation started\nTask: ${result.title}\nAttempt: ${result.attemptId}\n\nDescription:\n${result.description}`,
            },
          ],
        };
      }

      case 'complete_automation': {
        const { id, result, failed } = CompleteAutomationSchema.parse(args);
        const task = await findTask(id);

        if (!task) {
          return {
            content: [{ type: 'text', text: `Task not found: ${id}` }],
            isError: true,
          };
        }

        const response = await api<{ taskId: string; status: string }>(
          `/api/automation/${task.id}/complete`,
          {
            method: 'POST',
            body: JSON.stringify({ result, status: failed ? 'failed' : 'complete' }),
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: `Automation ${response.status === 'complete' ? 'completed' : 'marked as failed'}: ${task.id}`,
            },
          ],
        };
      }

      case 'get_summary': {
        const summary = await api<unknown>('/api/summary');
        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        };
      }

      case 'get_memory_summary': {
        const hours = (args as { hours?: number })?.hours || 24;
        const res = await fetch(`${API_BASE}/api/summary/memory?hours=${hours}`);
        const markdown = await res.text();
        return {
          content: [{ type: 'text', text: markdown }],
        };
      }

      case 'create_notification': {
        const { type, title, message, taskId } = args as { type: string; title: string; message: string; taskId?: string };
        const notification = await api<{ id: string }>('/api/notifications', {
          method: 'POST',
          body: JSON.stringify({ type, title, message, taskId }),
        });
        return {
          content: [{ type: 'text', text: `Notification created: ${notification.id}` }],
        };
      }

      case 'get_pending_notifications': {
        const result = await api<{ count: number; messages: { text: string }[] }>('/api/notifications/pending');
        if (result.count === 0) {
          return {
            content: [{ type: 'text', text: 'No pending notifications' }],
          };
        }
        return {
          content: [{ type: 'text', text: result.messages.map(m => m.text).join('\n\n---\n\n') }],
        };
      }

      case 'check_notifications': {
        const result = await api<{ checked: number; created: number; notifications: { title: string }[] }>('/api/notifications/check', {
          method: 'POST',
        });
        let text = `Checked ${result.checked} tasks. Created ${result.created} new notifications.`;
        if (result.notifications.length > 0) {
          text += '\n\nNew notifications:\n' + result.notifications.map(n => `- ${n.title}`).join('\n');
        }
        return {
          content: [{ type: 'text', text }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const tasks = await api<Task[]>('/api/tasks');

  return {
    resources: [
      {
        uri: 'kanban://tasks',
        name: 'All Tasks',
        description: 'List of all tasks in Veritas Kanban',
        mimeType: 'application/json',
      },
      {
        uri: 'kanban://tasks/active',
        name: 'Active Tasks',
        description: 'Tasks that are in-progress or in review',
        mimeType: 'application/json',
      },
      ...tasks.map(task => ({
        uri: `kanban://task/${task.id}`,
        name: task.title,
        description: `${task.type} task - ${task.status} - ${task.project || 'no project'}`,
        mimeType: 'application/json',
      })),
    ],
  };
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'kanban://tasks') {
    const tasks = await api<Task[]>('/api/tasks');
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(tasks, null, 2),
        },
      ],
    };
  }

  if (uri === 'kanban://tasks/active') {
    const tasks = await api<Task[]>('/api/tasks');
    const active = tasks.filter(t => t.status === 'in-progress' || t.status === 'review');
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(active, null, 2),
        },
      ],
    };
  }

  if (uri.startsWith('kanban://task/')) {
    const id = uri.replace('kanban://task/', '');
    const task = await findTask(id);

    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(task, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Veritas Kanban MCP server running on stdio');
}

main().catch(console.error);
