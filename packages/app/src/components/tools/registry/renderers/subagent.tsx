import { Bot, Check, X, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { createElement, useState } from "react";
import { cn } from "@/lib/utils";
import { registerToolRenderer } from "../registry.js";

// ─── Types ────────────────────────────────────────────────────────────

interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

interface SingleResult {
  agent: string;
  agentSource: "user" | "workspace" | "unknown";
  task: string;
  exitCode: number;
  messages: any[];
  stderr: string;
  usage: UsageStats;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
  step?: number;
}

interface SubagentDetails {
  mode: "single" | "parallel" | "chain";
  agentScope: string;
  workspaceAgentsDir: string | null;
  results: SingleResult[];
}

// ─── Utility Functions ─────────────────────────────────────────────────

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

function formatUsage(usage: UsageStats, model?: string): string {
  const parts: string[] = [];
  if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
  if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
  if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
  if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
  if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
  if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
  if (usage.contextTokens && usage.contextTokens > 0) {
    parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
  }
  if (model) parts.push(model);
  return parts.join(" ");
}

function getFinalOutput(messages: any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      for (const part of msg.content) {
        if (part.type === "text") return part.text;
      }
    }
  }
  return "";
}

// ─── Subagent Result Component ─────────────────────────────────────────

function SubagentResult({ result, isExpanded }: { result: SingleResult; isExpanded: boolean }) {
  const status = result.exitCode === 0 ? "success" : "error";
  const output = getFinalOutput(result.messages);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs">
        <div
          className={cn(
            "flex items-center justify-center w-4 h-4 rounded",
            status === "success" ? "bg-emerald-500/20" : "bg-red-500/20"
          )}
        >
          {status === "success" ? (
            <Check className="w-3 h-3 text-emerald-500" />
          ) : (
            <X className="w-3 h-3 text-red-500" />
          )}
        </div>
        <span className="font-medium text-foreground">{result.agent}</span>
        <span className="text-muted-foreground">({result.agentSource})</span>
        {result.model && (
          <span className="text-muted-foreground text-[10px]">• {result.model}</span>
        )}
      </div>

      {/* Usage Stats */}
      <div className="text-[10px] text-muted-foreground font-mono pl-6">
        {formatUsage(result.usage)}
      </div>

      {/* Output */}
      {isExpanded && (
        <div className="pl-6">
          {result.errorMessage ? (
            <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded">
              {result.errorMessage}
            </div>
          ) : output ? (
            <div className="text-xs bg-muted/30 p-3 rounded max-h-64 overflow-y-auto">
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
                {output}
              </pre>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">No output</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Result Component ─────────────────────────────────────────────

function SubagentOutput({ args, result: resultStr, isError }: { args: Record<string, unknown>; result: string; isError: boolean }) {
  const [expanded, setExpanded] = useState(false);

  // Parse the result JSON
  let details: SubagentDetails | null = null;
  try {
    details = JSON.parse(resultStr);
  } catch {
    // Not JSON, show as plain text
    return (
      <div className="p-3 text-xs font-mono whitespace-pre-wrap">
        {resultStr}
      </div>
    );
  }

  if (!details || !details.results || details.results.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No subagent results
      </div>
    );
  }

  const { mode, results } = details;

  // Get mode display info
  const modeLabels = {
    single: "Single Execution",
    parallel: "Parallel Execution",
    chain: "Chain Execution",
  };

  // Aggregate usage for all results
  const totalUsage: UsageStats = {
    input: results.reduce((sum, r) => sum + r.usage.input, 0),
    output: results.reduce((sum, r) => sum + r.usage.output, 0),
    cacheRead: results.reduce((sum, r) => sum + r.usage.cacheRead, 0),
    cacheWrite: results.reduce((sum, r) => sum + r.usage.cacheWrite, 0),
    cost: results.reduce((sum, r) => sum + r.usage.cost, 0),
    contextTokens: Math.max(...results.map(r => r.usage.contextTokens), 0),
    turns: results.reduce((sum, r) => sum + r.usage.turns, 0),
  };

  // Count success/failure
  const successCount = results.filter(r => r.exitCode === 0).length;
  const failCount = results.filter(r => r.exitCode !== 0).length;

  return (
    <div className="space-y-3 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">
            {modeLabels[mode]}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {results.length} agent{results.length > 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <>
              <ChevronDown className="w-3 h-3" />
              <span>Collapse</span>
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3" />
              <span>Expand</span>
            </>
          )}
        </button>
      </div>

      {/* Status Summary */}
      <div className="flex items-center gap-3 text-[10px]">
        {successCount > 0 && (
          <div className="flex items-center gap-1 text-emerald-500">
            <Check className="w-3 h-3" />
            <span>{successCount} succeeded</span>
          </div>
        )}
        {failCount > 0 && (
          <div className="flex items-center gap-1 text-red-500">
            <X className="w-3 h-3" />
            <span>{failCount} failed</span>
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {results.map((result, index) => (
          <div key={index}>
            {mode === "chain" && (
              <div className="text-[10px] text-muted-foreground mb-1 pl-6">
                Step {index + 1}
              </div>
            )}
            <SubagentResult result={result} isExpanded={expanded} />
          </div>
        ))}
      </div>

      {/* Total Usage */}
      {expanded && (
        <div className="pt-2 border-t border-border/30">
          <div className="text-[10px] text-muted-foreground">
            <span className="font-medium">Total:</span>{" "}
            {formatUsage(totalUsage)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Functions ─────────────────────────────────────────────────

function getSubagentSummary(args: Record<string, unknown>): string {
  const mode = args.chain ? "chain" : args.tasks ? "parallel" : "single";

  if (mode === "single" && args.agent && args.task) {
    return `${args.agent}: ${String(args.task).slice(0, 80)}`;
  }

  if (mode === "parallel" && Array.isArray(args.tasks)) {
    const count = args.tasks.length;
    const agents = args.tasks.map((t: any) => t.agent).filter(Boolean);
    return `${count} task${count > 1 ? "s" : ""} (${[...new Set(agents)].join(", ")})`;
  }

  if (mode === "chain" && Array.isArray(args.chain)) {
    const count = args.chain.length;
    return `${count} step${count > 1 ? "s" : ""} chain`;
  }

  return "subagent task";
}

// ─── Register Renderer ─────────────────────────────────────────────────

registerToolRenderer("subagent", {
  icon: createElement(Bot, { className: "w-3.5 h-3.5" }),
  getSummary: getSubagentSummary,
  getFullSummary: (args) => {
    const mode = args.chain ? "chain" : args.tasks ? "parallel" : "single";
    if (mode === "single") {
      return `${args.agent}: ${args.task}`;
    }
    if (mode === "parallel" && Array.isArray(args.tasks)) {
      return args.tasks.map((t: any) => `${t.agent}: ${t.task}`).join("; ");
    }
    if (mode === "chain" && Array.isArray(args.chain)) {
      return args.chain.map((s: any) => s.agent).join(" → ");
    }
    return getSubagentSummary(args);
  },
  ResultComponent: ({ args, result, isError }) =>
    createElement(SubagentOutput, { args, result, isError }),
});
