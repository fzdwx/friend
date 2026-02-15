/**
 * Questionnaire Tool - Ask user questions and wait for responses
 *
 * This tool allows the agent to ask one or multiple questions and wait for responses.
 * Features:
 * - Single or multiple questions
 * - Single-select or multi-select options
 * - Custom text input support
 *
 * The tool works by:
 * 1. Sending a question_request event to the frontend
 * 2. Creating a Promise that waits for user responses
 * 3. The Promise is resolved when the user answers (via /sessions/:id/answer-question API)
 */

import { Type, type Static } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { Question, QuestionAnswer, QuestionnaireResult } from "@friend/shared";

// ─── Tool Parameters Schema ────────────────────────────────

const QuestionOptionSchema = Type.Object({
  label: Type.String({ description: "Display label for the option" }),
  description: Type.Optional(Type.String({ description: "Optional description shown below label" })),
  value: Type.Optional(Type.String({ description: "Value to return if different from label (defaults to label)" })),
});

const QuestionSchema = Type.Object({
  id: Type.Optional(Type.String({ description: "Unique ID for this question (auto-generated if not provided)" })),
  label: Type.Optional(Type.String({ description: "Short label for display (e.g., 'Framework')" })),
  question: Type.String({ description: "The question text" }),
  options: Type.Array(QuestionOptionSchema, { description: "Available options" }),
  allowOther: Type.Optional(Type.Boolean({ description: "Allow custom text input (default: true)" })),
  multiSelect: Type.Optional(Type.Boolean({ description: "Allow multiple selections (default: false)" })),
});

export const QuestionParams = Type.Object({
  /** Single question (shorthand) */
  question: Type.Optional(Type.String({ description: "Single question text (shorthand, creates a single-question questionnaire)" })),
  options: Type.Optional(Type.Array(QuestionOptionSchema, { description: "Options for single question (shorthand)" })),
  allowOther: Type.Optional(Type.Boolean({ description: "Allow custom text input for single question" })),
  multiSelect: Type.Optional(Type.Boolean({ description: "Allow multiple selections for single question" })),
  /** Multiple questions (full mode) */
  questions: Type.Optional(Type.Array(QuestionSchema, { description: "Questions to ask (alternative to single question mode)" })),
});

// ─── AgentManager Interface Extension ────────────────────────

export interface IQuestionManager {
  /** Ask questions and wait for user responses */
  askQuestions(
    sessionId: string,
    questionId: string,
    questions: Question[],
  ): Promise<QuestionnaireResult>;

  /** Resolve a pending questionnaire with user's answers */
  resolveQuestionnaire(
    sessionId: string,
    answers: QuestionAnswer[],
    cancelled: boolean,
  ): boolean;
}

// ─── Tool Definition ───────────────────────────────────────

export function createQuestionTool(manager: IQuestionManager): ToolDefinition {
  return {
    name: "question",
    label: "Question",
    description:
      "Ask the user one or multiple questions and wait for their response. " +
      "Use this when you need user input to proceed, such as clarifying requirements, " +
      "getting preferences (e.g., choice of database or framework), or confirming decisions. " +
      "Supports single-select, multi-select, and custom text input.",
    parameters: QuestionParams,

    async execute(_toolCallId, params: Static<typeof QuestionParams>, signal, _onUpdate, ctx) {
      const sessionId = ctx.sessionManager.getSessionId();

      if (!sessionId) {
        return {
          content: [{ type: "text", text: "Error: No active session" }],
          details: { questionId: "", answers: [], cancelled: true },
        };
      }

      // Build questions array from either shorthand or full mode
      let questions: Question[];
      
      if (params.questions && params.questions.length > 0) {
        // Full mode: multiple questions
        questions = params.questions.map((q, i) => ({
          ...q,
          id: q.id || `q${i + 1}`,
          allowOther: q.allowOther !== false,
          multiSelect: q.multiSelect ?? false,
        }));
      } else if (params.question) {
        // Shorthand mode: single question
        questions = [{
          id: "q1",
          question: params.question,
          options: params.options || [],
          allowOther: params.allowOther !== false,
          multiSelect: params.multiSelect ?? false,
        }];
      } else {
        return {
          content: [{ type: "text", text: "Error: No questions provided" }],
          details: { questionId: "", answers: [], cancelled: true },
        };
      }

      // Generate unique questionnaire ID
      const questionId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      try {
        // Ask questions and wait for response
        const result = await manager.askQuestions(sessionId, questionId, questions);

        if (result.cancelled) {
          return {
            content: [{ type: "text", text: "User cancelled the questionnaire" }],
            details: { questionId, answers: [], cancelled: true },
          };
        }

        // Format response
        const lines: string[] = [];
        for (const answer of result.answers) {
          const q = questions.find(q => q.id === answer.questionId);
          if (!q) continue;
          
          if (answer.answers.length === 0) {
            lines.push(`${q.question}: (no answer)`);
          } else if (answer.wasCustom) {
            lines.push(`${q.question}: user wrote: ${answer.answers.join(", ")}`);
          } else {
            lines.push(`${q.question}: user selected: ${answer.answers.join(", ")}`);
          }
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          details: result,
        };
      } catch (err) {
        // Handle abort signal
        if (signal?.aborted) {
          return {
            content: [{ type: "text", text: "Questionnaire was cancelled" }],
            details: { questionId, answers: [], cancelled: true },
          };
        }

        return {
          content: [{ type: "text", text: `Error asking questions: ${String(err)}` }],
          details: { questionId, answers: [], cancelled: true },
        };
      }
    },
  };
}
