import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAddComment } from '@/hooks/useTasks';
import type { Task } from '@veritas-kanban/shared';

interface CommentsSectionProps {
  task: Task;
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) === 1 ? '' : 's'} ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) === 1 ? '' : 's'} ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) === 1 ? '' : 's'} ago`;
  
  return date.toLocaleDateString();
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function CommentsSection({ task }: CommentsSectionProps) {
  const [author, setAuthor] = useState('Veritas');
  const [text, setText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const addComment = useAddComment();

  const comments = task.comments || [];

  const handleAddComment = async () => {
    if (!text.trim() || !author.trim()) return;
    
    setIsAdding(true);
    try {
      await addComment.mutateAsync({ 
        taskId: task.id, 
        author: author.trim(), 
        text: text.trim() 
      });
      setText('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAddComment();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <Label className="text-muted-foreground">Comments</Label>
        {comments.length > 0 && (
          <span className="text-xs text-muted-foreground">
            ({comments.length})
          </span>
        )}
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="text-sm text-muted-foreground italic py-4 text-center border rounded-md">
          No comments yet
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 p-3 rounded-md bg-muted/30">
              <div className="h-8 w-8 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                {getInitials(comment.author)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-medium text-sm">{comment.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(comment.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {comment.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex gap-2">
          <Input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name"
            className="text-sm max-w-[150px]"
            disabled={isAdding}
          />
        </div>
        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment... (Cmd/Ctrl+Enter to submit)"
            className="text-sm min-h-[80px] resize-none"
            disabled={isAdding}
          />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleAddComment}
            disabled={!text.trim() || !author.trim() || isAdding}
          >
            Add Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
