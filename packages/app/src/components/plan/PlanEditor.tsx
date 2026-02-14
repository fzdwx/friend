/**
 * PlanEditor Component
 *
 * Displays and manages plan mode todos:
 * - Shows numbered steps with optional subtasks
 * - Allows editing step text
 * - Supports drag-and-drop reordering (main tasks only)
 * - Execute/Cancel buttons
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { GripVertical, Play, X, Check, Clock, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodoItem } from "@friend/shared";
import { useTranslation } from "react-i18next";

interface PlanEditorProps {
  todos: TodoItem[];
  onExecute: (todos?: TodoItem[]) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function PlanEditor({ todos: initialTodos, onExecute, onCancel, disabled }: PlanEditorProps) {
  const { t } = useTranslation();
  const [todos, setTodos] = useState<TodoItem[]>(initialTodos);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  // Sync todos when props change (e.g., after plan modification)
  useEffect(() => {
    // Only update if the todos are actually different
    if (JSON.stringify(todos) !== JSON.stringify(initialTodos)) {
      setTodos(initialTodos);
    }
  }, [initialTodos]);

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
    <div className="plan-editor bg-secondary/30 border border-border rounded-lg p-4 my-3  max-h-[400px]  flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-500" />
          <span className="font-medium text-sm">{t("plan.title")}</span>
          <span className="text-xs text-muted-foreground">({t("plan.steps", { count: totalSteps })})</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {t("plan.dragToReorder")} • {t("plan.clickToEdit")}
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
          {t("plan.executePlan")}
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
          {t("plan.cancel")}
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
  const { t } = useTranslation();
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // Find first incomplete task (the one being executed)
  const currentTaskIndex = todos.findIndex(t => !t.completed);
  
  // Ref for auto-scrolling to current task
  const currentTaskRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to current task when it changes
  useEffect(() => {
    if (currentTaskRef.current && containerRef.current) {
      const container = containerRef.current;
      const task = currentTaskRef.current;
      const containerRect = container.getBoundingClientRect();
      const taskRect = task.getBoundingClientRect();
      
      // Check if task is outside visible area
      if (taskRect.top < containerRect.top || taskRect.bottom > containerRect.bottom) {
        task.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentTaskIndex]);

  return (
    <div className="plan-progress bg-secondary/30 border border-border rounded-lg p-3 my-2 max-h-[200px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <span className="text-sm font-medium">{t("plan.executing")}</span>
        <span className="text-xs text-muted-foreground">
          {t("plan.stepProgress", { completed, total })}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden flex-shrink-0 mb-2">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Current Steps - only show main tasks, collapse subtasks */}
      <div ref={containerRef} className="space-y-1 overflow-y-auto flex-1 min-h-0">
        {todos.map((todo, index) => {
          const isCurrent = index === currentTaskIndex;
          const subtaskProgress = todo.subtasks 
            ? `${todo.subtasks.filter(s => s.completed).length}/${todo.subtasks.length}`
            : null;
          
          return (
            <div
              key={todo.step}
              ref={isCurrent ? currentTaskRef : null}
              className={cn(
                "flex items-center gap-2 text-xs py-1 px-2 rounded",
                todo.completed ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {todo.completed ? (
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : isCurrent ? (
                <svg 
                  className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" 
                  viewBox="0 0 24 24" 
                  fill="none"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/50 flex-shrink-0" />
              )}
              <span className={cn("truncate flex-1", todo.completed && "line-through")}>
                {todo.step}. {todo.text}
              </span>
              {subtaskProgress && !todo.completed && (
                <span className="text-[10px] text-muted-foreground">
                  ({subtaskProgress})
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
