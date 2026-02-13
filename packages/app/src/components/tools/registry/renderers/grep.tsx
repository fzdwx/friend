import { Search } from "lucide-react";
import { createElement } from "react";
import { registerToolRenderer } from "../registry.js";
import {shortenPath} from "@/components/tools/utils";

registerToolRenderer("grep", {
  icon: createElement(Search, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => {
    const pattern = String(args.pattern || "");
    const path = shortenPath(String(args.path || "."), 2);
    return `/${pattern}/ in ${path}`;
  },
  getFullSummary: (args) => {
    const pattern = String(args.pattern || "");
    const path = String(args.path || ".");
    return `/${pattern}/ in ${path}`;
  },
});
