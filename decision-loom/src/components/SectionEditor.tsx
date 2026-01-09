"use client";

import { useCallback, useRef, useState } from "react";
import { useSessionStore } from "@/store/session";
import { getSection } from "@/content/questions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Check,
  Loader2,
  HelpCircle,
} from "lucide-react";
import type { Suggestion } from "@/types/core";

export function SectionEditor() {
  const {
    sessionId,
    activeKey,
    answersByKey,
    summariesByKey,
    completedSections,
    suggestions,
    isLoading,
    updateAnswer,
    setNotes,
    setSummary,
    markSectionComplete,
    setSuggestions,
    clearSuggestions,
    setLoading,
    setError,
    setActiveKey,
    getNextSection,
    getPrevSection,
  } = useSessionStore();

  const section = getSection(activeKey);
  const sectionAnswers = answersByKey[activeKey];
  const summary = summariesByKey[activeKey];
  const isComplete = completedSections.has(activeKey);

  const [showWhyHints, setShowWhyHints] = useState<Record<string, boolean>>({});
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const saveToServer = useCallback(async () => {
    if (!sessionId) return;

    try {
      await fetch(`/api/session/${sessionId}/section`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: activeKey,
          qa: sectionAnswers.qa,
          notes: sectionAnswers.notes,
        }),
      });
    } catch (err) {
      console.error("Failed to save section:", err);
    }
  }, [sessionId, activeKey, sectionAnswers]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    updateAnswer(activeKey, questionId, answer);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      saveToServer();
    }, 800);
  };

  const handleNotesChange = (notes: string) => {
    setNotes(activeKey, notes);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      saveToServer();
    }, 800);
  };

  const handleGetSuggestions = async () => {
    if (!sessionId) return;

    setLoading(true);
    clearSuggestions();

    try {
      const currentText = sectionAnswers.qa
        .map((q) => `${q.question}\n${q.answer}`)
        .join("\n\n");

      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          key: activeKey,
          currentText,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSuggestions(data.data.suggestions);
      } else {
        setError(data.error.message);
      }
    } catch {
      setError("Failed to get suggestions");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSection = async () => {
    if (!sessionId) return;

    setLoading(true);

    try {
      await saveToServer();

      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          key: activeKey,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSummary(activeKey, data.data.summary);
        markSectionComplete(activeKey);

        const nextSection = getNextSection();
        if (nextSection) {
          setActiveKey(nextSection);
        }
      } else {
        setError(data.error.message);
      }
    } catch {
      setError("Failed to complete section");
    } finally {
      setLoading(false);
    }
  };

  const handleApplySuggestion = (suggestion: Suggestion) => {
    const currentNotes = sectionAnswers.notes || "";
    const newNotes = currentNotes
      ? `${currentNotes}\n\n• ${suggestion.text}`
      : `• ${suggestion.text}`;
    setNotes(activeKey, newNotes);
  };

  const prevSection = getPrevSection();
  const nextSection = getNextSection();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{section.label}</h1>
            <p className="text-muted-foreground">{section.goal}</p>
          </div>
          {isComplete && (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
              <Check className="h-4 w-4" />
              Complete
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {summary && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-800">
                Section Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-700">{summary}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {section.questions.map((question, index) => {
            const qaItem = sectionAnswers.qa.find(
              (q) => q.questionId === question.id
            );
            const showWhy = showWhyHints[question.id];

            return (
              <div key={question.id} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <label className="text-sm font-medium leading-relaxed">
                    {index + 1}. {question.prompt}
                  </label>
                  {question.why && (
                    <button
                      onClick={() =>
                        setShowWhyHints((prev) => ({
                          ...prev,
                          [question.id]: !prev[question.id],
                        }))
                      }
                      className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {showWhy && question.why && (
                  <p className="text-xs text-muted-foreground italic">
                    {question.why}
                  </p>
                )}

                <Textarea
                  value={qaItem?.answer || ""}
                  onChange={(e) =>
                    handleAnswerChange(question.id, e.target.value)
                  }
                  placeholder={question.placeholder}
                  className="min-h-[100px] resize-y"
                />
              </div>
            );
          })}

          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Notes</label>
            <Textarea
              value={sectionAnswers.notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Any additional thoughts, context, or notes for this section..."
              className="min-h-[80px] resize-y"
            />
          </div>
        </div>

        {suggestions.length > 0 && (
          <Card className="mt-6 border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-blue-800">
                <Lightbulb className="h-4 w-4" />
                AI Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.id}
                    className="flex items-start justify-between gap-2 rounded-md bg-white p-2 text-sm"
                  >
                    <div>
                      <span className="mr-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        {suggestion.type}
                      </span>
                      <span>{suggestion.text}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleApplySuggestion(suggestion)}
                      className="flex-shrink-0"
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="border-t bg-background p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => prevSection && setActiveKey(prevSection)}
            disabled={!prevSection}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGetSuggestions}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="mr-1 h-4 w-4" />
              )}
              Get Suggestions
            </Button>

            <Button onClick={handleCompleteSection} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1 h-4 w-4" />
              )}
              {isComplete ? "Update & Continue" : "Complete Section"}
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={() => nextSection && setActiveKey(nextSection)}
            disabled={!nextSection}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          {section.completionHint}
        </p>
      </div>
    </div>
  );
}
