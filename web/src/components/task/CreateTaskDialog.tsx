import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateTask } from '@/hooks/useTasks';
import { useTemplates, type TaskTemplate } from '@/hooks/useTemplates';
import type { TaskPriority, Subtask } from '@veritas-kanban/shared';
import { FileText, X, Check, AlertCircle, HelpCircle, Info } from 'lucide-react';
import { useTaskTypes, getTypeIcon } from '@/hooks/useTaskTypes';
import { useProjects } from '@/hooks/useProjects';
import { nanoid } from 'nanoid';
import { 
  interpolateVariables, 
  extractCustomVariables,
  type VariableContext 
} from '@/lib/template-variables';
import { getCategoryIcon } from '@/lib/template-categories';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('code');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [project, setProject] = useState('');
  const [sprint, setSprint] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [customVars, setCustomVars] = useState<Record<string, string>>({});
  const [requiredCustomVars, setRequiredCustomVars] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showHelp, setShowHelp] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const createTask = useCreateTask();
  const { data: templates } = useTemplates();
  const { data: taskTypes = [] } = useTaskTypes();
  const { data: projects = [] } = useProjects();

  // Filter templates by selected category
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (categoryFilter === 'all') return templates;
    return templates.filter(t => (t.category || 'custom') === categoryFilter);
  }, [templates, categoryFilter]);

  const applyTemplate = (template: TaskTemplate) => {
    setSelectedTemplate(template.id);
    
    // If this is a blueprint template, extract variables from all blueprint tasks
    if (template.blueprint && template.blueprint.length > 0) {
      const allBlueprintText = template.blueprint.flatMap(bt => [
        bt.title,
        bt.taskDefaults.descriptionTemplate || '',
        ...(bt.subtaskTemplates?.map(st => st.title) || [])
      ]).join(' ');
      
      const customVarNames = extractCustomVariables(allBlueprintText);
      setRequiredCustomVars(customVarNames);
      
      const initialCustomVars: Record<string, string> = {};
      customVarNames.forEach(name => {
        initialCustomVars[name] = '';
      });
      setCustomVars(initialCustomVars);
      
      // Don't populate the form for blueprints
      return;
    }
    
    // Single-task template
    if (template.taskDefaults.type) setType(template.taskDefaults.type);
    if (template.taskDefaults.priority) setPriority(template.taskDefaults.priority);
    if (template.taskDefaults.project) setProject(template.taskDefaults.project);
    
    // Extract custom variables from description template and subtasks
    const allTemplateText = [
      template.taskDefaults.descriptionTemplate || '',
      ...(template.subtaskTemplates?.map(st => st.title) || [])
    ].join(' ');
    
    const customVarNames = extractCustomVariables(allTemplateText);
    setRequiredCustomVars(customVarNames);
    
    // Initialize custom vars
    const initialCustomVars: Record<string, string> = {};
    customVarNames.forEach(name => {
      initialCustomVars[name] = '';
    });
    setCustomVars(initialCustomVars);
    
    // Store raw template (will be interpolated when custom vars are filled)
    if (template.taskDefaults.descriptionTemplate) {
      setDescription(template.taskDefaults.descriptionTemplate);
    }
    
    // Convert subtask templates to actual subtasks (will be interpolated on submit)
    if (template.subtaskTemplates && template.subtaskTemplates.length > 0) {
      const now = new Date().toISOString();
      const templateSubtasks: Subtask[] = template.subtaskTemplates
        .sort((a, b) => a.order - b.order)
        .map(st => ({
          id: nanoid(),
          title: st.title, // Will be interpolated on submit
          completed: false,
          created: now,
        }));
      setSubtasks(templateSubtasks);
    } else {
      setSubtasks([]);
    }
  };

  const clearTemplate = () => {
    setSelectedTemplate(null);
    setSubtasks([]);
    setCustomVars({});
    setRequiredCustomVars([]);
  };

  const removeSubtask = (id: string) => {
    setSubtasks(prev => prev.filter(st => st.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build variable context
    const context: VariableContext = {
      project: project.trim() || undefined,
      author: 'Brad', // TODO: Get from user config
      customVars,
    };

    // Check if this is a blueprint template
    const template = selectedTemplate ? templates?.find(t => t.id === selectedTemplate) : null;
    
    if (template?.blueprint && template.blueprint.length > 0) {
      // Blueprint: create multiple tasks
      await handleBlueprintCreation(template, context);
    } else {
      // Single task creation
      if (!title.trim()) return;
      
      // Interpolate variables in description
      const interpolatedDescription = interpolateVariables(description, context);

      // Interpolate variables in subtask titles
      const interpolatedSubtasks = subtasks.map(st => ({
        ...st,
        title: interpolateVariables(st.title, context),
      }));

      await createTask.mutateAsync({
        title: title.trim(),
        description: interpolatedDescription.trim(),
        type,
        priority,
        project: project.trim() || undefined,
        sprint: sprint.trim() || undefined,
        subtasks: interpolatedSubtasks.length > 0 ? interpolatedSubtasks : undefined,
      });
    }

    // Reset form
    setTitle('');
    setDescription('');
    setType('code');
    setPriority('medium');
    setProject('');
    setSprint('');
    setSelectedTemplate(null);
    setSubtasks([]);
    setCustomVars({});
    setRequiredCustomVars([]);
    setShowNewProject(false);
    setNewProjectName('');
    onOpenChange(false);
  };

  const handleBlueprintCreation = async (template: TaskTemplate, context: VariableContext) => {
    if (!template.blueprint) return;

    // Map to store refId -> actual task ID
    const refIdToTaskId: Record<string, string> = {};

    // Create tasks in order, resolving dependencies
    for (const blueprintTask of template.blueprint) {
      // Interpolate title
      const taskTitle = interpolateVariables(blueprintTask.title, context);
      
      // Interpolate description
      const taskDescription = interpolateVariables(
        blueprintTask.taskDefaults.descriptionTemplate || '',
        context
      );

      // Create subtasks
      const taskSubtasks = blueprintTask.subtaskTemplates?.map(st => {
        const now = new Date().toISOString();
        return {
          id: nanoid(),
          title: interpolateVariables(st.title, context),
          completed: false,
          created: now,
        };
      });

      // Resolve dependencies
      const blockedBy = blueprintTask.blockedByRefs?.map(refId => refIdToTaskId[refId]).filter(Boolean);

      // Create the task
      const createdTask = await createTask.mutateAsync({
        title: taskTitle,
        description: taskDescription,
        type: blueprintTask.taskDefaults.type,
        priority: blueprintTask.taskDefaults.priority,
        project: blueprintTask.taskDefaults.project || project.trim() || undefined,
        subtasks: taskSubtasks,
        blockedBy,
      });

      // Store the mapping
      refIdToTaskId[blueprintTask.refId] = createdTask.id;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          
          {/* Template selector */}
          {templates && templates.length > 0 && (
            <div className="border-b pb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Template</Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowHelp(!showHelp)}
                >
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              
              {/* Help Section */}
              {showHelp && (
                <div className="mb-3 p-3 rounded-md bg-muted/50 border border-muted-foreground/20 text-sm space-y-2">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1.5">
                      <p className="font-medium text-sm">Using Templates</p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        <li>• <strong>Simple templates</strong> pre-fill task fields and can include subtasks</li>
                        <li>• <strong>Variables</strong> like <code className="px-1 py-0.5 rounded bg-muted">{'{{date}}'}</code> or <code className="px-1 py-0.5 rounded bg-muted">{'{{author}}'}</code> are replaced when creating the task</li>
                        <li>• <strong>Custom variables</strong> (e.g., <code className="px-1 py-0.5 rounded bg-muted">{'{{bugId}}'}</code>) prompt you for values</li>
                        <li>• <strong>Blueprint templates</strong> create multiple linked tasks with dependencies</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="bug" className="text-xs">🐛</TabsTrigger>
                  <TabsTrigger value="feature" className="text-xs">✨</TabsTrigger>
                  <TabsTrigger value="sprint" className="text-xs">🔄</TabsTrigger>
                </TabsList>
              </Tabs>
              <Select
                value={selectedTemplate || 'none'}
                onValueChange={(value) => {
                  if (value === 'none') {
                    clearTemplate();
                  } else {
                    const template = templates.find(t => t.id === value);
                    if (template) applyTemplate(template);
                  }
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {filteredTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.category && `${getCategoryIcon(template.category)} `}
                      {template.name}
                      {template.description && (
                        <span className="text-muted-foreground ml-2">
                          — {template.description}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Blueprint preview or regular form */}
          {selectedTemplate && templates?.find(t => t.id === selectedTemplate)?.blueprint ? (
            <div className="grid gap-4 py-4">
              <div className="border rounded-md p-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  <Label className="text-sm font-medium">Blueprint: Multiple Tasks</Label>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  This template will create {templates.find(t => t.id === selectedTemplate)?.blueprint?.length} linked tasks.
                </p>
                <div className="space-y-2">
                  {templates.find(t => t.id === selectedTemplate)?.blueprint?.map((bt, idx) => (
                    <div key={bt.refId} className="text-sm border-l-2 border-primary/50 pl-3 py-1">
                      <div className="font-medium">
                        {idx + 1}. {bt.title}
                      </div>
                      {bt.blockedByRefs && bt.blockedByRefs.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Blocked by: {bt.blockedByRefs.join(', ')}
                        </div>
                      )}
                      {bt.subtaskTemplates && bt.subtaskTemplates.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {bt.subtaskTemplates.length} subtasks
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom variable inputs for blueprint */}
              {requiredCustomVars.length > 0 && (
                <div className="grid gap-3 border rounded-md p-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-500" />
                    <Label className="text-sm font-medium">Template Variables</Label>
                  </div>
                  {requiredCustomVars.map((varName) => (
                    <div key={varName} className="grid gap-1.5">
                      <Label htmlFor={`var-${varName}`} className="text-xs">
                        {varName}
                      </Label>
                      <Input
                        id={`var-${varName}`}
                        value={customVars[varName] || ''}
                        onChange={(e) => setCustomVars(prev => ({ ...prev, [varName]: e.target.value }))}
                        placeholder={`Enter ${varName}...`}
                        className="h-8"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter task title..."
                  autoFocus
                />
              </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the task..."
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypes.map((taskType) => {
                      const IconComponent = getTypeIcon(taskType.icon);
                      return (
                        <SelectItem key={taskType.id} value={taskType.id}>
                          <div className="flex items-center gap-2">
                            {IconComponent && <IconComponent className="h-4 w-4" />}
                            {taskType.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="project">Project (optional)</Label>
              {!showNewProject ? (
                <Select 
                  value={project} 
                  onValueChange={(value) => {
                    if (value === '__new__') {
                      setShowNewProject(true);
                      setNewProjectName('');
                    } else {
                      setProject(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No project</SelectItem>
                    {projects.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id}>
                        {proj.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__" className="text-primary">
                      + New Project
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newProjectName.trim()) {
                        e.preventDefault();
                        setProject(newProjectName.trim());
                        setShowNewProject(false);
                      }
                      if (e.key === 'Escape') {
                        setShowNewProject(false);
                        setNewProjectName('');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (newProjectName.trim()) {
                        setProject(newProjectName.trim());
                        setShowNewProject(false);
                      }
                    }}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowNewProject(false);
                      setNewProjectName('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Sprint */}
            <div className="grid gap-2">
              <Label>Sprint (optional)</Label>
              <Select value={sprint || '__none__'} onValueChange={(v) => setSprint(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No sprint" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Sprint</SelectItem>
                  <SelectItem value="US-200">US-200</SelectItem>
                  <SelectItem value="US-300">US-300</SelectItem>
                  <SelectItem value="US-400">US-400</SelectItem>
                  <SelectItem value="US-500">US-500</SelectItem>
                  <SelectItem value="US-600">US-600</SelectItem>
                  <SelectItem value="US-700">US-700</SelectItem>
                  <SelectItem value="US-800">US-800</SelectItem>
                  <SelectItem value="US-900">US-900</SelectItem>
                  <SelectItem value="US-1000">US-1000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom variable inputs */}
            {requiredCustomVars.length > 0 && (
              <div className="grid gap-3 border rounded-md p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  <Label className="text-sm font-medium">Template Variables</Label>
                </div>
                {requiredCustomVars.map((varName) => (
                  <div key={varName} className="grid gap-1.5">
                    <Label htmlFor={`var-${varName}`} className="text-xs">
                      {varName}
                    </Label>
                    <Input
                      id={`var-${varName}`}
                      value={customVars[varName] || ''}
                      onChange={(e) => setCustomVars(prev => ({ ...prev, [varName]: e.target.value }))}
                      placeholder={`Enter ${varName}...`}
                      className="h-8"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Subtasks from template */}
            {subtasks.length > 0 && (
              <div className="grid gap-2">
                <Label>Subtasks ({subtasks.length})</Label>
                <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Check className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{subtask.title}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeSubtask(subtask.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          )}
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={
                (selectedTemplate && templates?.find(t => t.id === selectedTemplate)?.blueprint 
                  ? false 
                  : !title.trim()) || createTask.isPending
              }
            >
              {createTask.isPending ? 'Creating...' : 
                selectedTemplate && templates?.find(t => t.id === selectedTemplate)?.blueprint 
                  ? 'Create Tasks' 
                  : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
