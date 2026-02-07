/**
 * Chat Interface Types
 *
 * Built-in chat interface for conversing with agents about tasks or the board.
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  agent?: string; // Which agent responded
  model?: string; // Which model was used
  toolCalls?: Array<{
    // Collapsible tool-use blocks
    name: string;
    input: string;
    output?: string;
  }>;
}

export interface ChatSession {
  id: string;
  taskId?: string; // Task-scoped (undefined = board-level)
  title: string;
  messages: ChatMessage[];
  agent: string; // Current agent for this session
  model?: string;
  mode: 'ask' | 'build'; // Ask = read-only, Build = can mutate
  created: string;
  updated: string;
}

export interface ChatSendInput {
  sessionId?: string; // Existing session (omit for new)
  taskId?: string; // Task context
  message: string;
  agent?: string; // Override agent
  model?: string; // Override model
  mode?: 'ask' | 'build';
}

/**
 * Squad Chat Message
 * Agent-to-agent communication not tied to a specific task
 */
export interface SquadMessage {
  id: string;
  agent: string; // Which agent sent this
  message: string;
  tags?: string[]; // Optional categorization
  timestamp: string;
}

/**
 * Input for sending a squad message
 */
export interface SquadMessageInput {
  agent: string;
  message: string;
  tags?: string[];
}
