/**
 * PlanEditor Component
 *
 * Displays and manages plan mode todos:
 * - Shows numbered steps with optional subtasks
 * - Allows editing step text
 * - Supports drag-and-drop reordering (main tasks only)
 * - Execute/Cancel buttons
 */

import { useState, useCallback } from "react";
import { GripVertical, Play, X, Check, Clock, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodoItem } from "@friend/shared";

interface PlanEditorProps {
  todos: TodoItem[];
  onExecute: (todos?: TodoItem[]) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function PlanEditor({ todos: initialTodos, onExecute, onCancel, disabled }: PlanEditorProps) {
  const [todos, setTodos] = useState<TodoItem[]>(initialTodos);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  // Toggle subtask expansion
  const toggleExpanded = useCallback((step: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  }, []);

  // Edit main task text
  const handleEditStep = useCallback((index: number, newText: string) => {
    setTodos((prev) =>
      prev.map((todo, i) => (i === index ? { ...todo, text: newText } : todo)),
    );
  }, []);

  // Edit subtask text
  const handleEditSubtask = useCallback((mainIndex: number, subIndex: number, newText: string) => {
    setTodos((prev) =>
      prev.map((todo, i) => {
        if (i === mainIndex && todo.subtasks) {
          const newSubtasks = todo.subtasks.map((sub, j) =>
            j === subIndex ? { ...sub, text: newText } : sub
          );
          return { ...todo, subtasks: newSubtasks };
        }
        return todo;
      }),
    );
  }, []);

  // Drag and drop handlers (main tasks only)
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDropTargetIndex(index);
    }
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dropTargetIndex !== null && draggedIndex !== dropTargetIndex) {
      setTodos((prev) => {
        const newTodos = [...prev];
        const [removed] = newTodos.splice(draggedIndex, 1);
        newTodos.splice(dropTargetIndex, 0, removed);
        return newTodos.map((todo, i) => ({ ...todo, step: i + 1 }));
      });
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
  }, [draggedIndex, dropTargetIndex]);

  const handleExecute = useCallback(() => {
    // Check if todos were modified
    const hasChanges = JSON.stringify(todos) !== JSON.stringify(initialTodos);
    onExecute(hasChanges ? todos : undefined);
  }, [todos, initialTodos, onExecute]);

  // Count total steps including subtasks
  const totalSteps = todos.reduce((acc, todo) => acc + 1 + (todo.subtasks?.length || 0), 0);

  return (
    <div className="plan-editor bg-secondary/30 border border-border rounded-lg p-4 my-3 max-h-[60vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-500" />
          <span className="font-medium text-sm">Plan Mode</span>
          <span className="text-xs text-muted-foreground">({totalSteps} steps)</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Drag to reorder • Click to edit
        </div>
      </div>

      {/* Todo List - scrollable */}
      <div className="space-y-1 overflow-y-auto flex-1 min-h-0">
        {todos.map((todo, index) => {
          const hasSubtasks = todo.subtasks && todo.subtasks.length > 0;
          const isExpanded = expandedTasks.has(todo.step);

          return (
            <div key={todo.step}>
              {/* Main Task */}
              <div
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDrop={handleDragEnd}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md bg-background/50 border border-border/50",
                  "transition-all duration-150",
                  draggedIndex === index && "opacity-50 scale-95",
                  dropTargetIndex === index && "border-primary border-dashed",
                  "cursor-grab active:cursor-grabbing",
                )}
              >
                {/* Drag Handle */}
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                {/* Expand/Collapse button */}
                {hasSubtasks ? (
                  <button
                    onClick={() => toggleExpanded(todo.step)}
                    className="p-0.5 hover:bg-secondary rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                ) : (
                  <div className="w-4" />
                )}

                {/* Step Number */}
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {todo.step}
                </span>

                {/* Step Text */}
                <input
                  type="text"
                  value={todo.text}
                  onChange={(e) => handleEditStep(index, e.target.value)}
                  disabled={disabled}
                  className="flex-1 bg-transparent text-sm outline-none border-b border-transparent focus:border-primary/50 px-1 py-0.5"
                />

                {/* Completed indicator */}
                {todo.completed && (
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}

                {/* Subtask count badge */}
                {hasSubtasks && (
                  <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {todo.subtasks!.length}
                  </span>
                )}
              </div>

              {/* Subtasks */}
              {hasSubtasks && isExpanded && (
                <div className="ml-8 mt-1 space-y-1">
                  {todo.subtasks!.map((subtask, subIndex) => (
                    <div
                      key={`${todo.step}.${subtask.step}`}
                      className="flex items-center gap-2 p-2 rounded-md bg-background/30 border border-border/30"
                    >
                      {/* Step Number */}
                      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-muted text-muted-foreground text-xs">
                        {todo.step}.{subtask.step}
                      </span>

                      {/* Step Text */}
                      <input
                        type="text"
                        value={subtask.text}
                        onChange={(e) => handleEditSubtask(index, subIndex, e.target.value)}
                        disabled={disabled}
                        className="flex-1 bg-transparent text-sm outline-none border-b border-transparent focus:border-primary/50 px-1 py-0.5"
                      />

                      {/* Completed indicator */}
                      {subtask.completed && (
                        <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border flex-shrink-0">
        <button
          onClick={handleExecute}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            disabled
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          <Play className="w-3.5 h-3.5" />
          Execute Plan
        </button>
        <button
          onClick={onCancel}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            "border border-border hover:bg-secondary",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * PlanProgress Component
 *
 * Shows progress during plan execution.
 */
interface PlanProgressProps {
  completed: number;
  total: number;
  todos: TodoItem[];
}

export function PlanProgress({ completed, total, todos }: PlanProgressProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="plan-progress bg-secondary/30 border border-border rounded-lg p-3 my-2 max-h-[40vh] flex flex-col">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <span className="text-sm font-medium">Executing Plan</span>
        <span className="text-xs text-muted-foreground">
          {completed}/{total} steps
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden flex-shrink-0">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Current Steps - scrollable */}
      <div className="mt-2 space-y-0.5 overflow-y-auto flex-1 min-h-0">
        {todos.map((todo) => (
          <div key={todo.step}>
            {/* Main task */}
            <div
              className={cn(
                "flex items-center gap-2 text-xs py-0.5",
                todo.completed ? "text-muted-foreground line-through" : "text-foreground",
              )}
            >
              {todo.completed ? (
                <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
              ) : (
                <div className="w-3 h-3 rounded-full border border-muted-foreground/50 flex-shrink-0" />
              )}
              <span className="truncate">{todo.step}. {todo.text}</span>
            </div>
            {/* Subtasks */}
            {todo.subtasks?.map((subtask) => (
              <div
                key={`${todo.step}.${subtask.step}`}
                className={cn(
                  "flex items-center gap-2 text-xs py-0.5 ml-4",
                  subtask.completed ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                {subtask.completed ? (
                  <Check className="w-2.5 h-2.5 text-green-500 flex-shrink-0" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full border border-muted-foreground/50 flex-shrink-0" />
                )}
                <span className="truncate text-[11px]">
                  {todo.step}.{subtask.step}. {subtask.text}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
