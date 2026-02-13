import { List } from "lucide-react";
import { createElement } from "react";
import { registerToolRenderer } from "../registry.js";
import {shortenPath} from "@/components/tools/utils";

registerToolRenderer("ls", {
  icon: createElement(List, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => shortenPath(String(args.path || "."), 2),
  getFullSummary: (args) => String(args.path || "."),
});
