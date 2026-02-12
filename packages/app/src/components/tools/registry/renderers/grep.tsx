import { Search } from "lucide-react";
import { createElement } from "react";
import { registerToolRenderer } from "../registry.js";

registerToolRenderer("grep", {
  icon: createElement(Search, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => `/${String(args.pattern || "")}/ in ${String(args.path || ".")}`,
});
