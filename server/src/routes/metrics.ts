import { Router, type Router as RouterType } from 'express';
import { getMetricsService, type MetricsPeriod } from '../services/metrics-service.js';

const router: RouterType = Router();

/**
 * GET /api/metrics/tasks
 * Get task counts by status
 * 
 * Query params:
 *   - project: Filter by project
 */
router.get('/tasks', async (req, res, next) => {
  try {
    const metrics = getMetricsService();
    const project = req.query.project as string | undefined;
    const result = await metrics.getTaskMetrics(project);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/metrics/runs
 * Get run metrics (error rate, success rate)
 * 
 * Query params:
 *   - period: '24h' | '7d' (default: '24h')
 *   - project: Filter by project
 */
router.get('/runs', async (req, res, next) => {
  try {
    const metrics = getMetricsService();
    const period = (req.query.period as MetricsPeriod) || '24h';
    const project = req.query.project as string | undefined;
    
    if (period !== '24h' && period !== '7d') {
      return res.status(400).json({ error: 'period must be "24h" or "7d"' });
    }
    
    const result = await metrics.getRunMetrics(period, project);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/metrics/tokens
 * Get token usage metrics
 * 
 * Query params:
 *   - period: '24h' | '7d' (default: '24h')
 *   - project: Filter by project
 */
router.get('/tokens', async (req, res, next) => {
  try {
    const metrics = getMetricsService();
    const period = (req.query.period as MetricsPeriod) || '24h';
    const project = req.query.project as string | undefined;
    
    if (period !== '24h' && period !== '7d') {
      return res.status(400).json({ error: 'period must be "24h" or "7d"' });
    }
    
    const result = await metrics.getTokenMetrics(period, project);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/metrics/duration
 * Get run duration metrics
 * 
 * Query params:
 *   - period: '24h' | '7d' (default: '24h')
 *   - project: Filter by project
 */
router.get('/duration', async (req, res, next) => {
  try {
    const metrics = getMetricsService();
    const period = (req.query.period as MetricsPeriod) || '24h';
    const project = req.query.project as string | undefined;
    
    if (period !== '24h' && period !== '7d') {
      return res.status(400).json({ error: 'period must be "24h" or "7d"' });
    }
    
    const result = await metrics.getDurationMetrics(period, project);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/metrics/all
 * Get all metrics in one call (for dashboard)
 * 
 * Query params:
 *   - period: '24h' | '7d' (default: '24h')
 *   - project: Filter by project
 */
router.get('/all', async (req, res, next) => {
  try {
    const metrics = getMetricsService();
    const period = (req.query.period as MetricsPeriod) || '24h';
    const project = req.query.project as string | undefined;
    
    if (period !== '24h' && period !== '7d') {
      return res.status(400).json({ error: 'period must be "24h" or "7d"' });
    }
    
    const result = await metrics.getAllMetrics(period, project);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
