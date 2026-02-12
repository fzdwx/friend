import { FolderOpen } from "lucide-react";
import { createElement } from "react";
import { registerToolRenderer } from "../registry.js";

registerToolRenderer("find", {
  icon: createElement(FolderOpen, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => String(args.glob || args.path || ""),
});
