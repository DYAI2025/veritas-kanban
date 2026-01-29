import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { ConfigService } from '../services/config-service.js';
import type { RepoConfig, AgentConfig, AgentType } from '@veritas-kanban/shared';

const router: RouterType = Router();
const configService = new ConfigService();

// Validation schemas
const repoSchema = z.object({
  name: z.string().min(1).max(50),
  path: z.string().min(1),
  defaultBranch: z.string().min(1).default('main'),
});

const agentSchema = z.object({
  type: z.enum(['claude-code', 'amp', 'copilot', 'gemini']),
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()),
  enabled: z.boolean(),
});

const setDefaultAgentSchema = z.object({
  agent: z.enum(['claude-code', 'amp', 'copilot', 'gemini'], {
    required_error: 'Agent type is required',
    invalid_type_error: 'Agent type is required',
  }),
});

const validateRepoPathSchema = z.object({
  path: z.string().min(1, 'Path is required'),
});

// GET /api/config - Get full config
router.get('/', async (_req, res) => {
  try {
    const config = await configService.getConfig();
    res.json(config);
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

// GET /api/config/repos - List repos
router.get('/repos', async (_req, res) => {
  try {
    const config = await configService.getConfig();
    res.json(config.repos);
  } catch (error) {
    console.error('Error listing repos:', error);
    res.status(500).json({ error: 'Failed to list repos' });
  }
});

// POST /api/config/repos - Add repo
router.post('/repos', async (req, res) => {
  try {
    const repo = repoSchema.parse(req.body) as RepoConfig;
    const config = await configService.addRepo(repo);
    res.status(201).json(config);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error adding repo:', error);
    res.status(400).json({ error: error.message || 'Failed to add repo' });
  }
});

// PATCH /api/config/repos/:name - Update repo
router.patch('/repos/:name', async (req, res) => {
  try {
    const updates = repoSchema.partial().parse(req.body);
    const config = await configService.updateRepo(req.params.name, updates);
    res.json(config);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error updating repo:', error);
    res.status(400).json({ error: error.message || 'Failed to update repo' });
  }
});

// DELETE /api/config/repos/:name - Remove repo
router.delete('/repos/:name', async (req, res) => {
  try {
    const config = await configService.removeRepo(req.params.name);
    res.json(config);
  } catch (error: any) {
    console.error('Error removing repo:', error);
    res.status(400).json({ error: error.message || 'Failed to remove repo' });
  }
});

// POST /api/config/repos/validate - Validate repo path
router.post('/repos/validate', async (req, res) => {
  try {
    const { path } = validateRepoPathSchema.parse(req.body);
    const result = await configService.validateRepoPath(path);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(400).json({ error: error.message, valid: false });
  }
});

// GET /api/config/repos/:name/branches - Get repo branches
router.get('/repos/:name/branches', async (req, res) => {
  try {
    const branches = await configService.getRepoBranches(req.params.name);
    res.json(branches);
  } catch (error: any) {
    console.error('Error getting branches:', error);
    res.status(400).json({ error: error.message || 'Failed to get branches' });
  }
});

// GET /api/config/agents - List agents
router.get('/agents', async (_req, res) => {
  try {
    const config = await configService.getConfig();
    res.json(config.agents);
  } catch (error) {
    console.error('Error listing agents:', error);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

// PUT /api/config/agents - Update all agents
router.put('/agents', async (req, res) => {
  try {
    const agents = z.array(agentSchema).parse(req.body) as AgentConfig[];
    const config = await configService.updateAgents(agents);
    res.json(config);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error updating agents:', error);
    res.status(500).json({ error: 'Failed to update agents' });
  }
});

// PUT /api/config/default-agent - Set default agent
router.put('/default-agent', async (req, res) => {
  try {
    const { agent } = setDefaultAgentSchema.parse(req.body);
    const config = await configService.setDefaultAgent(agent as AgentType);
    res.json(config);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error setting default agent:', error);
    res.status(500).json({ error: 'Failed to set default agent' });
  }
});

export { router as configRoutes };
