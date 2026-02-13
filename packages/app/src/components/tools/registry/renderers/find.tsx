import { FolderOpen } from "lucide-react";
import { createElement } from "react";
import { registerToolRenderer } from "../registry.js";
import {shortenPath} from "@/components/tools/utils";

registerToolRenderer("find", {
  icon: createElement(FolderOpen, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => {
    const glob = String(args.glob || "");
    const path = shortenPath(String(args.path || ""), 2);
    return glob ? `${glob} in ${path}` : path || ".";
  },
  getFullSummary: (args) => {
    const glob = String(args.glob || "");
    const path = String(args.path || "");
    return glob ? `${glob} in ${path}` : path || ".";
  },
});
