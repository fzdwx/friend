/**
 * QuestionnaireCard Component
 *
 * Displays a questionnaire in the message list (not modal).
 * Features:
 * - Multiple questions with tabs
 * - Single-select and multi-select support
 * - Custom text input
 * - Submit/Cancel buttons
 */

import { useState, useCallback } from "react";
import { HelpCircle, Check, X, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Question, QuestionAnswer } from "@friend/shared";
import { useTranslation } from "react-i18next";

interface QuestionnaireCardProps {
  questionId: string;
  questions: Question[];
  onAnswer: (answers: QuestionAnswer[]) => Promise<void>;
  onCancel: () => Promise<void>;
}

export function QuestionnaireCard({
  questionId,
  questions,
  onAnswer,
  onCancel,
}: QuestionnaireCardProps) {
  const { t } = useTranslation();
  
  // State for each question's answers
  const [questionAnswers, setQuestionAnswers] = useState<Map<string, {
    selected: Set<string>;
    customText: string;
    useCustom: boolean;
  }>>(() => {
    const map = new Map();
    questions.forEach(q => {
      map.set(q.id, { selected: new Set(), customText: "", useCustom: false });
    });
    return map;
  });
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    new Set(questions.map(q => q.id))
  );

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = questionAnswers.get(currentQuestion?.id || "");

  const toggleQuestion = useCallback((questionId: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  const toggleOption = useCallback((questionId: string, value: string, multiSelect: boolean) => {
    setQuestionAnswers(prev => {
      const answer = prev.get(questionId);
      if (!answer) return prev;
      
      const newSelected = new Set(answer.selected);
      if (multiSelect) {
        if (newSelected.has(value)) {
          newSelected.delete(value);
        } else {
          newSelected.add(value);
        }
      } else {
        newSelected.clear();
        newSelected.add(value);
      }
      
      return new Map(prev).set(questionId, {
        ...answer,
        selected: newSelected,
        useCustom: false,
      });
    });
  }, []);

  const setCustomText = useCallback((questionId: string, text: string) => {
    setQuestionAnswers(prev => {
      const answer = prev.get(questionId);
      if (!answer) return prev;
      
      return new Map(prev).set(questionId, {
        ...answer,
        customText: text,
        useCustom: true,
      });
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const answers: QuestionAnswer[] = [];
    for (const q of questions) {
      const answer = questionAnswers.get(q.id);
      if (!answer) continue;
      
      if (answer.useCustom && answer.customText.trim()) {
        answers.push({
          questionId: q.id,
          answers: [answer.customText.trim()],
          wasCustom: true,
        });
      } else if (answer.selected.size > 0) {
        answers.push({
          questionId: q.id,
          answers: Array.from(answer.selected),
          wasCustom: false,
        });
      }
    }

    await onAnswer(answers);
  }, [isSubmitting, questions, questionAnswers, onAnswer]);

  const isComplete = questions.every(q => {
    const answer = questionAnswers.get(q.id);
    if (!answer) return false;
    return (answer.selected.size > 0) || (answer.useCustom && answer.customText.trim());
  });

  return (
    <div className="questionnaire-card bg-secondary/30 border border-border rounded-lg p-4 my-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">{t("question.title")}</span>
          <span className="text-xs text-muted-foreground">
            ({questions.length} {questions.length === 1 ? "question" : "questions"})
          </span>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {questions.map((q, index) => {
          const answer = questionAnswers.get(q.id);
          if (!answer) return null;
          
          const isExpanded = expandedQuestions.has(q.id);
          const hasAnswer = answer.selected.size > 0 || (answer.useCustom && answer.customText.trim());

          return (
            <div key={q.id} className="border border-border/50 rounded-md overflow-hidden">
              {/* Question Header */}
              <button
                onClick={() => toggleQuestion(q.id)}
                className="w-full flex items-center gap-2 p-3 bg-background/50 hover:bg-secondary/30 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="flex-1 text-sm font-medium">{q.question}</span>
                {hasAnswer && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
                {q.multiSelect && (
                  <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    Multi
                  </span>
                )}
              </button>

              {/* Options (collapsible) */}
              {isExpanded && (
                <div className="p-3 pt-0 space-y-2">
                  {q.options.map((option, optIndex) => {
                    const value = option.value ?? option.label;
                    const isSelected = answer.selected.has(value);

                    return (
                      <button
                        key={optIndex}
                        onClick={() => toggleOption(q.id, value, q.multiSelect || false)}
                        disabled={isSubmitting || answer.useCustom}
                        className={cn(
                          "w-full text-left p-2 rounded border transition-all text-sm",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50",
                          answer.useCustom && "opacity-50",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              "w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center",
                              q.multiSelect ? "rounded" : "rounded-full",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "border border-muted-foreground",
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{option.label}</div>
                            {option.description && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {option.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Custom text input */}
                  {q.allowOther !== false && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={answer.customText}
                        onChange={(e) => setCustomText(q.id, e.target.value)}
                        placeholder={t("question.typeSomething")}
                        disabled={isSubmitting}
                        className={cn(
                          "w-full p-2 rounded border text-sm",
                          answer.useCustom
                            ? "border-primary bg-primary/5"
                            : "border-border focus:border-primary/50",
                          "bg-background disabled:opacity-50",
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !isComplete}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            isComplete && !isSubmitting
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          <Check className="w-3.5 h-3.5" />
          {t("common.submit")}
        </button>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            "border border-border hover:bg-secondary",
            isSubmitting && "opacity-50 cursor-not-allowed",
          )}
        >
          <X className="w-3.5 h-3.5" />
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
