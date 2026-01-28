import { useEffect, useState, useMemo } from 'react';
import { useGlobalAgentStatus } from '@/hooks/useGlobalAgentStatus';

type AgentState = 'idle' | 'working' | 'thinking' | 'subagents' | 'error';

interface StateConfig {
  color: string;
  bgColor: string;
  animation: string;
  label: string;
}

const STATE_CONFIG: Record<AgentState, StateConfig> = {
  idle: {
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.2)',
    animation: '',
    label: 'Idle',
  },
  working: {
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.2)',
    animation: 'pulse',
    label: 'Working...',
  },
  thinking: {
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.2)',
    animation: 'breathe',
    label: 'Thinking...',
  },
  subagents: {
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.2)',
    animation: 'ripple',
    label: 'agents',
  },
  error: {
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.2)',
    animation: 'flash',
    label: 'Error',
  },
};

// CSS keyframes for animations
const styles = `
  @keyframes agent-pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.15);
      opacity: 0.8;
    }
  }

  @keyframes agent-breathe {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 currentColor;
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 0 8px 2px currentColor;
    }
  }

  @keyframes agent-ripple {
    0% {
      box-shadow: 0 0 0 0 currentColor;
    }
    70% {
      box-shadow: 0 0 0 6px transparent;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }

  @keyframes agent-flash {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  .agent-status-dot {
    transition: background-color 300ms ease, color 300ms ease;
  }

  .agent-status-dot.animate-pulse {
    animation: agent-pulse 1.5s ease-in-out infinite;
  }

  .agent-status-dot.animate-breathe {
    animation: agent-breathe 2s ease-in-out infinite;
  }

  .agent-status-dot.animate-ripple {
    animation: agent-ripple 1.2s ease-out infinite;
  }

  .agent-status-dot.animate-flash {
    animation: agent-flash 0.4s ease-in-out 2;
  }

  @media (prefers-reduced-motion: reduce) {
    .agent-status-dot {
      animation: none !important;
    }
  }

  .agent-status-tooltip {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 8px;
    padding: 8px 12px;
    background: hsl(var(--popover));
    border: 1px solid hsl(var(--border));
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    white-space: nowrap;
    z-index: 50;
    opacity: 0;
    visibility: hidden;
    transition: opacity 150ms ease, visibility 150ms ease;
    pointer-events: none;
  }

  .agent-status-container:hover .agent-status-tooltip,
  .agent-status-container:focus-within .agent-status-tooltip {
    opacity: 1;
    visibility: visible;
  }
`;

function formatDuration(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - start.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

interface AgentStatusIndicatorProps {
  className?: string;
}

export function AgentStatusIndicator({ className = '' }: AgentStatusIndicatorProps) {
  const { data, isLoading, error } = useGlobalAgentStatus();
  const [hasFlashed, setHasFlashed] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  // Inject styles once
  useEffect(() => {
    const styleId = 'agent-status-indicator-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Determine the visual state
  const state: AgentState = useMemo(() => {
    if (error) return 'error';
    if (!data) return 'idle';
    if (data.status === 'error') return 'error';
    if (data.subAgentCount > 0) return 'subagents';
    return data.status;
  }, [data, error]);

  const config = STATE_CONFIG[state];

  // Reset flash animation when error occurs
  useEffect(() => {
    if (state === 'error' && lastStatus !== 'error') {
      setHasFlashed(false);
      // Mark as flashed after animation completes
      const timer = setTimeout(() => setHasFlashed(true), 800);
      return () => clearTimeout(timer);
    }
    setLastStatus(state);
  }, [state, lastStatus]);

  // Get animation class
  const animationClass = useMemo(() => {
    if (state === 'error' && hasFlashed) return '';
    if (state === 'idle') return '';
    return config.animation ? `animate-${config.animation}` : '';
  }, [state, hasFlashed, config.animation]);

  // Build label
  const label = useMemo(() => {
    if (state === 'subagents' && data?.subAgentCount) {
      return `${data.subAgentCount} ${config.label}`;
    }
    return config.label;
  }, [state, data?.subAgentCount, config.label]);

  // Build tooltip content
  const tooltipContent = useMemo(() => {
    const lines: string[] = [];
    
    if (data?.activeTaskTitle) {
      lines.push(`Task: ${data.activeTaskTitle}`);
    }
    
    if (data?.lastUpdated && state !== 'idle') {
      lines.push(`Duration: ${formatDuration(data.lastUpdated)}`);
    }
    
    if (data?.subAgentCount && data.subAgentCount > 0) {
      lines.push(`Sub-agents: ${data.subAgentCount}`);
    }
    
    if (data?.error) {
      lines.push(`Error: ${data.error}`);
    }
    
    return lines.length > 0 ? lines : ['Agent is idle'];
  }, [data, state]);

  // Screen reader announcement
  const ariaLabel = useMemo(() => {
    let announcement = `Agent status: ${label}`;
    if (data?.activeTaskTitle) {
      announcement += `, working on ${data.activeTaskTitle}`;
    }
    return announcement;
  }, [label, data?.activeTaskTitle]);

  if (isLoading && !data) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div 
          className="w-2.5 h-2.5 rounded-full bg-gray-400 opacity-50"
          aria-hidden="true"
        />
        <span className="text-sm text-muted-foreground">...</span>
      </div>
    );
  }

  return (
    <div 
      className={`agent-status-container relative flex items-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {/* The pulsing dot */}
      <div
        className={`agent-status-dot w-2.5 h-2.5 rounded-full ${animationClass}`}
        style={{ 
          backgroundColor: config.color,
          color: config.color,
        }}
        aria-hidden="true"
      />
      
      {/* Label */}
      <span 
        className="text-sm font-medium"
        style={{ color: config.color }}
      >
        {label}
      </span>
      
      {/* Sub-agent count badge (only for subagents state) */}
      {state === 'subagents' && data?.subAgentCount && data.subAgentCount > 0 && (
        <span 
          className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full"
          style={{ 
            backgroundColor: config.bgColor,
            color: config.color,
          }}
          aria-hidden="true"
        >
          {data.subAgentCount}
        </span>
      )}

      {/* Tooltip */}
      <div 
        className="agent-status-tooltip text-sm text-popover-foreground"
        role="tooltip"
      >
        {tooltipContent.map((line, i) => (
          <div key={i} className={i > 0 ? 'mt-1' : ''}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
