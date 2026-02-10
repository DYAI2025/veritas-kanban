/**
 * ToolPolicyService — Role-based tool access policies for agents
 * GitHub Issue: #110
 *
 * Defines which tools each agent role can access. When a workflow step
 * specifies a role, that role's tool policy is applied to the agent session.
 */

import fs from 'fs/promises';
import path from 'path';
import type { ToolPolicy } from '../types/workflow.js';
import { ValidationError } from '../types/workflow.js';
import { getToolPoliciesDir } from '../utils/paths.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('tool-policy-service');

// Default policies (cannot be deleted)
const DEFAULT_ROLES = new Set(['planner', 'developer', 'reviewer', 'tester', 'deployer']);

// Validation limits
const MAX_POLICIES = 50;
const MAX_TOOLS_PER_POLICY = 100;
const MAX_ROLE_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Default tool policies for standard roles
 */
const DEFAULT_POLICIES: ToolPolicy[] = [
  {
    role: 'planner',
    allowed: ['Read', 'web_search', 'web_fetch', 'browser', 'image', 'nodes'],
    denied: ['Write', 'Edit', 'exec', 'message'],
    description:
      'Read-only access for planning and analysis. Can search and browse, but cannot modify files or execute commands.',
  },
  {
    role: 'developer',
    allowed: ['*'], // Full access
    denied: [],
    description:
      'Full access to all tools. Can read, write, execute commands, and use all available capabilities.',
  },
  {
    role: 'reviewer',
    allowed: ['Read', 'exec', 'web_search', 'web_fetch', 'browser', 'image', 'nodes'],
    denied: ['Write', 'Edit', 'message'],
    description:
      'Read and execute access for code review. Can run tests and checks, but cannot modify the code being reviewed.',
  },
  {
    role: 'tester',
    allowed: ['Read', 'exec', 'browser', 'web_search', 'web_fetch', 'image', 'nodes'],
    denied: ['Write', 'Edit', 'message'],
    description:
      'Read, execute, and browser access for testing. Can run tests and interact with UIs, but cannot modify source code.',
  },
  {
    role: 'deployer',
    allowed: ['*'], // Full access (needed for deployment operations)
    denied: [],
    description:
      'Full access for deployment operations. Can execute deployment scripts, modify configs, and interact with production systems.',
  },
];

export class ToolPolicyService {
  private policiesDir: string;
  private cache: Map<string, ToolPolicy> = new Map();

