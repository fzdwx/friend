import { create } from "zustand";

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "running" | "completed" | "error";
  result?: string;
  isError?: boolean;
  startTime: string;
  endTime?: string;
}

interface ToolState {
  executions: ToolExecution[];
  activeToolCallIds: Set<string>;

  addExecution: (exec: ToolExecution) => void;
  updateExecution: (toolCallId: string, result: string) => void;
  completeExecution: (toolCallId: string, result: string, isError: boolean) => void;
  clearExecutions: () => void;
}

export const useToolStore = create<ToolState>((set) => ({
  executions: [],
  activeToolCallIds: new Set(),

  addExecution: (exec) =>
    set((s) => ({
      executions: [exec, ...s.executions],
      activeToolCallIds: new Set([...s.activeToolCallIds, exec.toolCallId]),
    })),

  updateExecution: (toolCallId, result) =>
    set((s) => ({
      executions: s.executions.map((e) => (e.toolCallId === toolCallId ? { ...e, result } : e)),
    })),

  completeExecution: (toolCallId, result, isError) =>
    set((s) => {
      const newActive = new Set(s.activeToolCallIds);
      newActive.delete(toolCallId);
      return {
        executions: s.executions.map((e) =>
          e.toolCallId === toolCallId
            ? {
                ...e,
                result,
                isError,
                status: isError ? ("error" as const) : ("completed" as const),
                endTime: new Date().toISOString(),
              }
            : e,
        ),
        activeToolCallIds: newActive,
      };
    }),

  clearExecutions: () => set({ executions: [], activeToolCallIds: new Set() }),
}));
