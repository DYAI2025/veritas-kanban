import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { getTaskService } from '../services/task-service.js';
import { getNotificationService, type NotificationType } from '../services/notification-service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { ValidationError } from '../middleware/error-handler.js';
import { authorize } from '../middleware/auth.js';

const router: RouterType = Router();
const taskService = getTaskService();
const notificationService = getNotificationService();

// Validation schemas
const createSchema = z.object({
  type: z.enum([
    'agent_complete',
    'agent_failed',
    'needs_review',
    'task_done',
    'high_priority',
    'error',
    'milestone',
    'info',
  ]),
  title: z.string(),
  message: z.string(),
  taskId: z.string().optional(),
});

const markSentSchema = z.object({
  ids: z.array(z.string()),
});

// POST /api/notifications - Create a notification
router.post(
  '/',
  authorize('admin', 'agent'),
  asyncHandler(async (req, res) => {
    let input;
    try {
      input = createSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation failed', error.errors);
      }
      throw error;
    }

    // Enrich with task info if taskId provided
    let taskTitle: string | undefined;
    let project: string | undefined;

    if (input.taskId) {
      const task = await taskService.getTask(input.taskId);
      if (task) {
        taskTitle = task.title;
        project = task.project;
      }
    }

    const notification = await notificationService.createNotification({
      type: input.type as NotificationType,
      title: input.title,
      message: input.message,
      taskId: input.taskId,
      taskTitle,
      project,
    });

    res.status(201).json(notification);
  })
);

// GET /api/notifications - List notifications
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const unsent = req.query.unsent === 'true';
    const notifications = await notificationService.getNotifications({ unsent });
    res.json(notifications);
  })
);

// GET /api/notifications/pending - Get unsent notifications formatted for Teams
router.get(
  '/pending',
  asyncHandler(async (_req, res) => {
    const result = await notificationService.getPendingForTeams();
    res.json(result);
  })
);

// POST /api/notifications/mark-sent - Mark notifications as sent
router.post(
  '/mark-sent',
  authorize('admin', 'agent'),
  asyncHandler(async (req, res) => {
    let ids;
    try {
      ({ ids } = markSentSchema.parse(req.body));
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation failed', error.errors);
      }
      throw error;
    }

    const marked = await notificationService.markAsSent(ids);
    res.json({ marked });
  })
);

// POST /api/notifications/check - Check for tasks that need notifications
router.post(
  '/check',
  authorize('admin', 'agent'),
  asyncHandler(async (_req, res) => {
    const tasks = await taskService.listTasks();
    const created = await notificationService.checkTasksForNotifications(tasks);
    res.json({ checked: tasks.length, created: created.length, notifications: created });
  })
);

// DELETE /api/notifications - Clear all notifications
router.delete(
  '/',
  authorize('admin'),
  asyncHandler(async (_req, res) => {
    await notificationService.clearNotifications();
    res.json({ cleared: true });
  })
);

export { router as notificationRoutes };
