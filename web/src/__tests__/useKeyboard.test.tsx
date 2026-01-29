/**
 * Tests for hooks/useKeyboard.tsx — KeyboardProvider & keyboard shortcuts.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Task, TaskStatus } from '@veritas-kanban/shared';
import { createMockTask } from './test-utils';

// Mock toast before importing the module under test
vi.mock('@/hooks/useToast', () => {
  const toast = vi.fn();
  return { toast, useToast: () => ({ toast, toasts: [], dismiss: vi.fn() }) };
});

// Dynamic import after mocks are set
const { KeyboardProvider, useKeyboard } = await import('@/hooks/useKeyboard');

// ── Test Component ───────────────────────────────────────────

function TestConsumer({
  tasks = [],
  onOpenTask,
  onMoveTask,
}: {
  tasks?: Task[];
  onOpenTask?: (task: Task) => void;
  onMoveTask?: (taskId: string, status: TaskStatus) => void;
}) {
  const ctx = useKeyboard();

  // Register tasks and callbacks
  React.useEffect(() => {
    ctx.setTasks(tasks);
  }, [tasks, ctx]);

  React.useEffect(() => {
    if (onOpenTask) ctx.setOnOpenTask(onOpenTask);
    if (onMoveTask) ctx.setOnMoveTask(onMoveTask);
  }, [onOpenTask, onMoveTask, ctx]);

  return (
    <div>
      <div data-testid="selected">{ctx.selectedTaskId ?? 'none'}</div>
      <div data-testid="help-open">{ctx.isHelpOpen ? 'yes' : 'no'}</div>
      <button data-testid="open-help" onClick={ctx.openHelpDialog}>
        Open Help
      </button>
    </div>
  );
}

function renderWithProvider(props: React.ComponentProps<typeof TestConsumer> = {}) {
  return render(
    <KeyboardProvider>
      <TestConsumer {...props} />
    </KeyboardProvider>
  );
}

// ── Tests ────────────────────────────────────────────────────

describe('KeyboardProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('throws when useKeyboard is used outside provider', () => {
    // Suppress React error boundary console output
    vi.spyOn(console, 'error').mockImplementation(() => {});

    function BadConsumer() {
      useKeyboard();
      return null;
    }

    expect(() => render(<BadConsumer />)).toThrow(
      'useKeyboard must be used within KeyboardProvider'
    );
  });

  it('starts with no selected task and help closed', () => {
    renderWithProvider();
    expect(screen.getByTestId('selected').textContent).toBe('none');
    expect(screen.getByTestId('help-open').textContent).toBe('no');
  });

  it('toggles help dialog with ? key', () => {
    renderWithProvider();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByTestId('help-open').textContent).toBe('yes');

    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByTestId('help-open').textContent).toBe('no');
  });

  it('closes help dialog with Escape', () => {
    renderWithProvider();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByTestId('help-open').textContent).toBe('yes');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('help-open').textContent).toBe('no');
  });

  it('navigates tasks with j/k keys', () => {
    const tasks = [
      createMockTask({ id: 'a', title: 'Alpha', status: 'todo' }),
      createMockTask({ id: 'b', title: 'Beta', status: 'todo' }),
      createMockTask({ id: 'c', title: 'Charlie', status: 'todo' }),
    ];

    renderWithProvider({ tasks });

    // j selects first task
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByTestId('selected').textContent).toBe('a');

    // j again selects next
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByTestId('selected').textContent).toBe('b');

    // k goes back
    fireEvent.keyDown(window, { key: 'k' });
    expect(screen.getByTestId('selected').textContent).toBe('a');
  });

  it('navigates tasks with arrow keys', () => {
    const tasks = [
      createMockTask({ id: 'x', title: 'X', status: 'todo' }),
      createMockTask({ id: 'y', title: 'Y', status: 'todo' }),
    ];

    renderWithProvider({ tasks });

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(screen.getByTestId('selected').textContent).toBe('x');

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(screen.getByTestId('selected').textContent).toBe('y');

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(screen.getByTestId('selected').textContent).toBe('x');
  });

  it('wraps around when navigating past the last/first task', () => {
    const tasks = [
      createMockTask({ id: 'first', title: 'First', status: 'todo' }),
      createMockTask({ id: 'last', title: 'Last', status: 'todo' }),
    ];

    renderWithProvider({ tasks });

    // Navigate to last
    fireEvent.keyDown(window, { key: 'j' });
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByTestId('selected').textContent).toBe('last');

    // Next should wrap to first
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByTestId('selected').textContent).toBe('first');
  });

  it('opens task with Enter key', () => {
    const tasks = [createMockTask({ id: 'enter-test', title: 'Enter Task', status: 'todo' })];
    const onOpenTask = vi.fn();

    renderWithProvider({ tasks, onOpenTask });

    // Select first task
    fireEvent.keyDown(window, { key: 'j' });
    // Open it
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'enter-test' }));
  });

  it('moves task to column with number keys 1-4', () => {
    const tasks = [createMockTask({ id: 'move-test', title: 'Move Task', status: 'todo' })];
    const onMoveTask = vi.fn();

    renderWithProvider({ tasks, onMoveTask });

    // Select task
    fireEvent.keyDown(window, { key: 'j' });

    // Move to in-progress (2)
    fireEvent.keyDown(window, { key: '2' });
    expect(onMoveTask).toHaveBeenCalledWith('move-test', 'in-progress');

    // Move to done (4)
    fireEvent.keyDown(window, { key: '4' });
    expect(onMoveTask).toHaveBeenCalledWith('move-test', 'done');
  });

  it('clears selection with Escape', () => {
    const tasks = [createMockTask({ id: 'esc', title: 'Esc Task', status: 'todo' })];

    renderWithProvider({ tasks });

    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByTestId('selected').textContent).toBe('esc');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('selected').textContent).toBe('none');
  });

  it('ignores shortcuts when typing in an input', () => {
    const tasks = [createMockTask({ id: 'input-test', title: 'Input', status: 'todo' })];

    const { container } = renderWithProvider({ tasks });

    // Add an input element for the test
    const input = document.createElement('input');
    container.appendChild(input);

    // Fire keydown on the input — should be ignored
    fireEvent.keyDown(input, { key: 'j' });
    expect(screen.getByTestId('selected').textContent).toBe('none');
  });
});
