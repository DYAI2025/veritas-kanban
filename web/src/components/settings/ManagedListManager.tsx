import { useState } from 'react';
import type { ManagedListItem } from '@veritas-kanban/shared';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Trash2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface ManagedListManagerProps<T extends ManagedListItem> {
  title: string;
  items: T[];
  isLoading: boolean;
  onCreate: (input: any) => Promise<any>;
  onUpdate: (id: string, patch: any) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  onReorder: (ids: string[]) => Promise<any>;
  renderExtraFields?: (item: T, onChange: (patch: Partial<T>) => void) => React.ReactNode;
  newItemDefaults?: Partial<T>;
  canDeleteCheck?: (id: string) => Promise<{ allowed: boolean; referenceCount: number; isDefault: boolean }>;
}

interface SortableItemProps<T extends ManagedListItem> {
  item: T;
  onUpdate: (id: string, patch: any) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  renderExtraFields?: (item: T, onChange: (patch: Partial<T>) => void) => React.ReactNode;
  canDeleteCheck?: (id: string) => Promise<{ allowed: boolean; referenceCount: number; isDefault: boolean }>;
}

function SortableItem<T extends ManagedListItem>({
  item,
  onUpdate,
  onDelete,
  renderExtraFields,
  canDeleteCheck,
}: SortableItemProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<{ allowed: boolean; referenceCount: number; isDefault: boolean } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleLabelSave = async () => {
    if (label.trim() && label !== item.label) {
      await onUpdate(item.id, { label });
    }
    setIsEditing(false);
  };

  const handleDeleteClick = async () => {
    if (canDeleteCheck) {
      const info = await canDeleteCheck(item.id);
      setDeleteInfo(info);
      if (!info.allowed) {
        setDeleteDialogOpen(true);
        return;
      }
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    await onDelete(item.id);
    setDeleteDialogOpen(false);
  };

  const handleExtraFieldChange = (patch: Partial<T>) => {
    onUpdate(item.id, patch);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-2 p-2 bg-card border rounded-lg mb-2"
      >
        <button
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 flex flex-col gap-2">
          {isEditing ? (
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleLabelSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLabelSave();
                if (e.key === 'Escape') {
                  setLabel(item.label);
                  setIsEditing(false);
                }
              }}
              autoFocus
              className="h-8"
            />
          ) : (
            <div
              className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
              onClick={() => setIsEditing(true)}
            >
              {item.label}
              {item.isHidden && (
                <span className="ml-2 text-xs text-muted-foreground">(hidden)</span>
              )}
            </div>
          )}

          {renderExtraFields && renderExtraFields(item, handleExtraFieldChange)}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteClick}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteInfo && !deleteInfo.allowed ? 'Cannot Delete' : 'Delete Item?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteInfo && deleteInfo.referenceCount > 0 && !deleteInfo.allowed ? (
                <span>
                  &quot;{item.label}&quot; is used by {deleteInfo.referenceCount} task(s). 
                  Remove or reassign those tasks first before deleting this item.
                </span>
              ) : (
                <span>Are you sure you want to delete &quot;{item.label}&quot;? This action cannot be undone.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {(!deleteInfo || deleteInfo.allowed) && (
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ManagedListManager<T extends ManagedListItem>({
  title,
  items,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  renderExtraFields,
  newItemDefaults,
  canDeleteCheck,
}: ManagedListManagerProps<T>) {
  const [newItemLabel, setNewItemLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const reordered = arrayMove(items, oldIndex, newIndex);
      const orderedIds = reordered.map((item) => item.id);

      await onReorder(orderedIds);
    }
  };

  const handleCreate = async () => {
    if (!newItemLabel.trim()) return;

    setIsCreating(true);
    try {
      await onCreate({
        label: newItemLabel.trim(),
        ...newItemDefaults,
      });
      setNewItemLabel('');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading {title.toLowerCase()}...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              onUpdate={onUpdate}
              onDelete={onDelete}
              renderExtraFields={renderExtraFields}
              canDeleteCheck={canDeleteCheck}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex gap-2">
        <Input
          placeholder="New item name..."
          value={newItemLabel}
          onChange={(e) => setNewItemLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
          disabled={isCreating}
        />
        <Button onClick={handleCreate} disabled={!newItemLabel.trim() || isCreating}>
          Add
        </Button>
      </div>
    </div>
  );
}
