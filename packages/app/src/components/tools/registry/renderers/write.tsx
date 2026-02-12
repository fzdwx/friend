import { FilePlus } from "lucide-react";
import { createElement } from "react";
import { registerToolRenderer } from "../registry.js";

registerToolRenderer("write", {
  icon: createElement(FilePlus, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => String(args.path || args.file_path || ""),
});
