import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import type { WebSocketServer, WebSocket } from 'ws';
import { asyncHandler } from '../middleware/async-handler.js';
import { ValidationError } from '../middleware/error-handler.js';
import { statusHistoryService, type AgentStatusState as HistoryStatusState } from '../services/status-history-service.js';

const router: RouterType = Router();

// Status states
export type AgentStatusState = 'idle' | 'working' | 'thinking' | 'sub-agent' | 'error';

export interface AgentStatus {
  status: AgentStatusState;
  activeTask?: {
    id: string;
    title?: string;
  };
  subAgentCount: number;
  lastUpdated: string;
  errorMessage?: string;
}

// In-memory state (single agent status)
let currentStatus: AgentStatus = {
  status: 'idle',
  subAgentCount: 0,
  lastUpdated: new Date().toISOString(),
};

// Timeout configuration (5 minutes default)
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
let idleTimeoutHandle: NodeJS.Timeout | null = null;

// WebSocket server reference for broadcasting
let wssRef: WebSocketServer | null = null;

/**
 * Initialize the agent status service with WebSocket server reference
 */
export function initAgentStatus(wss: WebSocketServer): void {
  wssRef = wss;
}

/**
 * Broadcast agent status change to all connected WebSocket clients
 */
function broadcastAgentStatusChange(): void {
  if (!wssRef) return;

  const message = {
    type: 'agent:status',
    ...currentStatus,
  };

  const payload = JSON.stringify(message);

  wssRef.clients.forEach((client: WebSocket) => {
    if (client.readyState === 1) { // WebSocket.OPEN = 1
      client.send(payload);
    }
  });
}

/**
 * Reset idle timeout - auto-resets to idle after 5 minutes of inactivity
 */
function resetIdleTimeout(): void {
  if (idleTimeoutHandle) {
    clearTimeout(idleTimeoutHandle);
    idleTimeoutHandle = null;
  }

  // Don't set timeout if already idle
  if (currentStatus.status === 'idle') return;

  idleTimeoutHandle = setTimeout(() => {
    currentStatus = {
      status: 'idle',
      subAgentCount: 0,
      lastUpdated: new Date().toISOString(),
    };
    broadcastAgentStatusChange();
    console.log('[AgentStatus] Auto-reset to idle after timeout');
  }, IDLE_TIMEOUT_MS);
}

/**
 * Update agent status programmatically (for internal use)
 */
export function updateAgentStatus(update: Partial<AgentStatus>): AgentStatus {
  const previousStatus = currentStatus.status;
  
  currentStatus = {
    ...currentStatus,
    ...update,
    lastUpdated: new Date().toISOString(),
  };
  
  // Log status change to history if status actually changed
  if (update.status !== undefined && update.status !== previousStatus) {
    statusHistoryService.logStatusChange(
      previousStatus as HistoryStatusState,
      update.status as HistoryStatusState,
      update.activeTask?.id || currentStatus.activeTask?.id,
      update.activeTask?.title || currentStatus.activeTask?.title,
      update.subAgentCount ?? currentStatus.subAgentCount
    ).catch(err => {
      console.error('[AgentStatus] Failed to log status change:', err);
    });
  }
  
  broadcastAgentStatusChange();
  resetIdleTimeout();
  
  return currentStatus;
}

/**
 * Get current agent status (for internal use)
 */
export function getAgentStatus(): AgentStatus {
  return { ...currentStatus };
}

// Validation schema for POST
const updateStatusSchema = z.object({
  status: z.enum(['idle', 'working', 'thinking', 'sub-agent', 'error']).optional(),
  activeTask: z.object({
    id: z.string(),
    title: z.string().optional(),
  }).optional().nullable(),
  subAgentCount: z.number().int().min(0).optional(),
  errorMessage: z.string().optional().nullable(),
});

// GET /api/agent/status - Get current agent status
router.get('/', asyncHandler(async (_req, res) => {
  res.json(currentStatus);
}));

// POST /api/agent/status - Update agent status
router.post('/', asyncHandler(async (req, res) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  
  if (!parsed.success) {
    throw new ValidationError('Invalid status update', parsed.error.format());
  }

  const update = parsed.data;

  // Build the update object
  const newStatus: Partial<AgentStatus> = {};

  if (update.status !== undefined) {
    newStatus.status = update.status;
  }

  if (update.activeTask !== undefined) {
    newStatus.activeTask = update.activeTask ?? undefined;
  }

  if (update.subAgentCount !== undefined) {
    newStatus.subAgentCount = update.subAgentCount;
  }

  if (update.errorMessage !== undefined) {
    newStatus.errorMessage = update.errorMessage ?? undefined;
  }

  // Clear activeTask and errorMessage when going idle
  if (update.status === 'idle') {
    newStatus.activeTask = undefined;
    newStatus.errorMessage = undefined;
  }

  const result = updateAgentStatus(newStatus);
  
  res.json(result);
}));

export { router as agentStatusRoutes };
