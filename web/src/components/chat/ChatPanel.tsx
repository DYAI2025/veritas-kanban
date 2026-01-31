import { useState, useEffect, useRef, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MessageSquare,
  Send,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
  Bot,
  User,
} from 'lucide-react';
import {
  useChatSession,
  useSendChatMessage,
  useChatStream,
  useChatSessions,
} from '@/hooks/useChat';
import { useConfig } from '@/hooks/useConfig';
import { useTask } from '@/hooks/useTasks';
import type { ChatMessage } from '@veritas-kanban/shared';

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string;
}

export function ChatPanel({ open, onOpenChange, taskId }: ChatPanelProps) {
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'ask' | 'build'>('ask');
  const [selectedAgent, setSelectedAgent] = useState<string>('claude-code');
  const [selectedModel, setSelectedModel] = useState<string>('sonnet');
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();

  const { data: config } = useConfig();
  const enabledAgents = config?.agents?.filter((a: { enabled: boolean }) => a.enabled) || [];
  const { data: task } = useTask(taskId || '');
  const { data: sessions = [] } = useChatSessions();
  const { data: session } = useChatSession(currentSessionId);
  const { mutate: sendChatMessage, isPending } = useSendChatMessage();
  const { streamingMessage } = useChatStream(currentSessionId);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages, streamingMessage, shouldAutoScroll]);

  // Detect manual scroll-up to pause auto-scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 50;
    setShouldAutoScroll(isAtBottom);
  };

  // Filter sessions by taskId if scoped
  const filteredSessions = useMemo(() => {
    if (!taskId) {
      return sessions.filter((s) => !s.taskId);
    }
    return sessions.filter((s) => s.taskId === taskId);
  }, [sessions, taskId]);

  // Handle sending a message
  const handleSend = () => {
    if (!message.trim() || isPending) return;

    sendChatMessage(
      {
        sessionId: currentSessionId,
        taskId,
        message: message.trim(),
        agent: selectedAgent,
        model: selectedModel,
        mode,
      },
      {
        onSuccess: (newSession) => {
          setCurrentSessionId(newSession.id);
          setMessage('');
          setShouldAutoScroll(true);
        },
      }
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Load most recent session on mount if exists
  useEffect(() => {
    if (!currentSessionId && filteredSessions.length > 0) {
      setCurrentSessionId(filteredSessions[0].id);
    }
  }, [filteredSessions, currentSessionId]);

  const models = ['sonnet', 'opus', 'haiku'];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[500px] sm:max-w-[500px] overflow-hidden flex flex-col p-0"
        side="right"
      >
        {/* Header */}
        <SheetHeader className="border-b border-border px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Agent Chat
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enabledAgents.map((a: { type: string; name: string }) => (
                    <SelectItem key={a.type} value={a.type}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {taskId && task && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 pt-2 border-t border-border/50 mt-2">
              <MessageSquare className="h-3 w-3" />
              Task: {task.title}
            </div>
          )}
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4" onScrollCapture={handleScroll} ref={scrollAreaRef}>
          <div className="py-4 space-y-4">
            {session?.messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}
            {streamingMessage && (
              <ChatMessageBubble
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingMessage.content || '',
                  timestamp: new Date().toISOString(),
                }}
                isStreaming
              />
            )}
            {session?.messages.length === 0 && !streamingMessage && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {taskId ? 'Start a conversation about this task' : 'Start a new chat session'}
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-border p-4 flex-shrink-0 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              disabled={isPending}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={!message.trim() || isPending} size="icon">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Mode:</span>
            <Button
              variant={mode === 'ask' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('ask')}
              className="h-7 text-xs"
            >
              Ask
            </Button>
            <Button
              variant={mode === 'build' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('build')}
              className="h-7 text-xs"
            >
              Build
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground cursor-help">ⓘ</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    <strong>Ask:</strong> Read-only queries and questions
                    <br />
                    <strong>Build:</strong> Make changes, create files, execute commands
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface ChatMessageBubbleProps {
  message: ChatMessage | { id: string; role: string; content: string; timestamp: string };
  isStreaming?: boolean;
}

function ChatMessageBubble({ message, isStreaming }: ChatMessageBubbleProps) {
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const toggleTool = (index: number) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (isSystem) {
    return (
      <div className="text-center text-sm text-muted-foreground italic py-2">{message.content}</div>
    );
  }

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={`max-w-[80%] space-y-2`}>
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
          }`}
        >
          <MarkdownContent content={message.content} />
          {isStreaming && <span className="inline-block w-1 h-4 bg-current animate-pulse ml-1" />}
        </div>

        {/* Tool calls */}
        {'toolCalls' in message && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1">
            {message.toolCalls.map((tool, idx) => (
              <div key={idx} className="border border-border rounded bg-zinc-950 overflow-hidden">
                <button
                  onClick={() => toggleTool(idx)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-zinc-900 transition-colors"
                >
                  {expandedTools.has(idx) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <code className="text-emerald-400">{tool.name}</code>
                </button>
                {expandedTools.has(idx) && (
                  <div className="px-3 pb-2 space-y-2 text-xs font-mono">
                    <div>
                      <div className="text-muted-foreground mb-1">Input:</div>
                      <pre className="text-zinc-300 whitespace-pre-wrap break-all">
                        {tool.input}
                      </pre>
                    </div>
                    {tool.output && (
                      <div>
                        <div className="text-muted-foreground mb-1">Output:</div>
                        <pre className="text-zinc-300 whitespace-pre-wrap break-all">
                          {tool.output}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-xs text-muted-foreground px-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
      {isUser && (
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

/**
 * Simple markdown renderer
 * Handles code blocks and basic formatting
 */
function MarkdownContent({ content }: { content: string }) {
  // Split content by code blocks
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, idx) => {
        // Multi-line code block
        if (part.startsWith('```')) {
          const lines = part.split('\n');
          const language = lines[0].replace('```', '').trim();
          const code = lines.slice(1, -1).join('\n');

          return (
            <pre key={idx} className="bg-zinc-950 rounded p-2 overflow-x-auto text-xs">
              {language && <div className="text-muted-foreground mb-1">{language}</div>}
              <code className="text-zinc-300">{code}</code>
            </pre>
          );
        }

        // Inline code
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={idx} className="bg-zinc-800 px-1 py-0.5 rounded text-xs">
              {part.slice(1, -1)}
            </code>
          );
        }

        // Regular text
        return (
          <span key={idx} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </div>
  );
}
