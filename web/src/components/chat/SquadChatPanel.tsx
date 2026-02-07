import { useState, useEffect, useRef } from 'react';
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
import { Send, Loader2, Users, Filter } from 'lucide-react';
import { useSquadMessages, useSendSquadMessage, useSquadStream } from '@/hooks/useChat';
import type { SquadMessage } from '@veritas-kanban/shared';

interface SquadChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Agent colors for visual distinction
const agentColors: Record<string, string> = {
  VERITAS: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  TARS: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  CASE: 'bg-green-500/20 text-green-400 border-green-500/30',
  Ava: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'R2-D2': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'K-2SO': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  MAX: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'Johnny 5': 'bg-red-500/20 text-red-400 border-red-500/30',
  Bishop: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  Marvin: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function SquadChatPanel({ open, onOpenChange }: SquadChatPanelProps) {
  const [message, setMessage] = useState('');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const { data: messages = [], isLoading } = useSquadMessages({ limit: 50 });
  const { mutate: sendMessage, isPending } = useSendSquadMessage();
  const { newMessage } = useSquadStream();

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, newMessage, shouldAutoScroll]);

  // Detect manual scroll-up to pause auto-scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 50;
    setShouldAutoScroll(isAtBottom);
  };

  const handleSend = () => {
    if (!message.trim() || isPending) return;

    sendMessage(
      {
        agent: 'VERITAS', // Default agent - could be configurable
        message: message.trim(),
      },
      {
        onSuccess: () => {
          setMessage('');
          setShouldAutoScroll(true);
          // Re-focus the input so user can keep typing
          requestAnimationFrame(() => inputRef.current?.focus());
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

  // Filter messages by agent
  const filteredMessages =
    agentFilter === 'all' ? messages : messages.filter((m) => m.agent === agentFilter);

  // Get unique agents from messages
  const uniqueAgents = Array.from(new Set(messages.map((m) => m.agent))).sort();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[500px] sm:max-w-[500px] overflow-hidden flex flex-col p-0"
        side="right"
      >
        <SheetHeader className="border-b border-border px-4 py-3 pr-10 flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Squad Chat
          </SheetTitle>
          <div className="text-xs text-muted-foreground pt-2">
            Agent-to-agent communication channel
          </div>
        </SheetHeader>

        {/* Filter Bar */}
        <div className="border-b border-border px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="h-8 text-xs w-[150px]">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {uniqueAgents.map((agent) => (
                <SelectItem key={agent} value={agent}>
                  {agent}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4" onScrollCapture={handleScroll} ref={scrollAreaRef}>
          <div className="py-4 space-y-3">
            {isLoading && (
              <div className="text-center text-muted-foreground py-8">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Loading messages...</p>
              </div>
            )}
            {!isLoading && filteredMessages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {agentFilter === 'all'
                    ? 'No messages yet. Be the first to say something!'
                    : `No messages from ${agentFilter}`}
                </p>
              </div>
            )}
            {filteredMessages.map((msg) => (
              <SquadMessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-border p-4 flex-shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Send a message to the squad..."
              disabled={isPending}
              className="flex-1"
              autoFocus
            />
            <Button onClick={handleSend} disabled={!message.trim() || isPending} size="icon">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface SquadMessageBubbleProps {
  message: SquadMessage;
}

function SquadMessageBubble({ message }: SquadMessageBubbleProps) {
  const colorClass = agentColors[message.agent] || agentColors.VERITAS;

  return (
    <div className={`rounded-lg border p-3 ${colorClass}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{message.agent}</span>
          {message.tags && message.tags.length > 0 && (
            <div className="flex gap-1">
              {message.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 rounded bg-background/50 border border-current/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs opacity-70">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.message}</div>
    </div>
  );
}
