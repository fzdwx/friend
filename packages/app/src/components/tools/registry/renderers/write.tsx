import { FilePlus } from "lucide-react";
import { createElement } from "react";
import { registerToolRenderer } from "../registry.js";
import {shortenPath} from "@/components/tools/utils";

registerToolRenderer("write", {
  icon: createElement(FilePlus, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => shortenPath(String(args.path || args.file_path || ""), 3),
  getFullSummary: (args) => String(args.path || args.file_path || ""),
});
