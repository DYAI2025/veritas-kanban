/**
 * WorkflowStepExecutor — Executes individual workflow steps
 * Phase 1: Core Engine (agent steps only, OpenClaw integration placeholder)
 */

import fs from 'fs/promises';
import path from 'path';
import sanitizeFilename from 'sanitize-filename';
import yaml from 'yaml';
import type {
  WorkflowStep,
  WorkflowRun,
  StepExecutionResult,
  WorkflowAgent,
  StepSessionConfig,
} from '../types/workflow.js';
import { getWorkflowRunsDir } from '../utils/paths.js';
import { createLogger } from '../lib/logger.js';
import { getToolPolicyService } from './tool-policy-service.js';

const log = createLogger('workflow-step-executor');

export class WorkflowStepExecutor {
  private runsDir: string;

  constructor(runsDir?: string) {
    this.runsDir = runsDir || getWorkflowRunsDir();
  }

  /**
   * Execute a single workflow step
   */
  async executeStep(step: WorkflowStep, run: WorkflowRun): Promise<StepExecutionResult> {
    log.info({ runId: run.id, stepId: step.id, type: step.type }, 'Executing step');

    switch (step.type) {
      case 'agent':
        return this.executeAgentStep(step, run);
      case 'loop':
        throw new Error('Loop steps not yet implemented (Phase 4)');
      case 'gate':
        throw new Error('Gate steps not yet implemented (Phase 4)');
      case 'parallel':
        throw new Error('Parallel steps not yet implemented (Phase 4)');
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute an agent step (spawns OpenClaw session)
   * Integrated features: #108 (progress), #110 (tool policies), #111 (session management)
   */
  private async executeAgentStep(
    step: WorkflowStep,
    run: WorkflowRun
  ): Promise<StepExecutionResult> {
    const agentDef = this.getAgentDefinition(run, step.agent!);
    const workflowConfig = run.context.workflow as
      | { config?: { fresh_session_default?: boolean } }
      | undefined;

    // Build session configuration (#111)
    const sessionConfig = this.buildSessionConfig(step, run, workflowConfig?.config);

    // Load progress file (#108)
    const progress = await this.loadProgressFile(run.id);

    // Build context based on session config (#111)
    const sessionContext = this.buildSessionContext(sessionConfig, run, progress);

    // Render the input prompt with context
    const prompt = this.renderTemplate(step.input || '', sessionContext);

    // Get tool policy filter for this agent role (#110)
    const toolPolicyFilter = await this.getToolPolicyForAgent(agentDef);

    log.info(
      {
        runId: run.id,
        stepId: step.id,
        agent: step.agent,
        role: agentDef?.role,
        sessionMode: sessionConfig.mode,
        sessionContext: sessionConfig.context,
        sessionCleanup: sessionConfig.cleanup,
        toolPolicy: toolPolicyFilter,
      },
      'Agent step execution configured'
    );

    // TODO: OpenClaw integration (sessions_spawn)
    // This is the placeholder for actual session spawning.
    // When OpenClaw sessions API is integrated, replace this with:
    //
    // if (sessionConfig.mode === 'reuse') {
    //   const lastSessionKey = run.context._sessions?.[step.agent!];
    //   if (lastSessionKey) {
    //     // Continue existing session
    //     const result = await this.continueSession(lastSessionKey, prompt);
    //   } else {
    //     // No existing session, fall back to fresh
    //     const sessionKey = await this.spawnAgent({
    //       agentId: step.agent!,
    //       prompt,
    //       taskId: run.taskId,
    //       model: agentDef?.model,
    //       toolFilter: toolPolicyFilter,
    //       timeout: sessionConfig.timeout,
    //     });
    //     run.context._sessions = { ...run.context._sessions, [step.agent!]: sessionKey };
    //   }
    // } else {
    //   // Fresh session
    //   const sessionKey = await this.spawnAgent({
    //     agentId: step.agent!,
    //     prompt,
    //     taskId: run.taskId,
    //     model: agentDef?.model,
    //     toolFilter: toolPolicyFilter,
    //     timeout: sessionConfig.timeout,
    //   });
    //   run.context._sessions = { ...run.context._sessions, [step.agent!]: sessionKey };
    // }
    // const result = await this.waitForSession(sessionKey);
    //
    // After session completes:
    // if (sessionConfig.cleanup === 'delete') {
    //   await this.cleanupSession(sessionKey);
    // }

    // Placeholder: Simulate agent execution (Phase 1 only)
    const result = `Agent ${step.agent} (role: ${agentDef?.role || 'unknown'}) executed step ${step.id}\n\nSession Config:\n- Mode: ${sessionConfig.mode}\n- Context: ${sessionConfig.context}\n- Cleanup: ${sessionConfig.cleanup}\n- Timeout: ${sessionConfig.timeout}s\n\nTool Policy:\n- Allowed: ${toolPolicyFilter.allowed?.join(', ') || 'all'}\n- Denied: ${toolPolicyFilter.denied?.join(', ') || 'none'}\n\nPrompt:\n${prompt}\n\nSTATUS: done\nOUTPUT: Placeholder result`;

    // Parse output
    const parsed = this.parseStepOutput(result, step);

    // Validate acceptance criteria
    await this.validateAcceptanceCriteria(step, result, parsed);

    // Write output to step-outputs/
    const outputPath = await this.saveStepOutput(run.id, step.id, result);

    // Append to progress file (#108)
    await this.appendProgressFile(run.id, step.id, result);

    return {
      output: parsed,
      outputPath,
    };
  }

  /**
   * Render a template string with context (simplified Jinja2-style)
   * Phase 1: Basic string interpolation
   */
  private renderTemplate(template: string, context: Record<string, unknown>): string {
    let rendered = template;

    // Simple {{variable}} substitution
    rendered = rendered.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const trimmedKey = key.trim();
      const value = this.getNestedValue(context, trimmedKey);
      return value !== undefined ? String(value) : `{{${trimmedKey}}}`;
    });

    return rendered;
  }

