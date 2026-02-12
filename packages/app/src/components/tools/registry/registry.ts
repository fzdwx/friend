import { Terminal } from "lucide-react";
import { createElement } from "react";
import type { ToolRendererEntry } from "./types.js";

const rendererMap = new Map<string, ToolRendererEntry>();

const defaultEntry: ToolRendererEntry = {
  icon: createElement(Terminal, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => JSON.stringify(args).slice(0, 100),
};

export function registerToolRenderer(name: string, entry: ToolRendererEntry) {
  rendererMap.set(name, entry);
}

export function getToolRenderer(name: string): ToolRendererEntry {
  return rendererMap.get(name) ?? defaultEntry;
}
