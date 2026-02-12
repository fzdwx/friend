import { List } from "lucide-react";
import { createElement } from "react";
import { registerToolRenderer } from "../registry.js";

registerToolRenderer("ls", {
  icon: createElement(List, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => String(args.path || "."),
});
