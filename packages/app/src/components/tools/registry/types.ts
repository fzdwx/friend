import type { ReactNode, ComponentType } from "react";

export interface ToolResultProps {
  args: Record<string, unknown>;
  result: string;
  isError: boolean;
}

export interface ToolRendererEntry {
  icon: ReactNode;
  getSummary: (args: Record<string, unknown>) => string;
  /** Optional: returns full path/info for tooltip. If not provided, uses getSummary result. */
  getFullSummary?: (args: Record<string, unknown>) => string;
  ResultComponent?: ComponentType<ToolResultProps>;
}