  constructor(policiesDir?: string) {
    this.policiesDir = policiesDir || getToolPoliciesDir();
    this.ensureDirectories();
    this.loadDefaults();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.policiesDir, { recursive: true });
  }

  /**
   * Load default policies into cache
   */
  private async loadDefaults(): Promise<void> {
    for (const policy of DEFAULT_POLICIES) {
      this.cache.set(policy.role, policy);

      // Persist default policies to disk if they don't exist
      const filePath = path.join(this.policiesDir, `${policy.role}.json`);
      try {
        await fs.access(filePath);
      } catch {
        // File doesn't exist, create it
        await fs.writeFile(filePath, JSON.stringify(policy, null, 2), 'utf-8');
        log.info({ role: policy.role }, 'Created default policy file');
      }
    }
  }

  /**
   * Get policy for a specific role
   */
  async getToolPolicy(role: string): Promise<ToolPolicy | null> {
    const normalizedRole = role.trim().toLowerCase();

    // Check cache first
    if (this.cache.has(normalizedRole)) {
      const cachedPolicy = this.cache.get(normalizedRole);
      if (cachedPolicy) return cachedPolicy;
    }

    // Try loading from disk
    const filePath = path.join(this.policiesDir, `${normalizedRole}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const policy = JSON.parse(content) as ToolPolicy;

      this.validatePolicy(policy);

      // Cache it
      this.cache.set(normalizedRole, policy);

      log.info({ role: normalizedRole }, 'Tool policy loaded');
      return policy;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
        log.debug({ role: normalizedRole }, 'Tool policy not found');
        return null;
      }
      log.error({ role: normalizedRole, err }, 'Failed to load tool policy');
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new ValidationError(`Invalid tool policy: ${message}`);
    }
  }

  /**
   * List all tool policies
   */
  async listPolicies(): Promise<ToolPolicy[]> {
    const files = await fs.readdir(this.policiesDir).catch(() => []);
    const policies: ToolPolicy[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const role = file.replace('.json', '');
      const policy = await this.getToolPolicy(role);
      if (policy) {
        policies.push(policy);
      }
    }

    log.info({ count: policies.length }, 'Listed tool policies');
    return policies;
  }

  /**
   * Create or update a custom tool policy
   */
  async savePolicy(policy: ToolPolicy): Promise<void> {
    this.validatePolicy(policy);

    const normalizedRole = policy.role.trim().toLowerCase();

    // Check if we're at the limit for custom policies
    if (!this.cache.has(normalizedRole)) {
      const files = await fs.readdir(this.policiesDir).catch(() => []);
      const policyCount = files.filter((f) => f.endsWith('.json')).length;

      if (policyCount >= MAX_POLICIES) {
        throw new ValidationError(
          `Maximum policy limit (${MAX_POLICIES}) reached. Delete unused policies before creating new ones.`
        );
      }
    }

    const filePath = path.join(this.policiesDir, `${normalizedRole}.json`);
    await fs.writeFile(filePath, JSON.stringify(policy, null, 2), 'utf-8');

    // Update cache
    this.cache.set(normalizedRole, policy);

    log.info({ role: normalizedRole }, 'Tool policy saved');
  }

  /**
   * Delete a custom tool policy (cannot delete defaults)
   */
  async deletePolicy(role: string): Promise<void> {
    const normalizedRole = role.trim().toLowerCase();

    // Prevent deletion of default policies
    if (DEFAULT_ROLES.has(normalizedRole)) {
      throw new ValidationError(
        `Cannot delete default policy: ${normalizedRole}. Default policies can only be modified, not deleted.`
      );
    }

    const filePath = path.join(this.policiesDir, `${normalizedRole}.json`);
    await fs.unlink(filePath);
    this.cache.delete(normalizedRole);

    log.info({ role: normalizedRole }, 'Tool policy deleted');
  }

  /**
   * Validate tool access for a role
   * Returns true if the tool is allowed, false if denied
   */
  async validateToolAccess(role: string, tool: string): Promise<boolean> {
    const policy = await this.getToolPolicy(role);

    if (!policy) {
      // No policy defined for this role - allow all tools (permissive default)
      log.warn({ role, tool }, 'No policy found for role - allowing all tools');
      return true;
    }

    // Denied list takes precedence
    if (policy.denied.includes(tool)) {
      return false;
    }

    // Check allowed list
    // '*' means all tools allowed
    if (policy.allowed.includes('*')) {
      return true;
    }

    // Explicit allow
    return policy.allowed.includes(tool);
  }

  /**
   * Get the OpenClaw tool filter configuration for a role
   * Returns the allowed/denied tool names that can be passed to OpenClaw
   */
  async getToolFilterForRole(role: string): Promise<{ allowed?: string[]; denied?: string[] }> {
    const policy = await this.getToolPolicy(role);

    if (!policy) {
      // No policy - no restrictions
      return {};
    }

    const filter: { allowed?: string[]; denied?: string[] } = {};

    if (policy.denied.length > 0) {
      filter.denied = policy.denied;
    }

    // Only set allowed if it's not '*' (which means all tools)
    if (policy.allowed.length > 0 && !policy.allowed.includes('*')) {
      filter.allowed = policy.allowed;
    }

    return filter;
  }

  /**
   * Validate policy structure and constraints
   */
  private validatePolicy(policy: ToolPolicy): void {
    if (!policy.role || typeof policy.role !== 'string') {
      throw new ValidationError('Policy must have a role name');
    }

    if (policy.role.length > MAX_ROLE_NAME_LENGTH) {
      throw new ValidationError(
        `Role name exceeds maximum length of ${MAX_ROLE_NAME_LENGTH} characters`
      );
    }

    if (!Array.isArray(policy.allowed)) {
      throw new ValidationError('Policy must have an "allowed" array');
    }

    if (!Array.isArray(policy.denied)) {
      throw new ValidationError('Policy must have a "denied" array');
    }

    if (policy.allowed.length > MAX_TOOLS_PER_POLICY) {
      throw new ValidationError(
        `Allowed tools list exceeds maximum of ${MAX_TOOLS_PER_POLICY} tools`
      );
    }

    if (policy.denied.length > MAX_TOOLS_PER_POLICY) {
      throw new ValidationError(
        `Denied tools list exceeds maximum of ${MAX_TOOLS_PER_POLICY} tools`
      );
    }

    if (policy.description && policy.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new ValidationError(
        `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters`
      );
    }

    // Check for overlap between allowed and denied
    const allowedSet = new Set(policy.allowed);
    const deniedSet = new Set(policy.denied);
    const overlap = [...allowedSet].filter((tool) => deniedSet.has(tool));

    if (overlap.length > 0) {
      throw new ValidationError(`Tools cannot be both allowed and denied: ${overlap.join(', ')}`);
    }
  }

  /**
   * Clear the cache (useful for tests)
   */
  clearCache(): void {
    this.cache.clear();
    this.loadDefaults();
  }
}

// Singleton
let toolPolicyServiceInstance: ToolPolicyService | null = null;

export function getToolPolicyService(): ToolPolicyService {
  if (!toolPolicyServiceInstance) {
    toolPolicyServiceInstance = new ToolPolicyService();
  }
  return toolPolicyServiceInstance;
}
