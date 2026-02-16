/**
 * Question Manager
 * 
 * Handles the question tool's pending questions and answers.
 */

import type { PendingQuestion, Question, QuestionAnswer, QuestionnaireResolveValue } from "@friend/shared";
import type { IQuestionManager, QuestionManagerDeps } from "./types.js";

interface PendingQuestionEntry {
  resolve: (value: QuestionnaireResolveValue) => void;
  questionId: string;
  questions: Question[];
}

export class QuestionManager implements IQuestionManager {
  private pendingQuestions = new Map<string, PendingQuestionEntry>();
  private readonly deps: QuestionManagerDeps;

  constructor(deps: QuestionManagerDeps) {
    this.deps = deps;
  }

  async askQuestions(
    sessionId: string,
    questionId: string,
    questions: Question[],
  ): Promise<QuestionnaireResolveValue> {
    // sessionId might be SDK sessionId, resolve to DB sessionId
    const dbSessionId = this.deps.resolveDbSessionId(sessionId) ?? sessionId;

    const managed = this.deps.getManagedSession(dbSessionId);
    if (!managed) {
      throw new Error(`Session ${dbSessionId} not found`);
    }

    // Create promise that will be resolved when user answers
    return new Promise((resolve) => {
      // Store pending questionnaire using DB sessionId
      this.pendingQuestions.set(dbSessionId, {
        resolve,
        questionId,
        questions,
      });

      // Persist to database (fire-and-forget)
      this.deps.savePendingQuestion(dbSessionId, { questionId, questions }).catch(err => {
        console.error(`[QuestionManager] Failed to persist pendingQuestion:`, err);
      });

      // Broadcast question request to frontend
      this.deps.broadcast(managed, {
        type: "question_request",
        questionId,
        questions,
      });
    });
  }

  resolveQuestionnaire(
    sessionId: string,
    answers: QuestionAnswer[],
    cancelled: boolean,
  ): boolean {
    const pending = this.pendingQuestions.get(sessionId);
    if (!pending) {
      return false;
    }

    // Remove pending questionnaire from memory
    this.pendingQuestions.delete(sessionId);

    // Clear from database (fire-and-forget)
    this.deps.clearPendingQuestion(sessionId).catch(err => {
      console.error(`[QuestionManager] Failed to clear pendingQuestion:`, err);
    });

    // Resolve the promise
    pending.resolve({
      questionId: pending.questionId,
      answers,
      cancelled,
    });

    return true;
  }

  getPendingQuestion(sessionId: string): PendingQuestion | null {
    const pending = this.pendingQuestions.get(sessionId);
    if (!pending) return null;
    return {
      questionId: pending.questionId,
      questions: pending.questions,
    };
  }

  /**
   * Restore pending question from database (called during init)
   */
  restorePendingQuestion(sessionId: string, question: PendingQuestion): void {
    // Re-create the Promise that will be resolved when user answers
    // Note: The promise is created to set up the resolver, but we don't need to await it
    void new Promise<QuestionnaireResolveValue>((resolve) => {
      this.pendingQuestions.set(sessionId, {
        resolve,
        questionId: question.questionId,
        questions: question.questions,
      });
    });
    console.log(`[QuestionManager] Restored pendingQuestion for session ${sessionId}`);
  }

  /**
   * Check if session has pending question
   */
  hasPendingQuestion(sessionId: string): boolean {
    return this.pendingQuestions.has(sessionId);
  }
}
