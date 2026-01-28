import { useQuery } from '@tanstack/react-query';
import { api, GlobalAgentStatus } from '@/lib/api';

/**
 * Hook to fetch global agent status (not per-task)
 * Polls every 3 seconds when agent is working, less frequently when idle
 */
export function useGlobalAgentStatus() {
  return useQuery({
    queryKey: ['agent', 'global-status'],
    queryFn: () => api.agent.globalStatus(),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll more frequently when active
      if (status === 'working' || status === 'thinking') {
        return 2000;
      }
      // Poll less frequently when idle
      return 10000;
    },
    // Keep previous data during refetch for smoother UX
    placeholderData: (previousData) => previousData,
  });
}

export type { GlobalAgentStatus };
