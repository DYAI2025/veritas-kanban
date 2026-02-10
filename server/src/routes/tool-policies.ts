/**
 * Tool Policy API Routes
 * GitHub Issue: #110
 *
 * CRUD operations for role-based tool access policies.
 */

import express from 'express';
import { z } from 'zod';
import { getToolPolicyService } from '../services/tool-policy-service.js';
import { createLogger } from '../lib/logger.js';

const router = express.Router();
const log = createLogger('routes:tool-policies');
const toolPolicyService = getToolPolicyService();

// ==================== Validation Schemas ====================

const ToolPolicySchema = z.object({
  role: z.string().min(1).max(50),
  allowed: z.array(z.string()).max(100),
  denied: z.array(z.string()).max(100),
  description: z.string().max(500),
});

const RoleParamSchema = z.object({
  role: z.string().min(1),
});

// ==================== Helper: Async handler wrapper ====================

type AsyncHandler = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => Promise<void>;

function asyncHandler(fn: AsyncHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ==================== Routes ====================

/**
 * GET /api/tool-policies
 * List all tool policies
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const policies = await toolPolicyService.listPolicies();

    res.json({
      success: true,
      data: policies,
      meta: {
        timestamp: new Date().toISOString(),
        count: policies.length,
      },
    });
  })
);

/**
 * GET /api/tool-policies/:role
 * Get a specific tool policy by role
 */
router.get(
  '/:role',
  asyncHandler(async (req, res) => {
    const { role } = RoleParamSchema.parse(req.params);

    const policy = await toolPolicyService.getToolPolicy(role);

    if (!policy) {
      res.status(404).json({
        success: false,
        error: `Tool policy not found for role: ${role}`,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.json({
      success: true,
      data: policy,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * POST /api/tool-policies
 * Create a new custom tool policy
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const policy = ToolPolicySchema.parse(req.body);

    await toolPolicyService.savePolicy(policy);

    res.status(201).json({
      success: true,
      data: policy,
      meta: {
        timestamp: new Date().toISOString(),
        message: `Tool policy created for role: ${policy.role}`,
      },
    });
  })
);

/**
 * PUT /api/tool-policies/:role
 * Update an existing tool policy
 */
router.put(
  '/:role',
  asyncHandler(async (req, res) => {
    const { role } = RoleParamSchema.parse(req.params);
    const policyData = ToolPolicySchema.parse(req.body);

    // Ensure the role in the URL matches the role in the body
    if (policyData.role.toLowerCase() !== role.toLowerCase()) {
      res.status(400).json({
        success: false,
        error: 'Role in URL does not match role in request body',
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check if policy exists
    const existing = await toolPolicyService.getToolPolicy(role);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: `Tool policy not found for role: ${role}`,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    await toolPolicyService.savePolicy(policyData);

    res.json({
      success: true,
      data: policyData,
      meta: {
        timestamp: new Date().toISOString(),
        message: `Tool policy updated for role: ${role}`,
      },
    });
  })
);

/**
 * DELETE /api/tool-policies/:role
 * Delete a custom tool policy (cannot delete default policies)
 */
router.delete(
  '/:role',
  asyncHandler(async (req, res) => {
    const { role } = RoleParamSchema.parse(req.params);

    await toolPolicyService.deletePolicy(role);

    res.json({
      success: true,
      meta: {
        timestamp: new Date().toISOString(),
        message: `Tool policy deleted for role: ${role}`,
      },
    });
  })
);

/**
 * POST /api/tool-policies/:role/validate
 * Validate tool access for a specific role and tool
 */
router.post(
  '/:role/validate',
  asyncHandler(async (req, res) => {
    const { role } = RoleParamSchema.parse(req.params);
    const { tool } = z.object({ tool: z.string().min(1) }).parse(req.body);

    const allowed = await toolPolicyService.validateToolAccess(role, tool);

    res.json({
      success: true,
      data: {
        role,
        tool,
        allowed,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  })
);

// ==================== Error Handler ====================

router.use(
  (err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log.error({ err, path: req.path, method: req.method }, 'Tool policy route error');

    // Zod validation errors
    if (err instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: err.errors,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Validation errors from service
    if (err.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        error: err.message,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Generic errors
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
);

export default router;
