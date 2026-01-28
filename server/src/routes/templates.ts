import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { TemplateService } from '../services/template-service.js';

const router: RouterType = Router();
const templateService = new TemplateService();

// Validation schemas
const subtaskTemplateSchema = z.object({
  title: z.string(),
  order: z.number(),
});

const blueprintTaskSchema = z.object({
  refId: z.string(),
  title: z.string(),
  taskDefaults: z.object({
    type: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    project: z.string().optional(),
    descriptionTemplate: z.string().optional(),
    agent: z.enum(['claude-code', 'amp', 'copilot', 'gemini', 'veritas']).optional(),
  }),
  subtaskTemplates: z.array(subtaskTemplateSchema).optional(),
  blockedByRefs: z.array(z.string()).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  taskDefaults: z.object({
    type: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    project: z.string().optional(),
    descriptionTemplate: z.string().optional(),
    agent: z.enum(['claude-code', 'amp', 'copilot', 'gemini', 'veritas']).optional(),
  }),
  subtaskTemplates: z.array(subtaskTemplateSchema).optional(),
  blueprint: z.array(blueprintTaskSchema).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  taskDefaults: z.object({
    type: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    project: z.string().optional(),
    descriptionTemplate: z.string().optional(),
    agent: z.enum(['claude-code', 'amp', 'copilot', 'gemini', 'veritas']).optional(),
  }).optional(),
  subtaskTemplates: z.array(subtaskTemplateSchema).optional(),
  blueprint: z.array(blueprintTaskSchema).optional(),
});

// GET /api/templates - List all templates
router.get('/', async (_req, res) => {
  try {
    const templates = await templateService.getTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

// GET /api/templates/:id - Get single template
router.get('/:id', async (req, res) => {
  try {
    const template = await templateService.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

// POST /api/templates - Create template
router.post('/', async (req, res) => {
  try {
    const input = createTemplateSchema.parse(req.body);
    const template = await templateService.createTemplate(input);
    res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PATCH /api/templates/:id - Update template
router.patch('/:id', async (req, res) => {
  try {
    const input = updateTemplateSchema.parse(req.body);
    const template = await templateService.updateTemplate(req.params.id, input);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await templateService.deleteTemplate(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