  /**
   * Get nested object value from dot notation (e.g., "task.title")
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Parse agent output into structured data for context passing
   */
  private parseStepOutput(rawOutput: string, step: WorkflowStep): unknown {
    if (!rawOutput) return rawOutput;

    const hintedFile = step.output?.file || '';
    const extension = path.extname(hintedFile).toLowerCase();

    try {
      if (extension === '.yml' || extension === '.yaml') {
        return yaml.parse(rawOutput);
      }

      if (extension === '.json') {
        return JSON.parse(rawOutput);
      }

      // Default: return as-is
      return rawOutput;
    } catch (err) {
      log.warn({ stepId: step.id, err }, 'Failed to parse step output as structured data');
      return rawOutput;
    }
  }

  /**
   * Save step output to disk
   */
  private async saveStepOutput(
    runId: string,
    stepId: string,
    output: unknown,
    filename?: string
  ): Promise<string> {
    // Sanitize runId to prevent path traversal (defensive — already validated upstream)
    const safeRunId = sanitizeFilename(runId);
    if (!safeRunId || safeRunId !== runId) {
      throw new Error(`Invalid run ID: ${runId}`);
    }

    const outputDir = path.join(this.runsDir, safeRunId, 'step-outputs');
    await fs.mkdir(outputDir, { recursive: true });

    const candidate = filename || `${stepId}.md`;
    const safeName = sanitizeFilename(candidate) || `${stepId}.md`;
    const outputPath = path.join(outputDir, safeName);

    const content = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    await fs.writeFile(outputPath, content, 'utf-8');

    log.info({ runId, stepId, outputPath }, 'Step output saved');
    return outputPath;
  }

  /**
   * Validate step output against acceptance criteria
   */
  private async validateAcceptanceCriteria(
    step: WorkflowStep,
    output: string,
    parsedOutput: unknown
  ): Promise<void> {
    if (!step.acceptance_criteria || step.acceptance_criteria.length === 0) {
      return; // No criteria to validate
    }

    for (const criterion of step.acceptance_criteria) {
      const passed = this.validateCriterion(criterion, output, parsedOutput);

      if (!passed) {
        throw new Error(`Acceptance criterion not met: "${criterion}"`);
      }
    }

    log.info(
      { stepId: step.id, criteria: step.acceptance_criteria.length },
      'All acceptance criteria passed'
    );
  }

  /**
   * Validate a single acceptance criterion (Phase 1: simple substring match)
   */
  private validateCriterion(criterion: string, rawOutput: string, _parsedOutput: unknown): boolean {
    // Phase 1: Simple substring match
    // Phase 4 will add regex, JSON Schema, custom functions
    return rawOutput.includes(criterion);
  }

  /**
   * Cleanup OpenClaw session (Phase 2 tracked in #110)
   */
  async cleanupSession(sessionKey: string): Promise<void> {
    log.info({ sessionKey }, 'Session cleanup (placeholder)');
    // Phase 2 (tracked in #110): Call OpenClaw session cleanup API
    // Will integrate with sessions API for proper resource cleanup
  }

  // ==================== Phase 2: Progress File Integration (#108) ====================

