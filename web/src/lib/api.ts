import type { Task, CreateTaskInput, UpdateTaskInput } from '@veritas-kanban/shared';

const API_BASE = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export const api = {
  tasks: {
    list: async (): Promise<Task[]> => {
      const response = await fetch(`${API_BASE}/tasks`);
      return handleResponse<Task[]>(response);
    },

    get: async (id: string): Promise<Task> => {
      const response = await fetch(`${API_BASE}/tasks/${id}`);
      return handleResponse<Task>(response);
    },

    create: async (input: CreateTaskInput): Promise<Task> => {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return handleResponse<Task>(response);
    },

    update: async (id: string, input: UpdateTaskInput): Promise<Task> => {
      const response = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return handleResponse<Task>(response);
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE',
      });
      return handleResponse<void>(response);
    },

    archive: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/tasks/${id}/archive`, {
        method: 'POST',
      });
      return handleResponse<void>(response);
    },
  },
};
