/**
 * QuestionnaireCard Component
 *
 * Displays a questionnaire in the message list (not modal).
 * Features:
 * - Single card with question navigation
 * - Single-select and multi-select support
 * - Custom text input
 * - Progress indicator
 */

import { useState, useCallback } from "react";
import { HelpCircle, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
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
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = questionAnswers.get(currentQuestion?.id || "");
  const isLastQuestion = currentIndex === questions.length - 1;
  const isFirstQuestion = currentIndex === 0;

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

  const goToNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, questions.length]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

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

  const hasCurrentAnswer = currentAnswer && (
    currentAnswer.selected.size > 0 || 
    (currentAnswer.useCustom && currentAnswer.customText.trim())
  );

  const answeredCount = Array.from(questionAnswers.values()).filter(
    a => a.selected.size > 0 || (a.useCustom && a.customText.trim())
  ).length;

  if (!currentQuestion) return null;

  return (
    <div className="questionnaire-card bg-secondary/30 border border-border rounded-lg p-4 my-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">{t("question.title")}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {questions.map((q, i) => {
              const answer = questionAnswers.get(q.id);
              const hasAnswer = answer && (
                answer.selected.size > 0 || 
                (answer.useCustom && answer.customText.trim())
              );
              return (
                <div
                  key={q.id}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i === currentIndex
                      ? "bg-primary"
                      : hasAnswer
                        ? "bg-green-500"
                        : "bg-muted-foreground/30"
                  )}
                />
              );
            })}
          </div>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </div>

      {/* Question */}
      <div className="mb-3">
        <div className="flex items-start gap-2 mb-3">
          {currentQuestion.multiSelect && (
            <span className="text-xs bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
              Multi
            </span>
          )}
          <span className="text-sm font-medium flex-1">{currentQuestion.question}</span>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {currentQuestion.options.map((option, optIndex) => {
            const value = option.value ?? option.label;
            const isSelected = currentAnswer?.selected.has(value);

            return (
              <button
                key={optIndex}
                onClick={() => toggleOption(currentQuestion.id, value, currentQuestion.multiSelect || false)}
                disabled={isSubmitting || currentAnswer?.useCustom}
                className={cn(
                  "w-full text-left p-2.5 rounded border transition-all text-sm",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                  currentAnswer?.useCustom && "opacity-50",
                )}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={cn(
                      "w-4 h-4 flex-shrink-0 mt-0.5 flex items-center justify-center",
                      currentQuestion.multiSelect ? "rounded" : "rounded-full",
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
          {currentQuestion.allowOther !== false && (
            <div className="mt-2">
              <input
                type="text"
                value={currentAnswer?.customText || ""}
                onChange={(e) => setCustomText(currentQuestion.id, e.target.value)}
                placeholder={t("question.typeSomething")}
                disabled={isSubmitting}
                className={cn(
                  "w-full p-2.5 rounded border text-sm",
                  currentAnswer?.useCustom
                    ? "border-primary bg-primary/5"
                    : "border-border focus:border-primary/50",
                  "bg-background disabled:opacity-50",
                )}
              />
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
        {questions.length > 1 && (
          <button
            onClick={goToPrev}
            disabled={isFirstQuestion || isSubmitting}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm transition-colors",
              "border border-border hover:bg-secondary",
              (isFirstQuestion || isSubmitting) && "opacity-50 cursor-not-allowed",
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            {t("common.back")}
          </button>
        )}
        
        <div className="flex-1" />
        
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
        
        {!isLastQuestion ? (
          <button
            onClick={goToNext}
            disabled={!hasCurrentAnswer || isSubmitting}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              hasCurrentAnswer && !isSubmitting
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            {t("common.next")}
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              isSubmitting && "opacity-50 cursor-not-allowed",
            )}
          >
            <Check className="w-3.5 h-3.5" />
            {t("common.submit")}
          </button>
        )}
      </div>
    </div>
  );
}