  /**
   * Load progress.md file for a workflow run
   * Returns content or null if file doesn't exist
   */
  private async loadProgressFile(runId: string): Promise<string | null> {
    // Sanitize runId to prevent path traversal (defensive — already validated upstream)
    const safeRunId = sanitizeFilename(runId);
    if (!safeRunId || safeRunId !== runId) {
      throw new Error(`Invalid run ID: ${runId}`);
    }

    const progressPath = path.join(this.runsDir, safeRunId, 'progress.md');

    try {
      const content = await fs.readFile(progressPath, 'utf-8');
      return content;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
        return null; // File doesn't exist yet
      }
      throw err;
    }
  }

  /**
   * Append step output to progress.md
   */
  private async appendProgressFile(runId: string, stepId: string, output: unknown): Promise<void> {
    // Sanitize runId to prevent path traversal (defensive — already validated upstream)
    const safeRunId = sanitizeFilename(runId);
    if (!safeRunId || safeRunId !== runId) {
      throw new Error(`Invalid run ID: ${runId}`);
    }

    const progressPath = path.join(this.runsDir, safeRunId, 'progress.md');
    const timestamp = new Date().toISOString();

    // Check progress file size before appending (cap at 10MB)
    const MAX_PROGRESS_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    try {
      const stats = await fs.stat(progressPath);
      if (stats.size > MAX_PROGRESS_FILE_SIZE) {
        log.warn(
          { runId, fileSize: stats.size },
          'Progress file exceeds size limit — skipping append'
        );
        return; // Skip appending if file is too large
      }
    } catch (err: unknown) {
      // File doesn't exist yet — that's fine
      if (!(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT')) {
        throw err;
      }
    }

    const entry = `## Step: ${stepId} (${timestamp})\n\n${typeof output === 'string' ? output : JSON.stringify(output, null, 2)}\n\n---\n\n`;

    await fs.appendFile(progressPath, entry, 'utf-8');

    log.info({ runId, stepId }, 'Progress file updated');
  }

  /**
   * Build steps context for template resolution
   * Enables {{steps.step-id.output}} references
   */
  private buildStepsContext(run: WorkflowRun): Record<string, unknown> {
    const stepsContext: Record<string, unknown> = {};

    for (const stepRun of run.steps) {
      if (stepRun.status === 'completed' && run.context[stepRun.stepId]) {
        stepsContext[stepRun.stepId] = {
          output: run.context[stepRun.stepId],
          status: stepRun.status,
          duration: stepRun.duration,
        };
      }
    }

    return stepsContext;
  }

  // ==================== Phase 2: Tool Policies & Session Management (#110, #111) ====================

  /**
   * Get agent definition from workflow context
   * Used to retrieve agent-specific settings (tools, model, etc.)
   */
  private getAgentDefinition(run: WorkflowRun, agentId: string): WorkflowAgent | null {
    // Agent definitions are stored in workflow context during run initialization
    const workflow = run.context.workflow as { agents?: WorkflowAgent[] } | undefined;
    if (!workflow?.agents) return null;

    return workflow.agents.find((a) => a.id === agentId) || null;
  }

  /**
   * Build session configuration for a step (#111)
   * Determines session mode, context passing, cleanup, and timeout
   */
  private buildSessionConfig(
    step: WorkflowStep,
    run: WorkflowRun,
    defaultConfig?: { fresh_session_default?: boolean }
  ): StepSessionConfig {
    // If step has explicit session config, use it
    if (step.session) {
      return {
        mode: step.session.mode || 'fresh',
        context: step.session.context || 'minimal',
        cleanup: step.session.cleanup || 'delete',
        timeout: step.session.timeout || step.timeout || 600,
        includeOutputsFrom: step.session.includeOutputsFrom,
      };
    }

    // Legacy: step.fresh_session boolean (backwards compatibility)
    if (step.fresh_session !== undefined) {
      return {
        mode: step.fresh_session ? 'fresh' : 'reuse',
        context: 'minimal',
        cleanup: 'delete',
        timeout: step.timeout || 600,
      };
    }

    // Use global workflow config default
    const freshSessionDefault = defaultConfig?.fresh_session_default ?? true;

    return {
      mode: freshSessionDefault ? 'fresh' : 'reuse',
      context: 'minimal',
      cleanup: 'delete',
      timeout: step.timeout || 600,
    };
  }

  /**
   * Build context for session injection (#111)
   * Filters context based on session.context mode
   */
  private buildSessionContext(
    sessionConfig: StepSessionConfig,
    run: WorkflowRun,
    progress: string | null
  ): Record<string, unknown> {
    const baseContext = {
      task: run.context.task,
      workflow: {
        id: run.workflowId,
        runId: run.id,
      },
    };

    switch (sessionConfig.context) {
      case 'minimal':
        // Only task and workflow metadata
        return {
          ...baseContext,
          progress: progress || '',
        };

      case 'full':
        // All previous step outputs + workflow variables
        return {
          ...run.context,
          progress: progress || '',
          steps: this.buildStepsContext(run),
        };

      case 'custom': {
        // Only specified steps' outputs
        const customContext: Record<string, unknown> = {
          ...baseContext,
          progress: progress || '',
        };

        if (sessionConfig.includeOutputsFrom) {
          const stepsContext: Record<string, unknown> = {};
          for (const stepId of sessionConfig.includeOutputsFrom) {
            if (run.context[stepId]) {
              stepsContext[stepId] = {
                output: run.context[stepId],
              };
            }
          }
          customContext.steps = stepsContext;
        }

        return customContext;
      }

      default:
        return baseContext;
    }
  }

  /**
   * Get tool policy filter for an agent role (#110)
   * Returns tool restrictions to pass to OpenClaw session spawn
   */
  private async getToolPolicyForAgent(agentDef: WorkflowAgent | null): Promise<{
    allowed?: string[];
    denied?: string[];
  }> {
    if (!agentDef || !agentDef.role) {
      // No agent definition or role — no restrictions
      return {};
    }

    const toolPolicyService = getToolPolicyService();
    return await toolPolicyService.getToolFilterForRole(agentDef.role);
  }
}
