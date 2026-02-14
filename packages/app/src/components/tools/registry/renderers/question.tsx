/**
 * Questionnaire tool renderer
 * Displays questionnaire tool calls and results in the UI
 */

import { HelpCircle, CheckCircle } from "lucide-react";
import { createElement } from "react";
import { cn } from "@/lib/utils";
import { registerToolRenderer } from "../registry.js";

function QuestionnaireResult({ args, result, isError }: {
  args: Record<string, unknown>;
  result: string;
  isError: boolean;
}) {
  const details = args.details as {
    questionId?: string;
    answers?: Array<{
      questionId: string;
      answers: string[];
      wasCustom?: boolean;
    }>;
    cancelled?: boolean;
  } | undefined;

  if (details?.cancelled) {
    return (
      <div className="p-3 text-sm text-muted-foreground italic">
        User cancelled
      </div>
    );
  }

  if (!details?.answers || details.answers.length === 0) {
    return (
      <div className="p-3 text-sm">
        {result}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {details.answers.map((answer, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-muted-foreground">Q{i + 1}: </span>
            <span className={cn(answer.wasCustom && "italic")}>
              {answer.answers.join(", ")}
              {answer.wasCustom && " (custom)"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

registerToolRenderer("question", {
  icon: createElement(HelpCircle, { className: "w-3.5 h-3.5" }),
  getSummary: (args) => {
    const questions = args.questions as Array<{ question?: string }> | undefined;
    if (questions && questions.length > 0) {
      const count = questions.length;
      const firstQ = String(questions[0]?.question || "").slice(0, 40);
      return `❓ ${count} question${count > 1 ? "s" : ""}: ${firstQ}...`;
    }
    
    const question = String(args.question || "").slice(0, 50);
    return `❓ ${question}${question.length >= 50 ? "..." : ""}`;
  },
  ResultComponent: ({ args, result, isError }) => 
    createElement(QuestionnaireResult, { args, result, isError }),
});
