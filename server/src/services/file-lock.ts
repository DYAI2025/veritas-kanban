import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../lib/logger.js';

const log = createLogger('file-lock');

/** Default timeout in milliseconds to acquire a lock */
const DEFAULT_TIMEOUT_MS = 5_000;

/** Stale lock threshold — locks older than this are considered abandoned */
const STALE_LOCK_AGE_MS = 30_000;

/** Polling interval when waiting for a lock */
const POLL_INTERVAL_MS = 50;

interface LockInfo {
  pid: number;
  timestamp: number;
}

/**
 * Check if a process with the given PID is still alive.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the lock file path for a given data file.
 */
function lockPath(filePath: string): string {
  return filePath + '.lock';
}

/**
 * Read lock file info. Returns null if the lock file doesn't exist or is malformed.
 */
async function readLockInfo(lockFile: string): Promise<LockInfo | null> {
  try {
    const content = await fs.readFile(lockFile, 'utf-8');
    const info = JSON.parse(content) as LockInfo;
    if (typeof info.pid === 'number' && typeof info.timestamp === 'number') {
      return info;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if an existing lock is stale (process dead or too old).
 */
async function isLockStale(lockFile: string): Promise<boolean> {
  const info = await readLockInfo(lockFile);
  if (!info) {
    // Lock file exists but is unreadable/malformed — treat as stale
    return true;
  }

  // PID is dead
  if (!isProcessAlive(info.pid)) {
    log.debug({ lockFile, pid: info.pid }, 'Stale lock: process is dead');
    return true;
  }

  // Lock is too old
  if (Date.now() - info.timestamp > STALE_LOCK_AGE_MS) {
    log.debug({ lockFile, age: Date.now() - info.timestamp }, 'Stale lock: exceeded max age');
    return true;
  }

  return false;
}

/**
 * Try to atomically create a lock file.
 * Uses `wx` flag (write-exclusive) — fails if the file already exists.
 * Returns true if the lock was acquired.
 */
async function tryCreateLock(lockFile: string): Promise<boolean> {
  const info: LockInfo = {
    pid: process.pid,
    timestamp: Date.now(),
  };

  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(lockFile), { recursive: true });
    // wx = write exclusive — fails if file already exists (atomic on most filesystems)
    await fs.writeFile(lockFile, JSON.stringify(info), { flag: 'wx' });
    return true;
  } catch (err: any) {
    if (err.code === 'EEXIST') {
      return false;
    }
    throw err;
  }
}

/**
 * Remove a lock file.
 */
async function removeLock(lockFile: string): Promise<void> {
  try {
    await fs.unlink(lockFile);
  } catch (err: any) {
    // Ignore if already gone
    if (err.code !== 'ENOENT') {
      log.warn({ err, lockFile }, 'Failed to remove lock file');
    }
  }
}

/**
 * Acquire an advisory file lock.
 *
 * Returns an unlock function that must be called when the critical section is complete.
 *
 * @param filePath - Path to the file to lock (lock file will be `filePath.lock`)
 * @param timeout  - Maximum time in ms to wait for the lock (default: 5000)
 * @returns An async unlock function
 * @throws If the lock cannot be acquired within the timeout
 */
export async function acquireLock(
  filePath: string,
  timeout: number = DEFAULT_TIMEOUT_MS
): Promise<() => Promise<void>> {
  const lockFile = lockPath(filePath);
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    // Try to create the lock file atomically
    if (await tryCreateLock(lockFile)) {
      log.debug({ filePath }, 'Lock acquired');
      // Return the unlock function
      return async () => {
        await removeLock(lockFile);
        log.debug({ filePath }, 'Lock released');
      };
    }

    // Lock file exists — check if it's stale
    if (await isLockStale(lockFile)) {
      log.info({ lockFile }, 'Cleaning up stale lock');
      await removeLock(lockFile);
      // Loop back to try again immediately
      continue;
    }

    // Lock is held by an active process — wait and retry
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Failed to acquire file lock within ${timeout}ms: ${filePath}`);
}

/**
 * Execute a function while holding a file lock.
 *
 * Convenience wrapper around `acquireLock` that ensures the lock is always released,
 * even if the function throws.
 *
 * @param filePath - Path to the file to lock
 * @param fn       - Async function to execute while holding the lock
 * @returns The return value of `fn`
 */
export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const unlock = await acquireLock(filePath);
  try {
    return await fn();
  } finally {
    await unlock();
  }
}
