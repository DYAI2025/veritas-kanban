import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { TaskService } from '../services/task-service.js';
import fs from 'fs/promises';
import path from 'path';

const router: RouterType = Router();
const taskService = new TaskService();

const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const NOTIFICATIONS_FILE = path.join(PROJECT_ROOT, '.veritas-kanban', 'notifications.json');

interface Notification {
  id: string;
  type: 'agent_complete' | 'agent_failed' | 'needs_review' | 'task_done' | 'high_priority' | 'error' | 'milestone' | 'info';
  title: string;
  message: string;
  taskId?: string;
  taskTitle?: string;
  project?: string;
  timestamp: string;
  sent: boolean;
}

async function loadNotifications(): Promise<Notification[]> {
  try {
    const data = await fs.readFile(NOTIFICATIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveNotifications(notifications: Notification[]): Promise<void> {
  await fs.mkdir(path.dirname(NOTIFICATIONS_FILE), { recursive: true });
  await fs.writeFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
}

async function addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'sent'>): Promise<Notification> {
  const notifications = await loadNotifications();
  const newNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    sent: false,
  };
  notifications.push(newNotification);
  
  // Keep only last 100 notifications
  if (notifications.length > 100) {
    notifications.splice(0, notifications.length - 100);
  }
  
  await saveNotifications(notifications);
  return newNotification;
}

// Notification type icons
const typeIcons: Record<Notification['type'], string> = {
  agent_complete: '✅',
  agent_failed: '❌',
  needs_review: '👀',
  task_done: '🎉',
  high_priority: '🔴',
  error: '⚠️',
  milestone: '🏆',
  info: 'ℹ️',
};

// POST /api/notifications - Create a notification
const createSchema = z.object({
  type: z.enum(['agent_complete', 'agent_failed', 'needs_review', 'task_done', 'high_priority', 'error', 'milestone', 'info']),
  title: z.string(),
  message: z.string(),
  taskId: z.string().optional(),
});

router.post('/', async (req, res) => {
  try {
    const input = createSchema.parse(req.body);
    
    let taskTitle: string | undefined;
    let project: string | undefined;
    
    if (input.taskId) {
      const task = await taskService.getTask(input.taskId);
      if (task) {
        taskTitle = task.title;
        project = task.project;
      }
    }
    
    const notification = await addNotification({
      type: input.type,
      title: input.title,
      message: input.message,
      taskId: input.taskId,
      taskTitle,
      project,
    });
    
    res.status(201).json(notification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// GET /api/notifications - List notifications
router.get('/', async (req, res) => {
  try {
    const unsent = req.query.unsent === 'true';
    let notifications = await loadNotifications();
    
    if (unsent) {
      notifications = notifications.filter(n => !n.sent);
    }
    
    // Most recent first
    notifications.reverse();
    
    res.json(notifications);
  } catch (error) {
    console.error('Error listing notifications:', error);
    res.status(500).json({ error: 'Failed to list notifications' });
  }
});

// GET /api/notifications/pending - Get unsent notifications formatted for Teams
router.get('/pending', async (_req, res) => {
  try {
    const notifications = await loadNotifications();
    const unsent = notifications.filter(n => !n.sent);
    
    if (unsent.length === 0) {
      return res.json({ count: 0, messages: [] });
    }
    
    // Format for Teams
    const messages = unsent.map(n => {
      const icon = typeIcons[n.type];
      let text = `${icon} **${n.title}**\n${n.message}`;
      
      if (n.taskTitle) {
        text += `\n\n📋 Task: ${n.taskTitle}`;
        if (n.project) text += ` (#${n.project})`;
        text += `\n🔗 \`vk show ${n.taskId?.slice(-8)}\``;
      }
      
      return {
        id: n.id,
        type: n.type,
        text,
        timestamp: n.timestamp,
      };
    });
    
    res.json({ count: unsent.length, messages });
  } catch (error) {
    console.error('Error getting pending notifications:', error);
    res.status(500).json({ error: 'Failed to get pending notifications' });
  }
});

// POST /api/notifications/mark-sent - Mark notifications as sent
const markSentSchema = z.object({
  ids: z.array(z.string()),
});

router.post('/mark-sent', async (req, res) => {
  try {
    const { ids } = markSentSchema.parse(req.body);
    const notifications = await loadNotifications();
    
    let marked = 0;
    notifications.forEach(n => {
      if (ids.includes(n.id)) {
        n.sent = true;
        marked++;
      }
    });
    
    await saveNotifications(notifications);
    res.json({ marked });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error marking notifications sent:', error);
    res.status(500).json({ error: 'Failed to mark notifications sent' });
  }
});

// POST /api/notifications/check - Check for tasks that need notifications
router.post('/check', async (_req, res) => {
  try {
    const tasks = await taskService.listTasks();
    const created: Notification[] = [];
    
    // Check for tasks in review (needs review notification)
    const inReview = tasks.filter(t => 
      t.status === 'review' && 
      t.attempt?.status === 'complete' &&
      t.attempt?.agent !== 'veritas'
    );
    
    for (const task of inReview) {
      // Check if we already notified about this
      const existing = await loadNotifications();
      const alreadyNotified = existing.some(n => 
        n.taskId === task.id && 
        n.type === 'needs_review' &&
        new Date(n.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Within 24h
      );
      
      if (!alreadyNotified) {
        const notification = await addNotification({
          type: 'needs_review',
          title: 'Code Ready for Review',
          message: `Agent completed work on "${task.title}". Please review the changes.`,
          taskId: task.id,
          taskTitle: task.title,
          project: task.project,
        });
        created.push(notification);
      }
    }
    
    // Check for failed agent attempts
    const failed = tasks.filter(t =>
      t.attempt?.status === 'failed' &&
      t.status !== 'done'
    );
    
    for (const task of failed) {
      const existing = await loadNotifications();
      const alreadyNotified = existing.some(n =>
        n.taskId === task.id &&
        n.type === 'agent_failed' &&
        new Date(n.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      
      if (!alreadyNotified) {
        const notification = await addNotification({
          type: 'agent_failed',
          title: 'Agent Failed',
          message: `${task.attempt?.agent} failed on "${task.title}". May need manual intervention.`,
          taskId: task.id,
          taskTitle: task.title,
          project: task.project,
        });
        created.push(notification);
      }
    }
    
    res.json({ checked: tasks.length, created: created.length, notifications: created });
  } catch (error) {
    console.error('Error checking for notifications:', error);
    res.status(500).json({ error: 'Failed to check for notifications' });
  }
});

// DELETE /api/notifications - Clear all notifications
router.delete('/', async (_req, res) => {
  try {
    await saveNotifications([]);
    res.json({ cleared: true });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

export { router as notificationRoutes };
