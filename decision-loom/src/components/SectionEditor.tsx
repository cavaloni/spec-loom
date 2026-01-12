"use client";

import { useCallback, useRef, useState } from "react";
import { useSessionStore } from "@/store/session";
import { getSection } from "@/content/questions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
    isPrefilling,
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
    <div className="flex h-full flex-col bg-[#FDFCF9]">
      <div className="border-b border-[#8C7B50]/20 bg-[#FDFCF9] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-['Libre_Baskerville'] text-[#1C1C1C]">{section.label}</h1>
            <p className="text-muted-foreground font-['Inter'] text-[#1C1C1C]/80">{section.goal}</p>
          </div>
          {isComplete && (
            <span className="flex items-center gap-1 rounded-none bg-[#8C7B50]/10 px-3 py-1 text-sm font-['Libre_Baskerville'] text-[#8C7B50] border border-[#8C7B50]/30">
              <Check className="h-4 w-4" />
              Complete
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 [&>*]:relative">
        {/* Subtle dot grid pattern overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} />

        {summary && (
          <Card className="mb-6 rounded-none border-[#8C7B50]/30 bg-[#FDFCF9] shadow-sm relative">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium font-['JetBrains_Mono'] uppercase tracking-wider text-[#8C7B50]">
                Section Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-['Inter'] text-[#1C1C1C] leading-relaxed">{summary}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6 relative">
          {section.questions.map((question, index) => {
            const qaItem = sectionAnswers.qa.find(
              (q) => q.questionId === question.id
            );
            const showWhy = showWhyHints[question.id];
            const isAnswerEmpty = !qaItem?.answer?.trim();
            const showSkeleton = isPrefilling && isAnswerEmpty;

            return (
              <div key={question.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <label className="text-sm font-medium font-['Libre_Baskerville'] leading-relaxed text-[#1C1C1C]">
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
                      className="flex-shrink-0 text-[#8C7B50] hover:text-[#6B5B3F] transition-colors"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {showWhy && question.why && (
                  <p className="text-xs font-['Libre_Baskerville'] italic text-[#8C7B50]/80 pl-3 border-l-2 border-[#8C7B50]/30">
                    {question.why}
                  </p>
                )}

                {showSkeleton ? (
                  <div className="min-h-[100px] rounded-none border border-[#1C1C1C]/20 bg-transparent p-3 space-y-2">
                    <Skeleton className="h-4 w-full bg-[#8C7B50]/10" />
                    <Skeleton className="h-4 w-[90%] bg-[#8C7B50]/10" />
                    <Skeleton className="h-4 w-[75%] bg-[#8C7B50]/10" />
                  </div>
                ) : (
                  <Textarea
                    value={qaItem?.answer || ""}
                    onChange={(e) =>
                      handleAnswerChange(question.id, e.target.value)
                    }
                    placeholder={question.placeholder}
                    className="min-h-[100px] resize-y rounded-none border-[#1C1C1C]/20 bg-transparent font-['Inter'] text-[#1C1C1C] placeholder:text-[#1C1C1C]/40 focus:border-[#8C7B50] focus:ring-0 transition-colors"
                  />
                )}
              </div>
            );
          })}

          <div className="space-y-2">
            <label className="text-sm font-medium font-['Libre_Baskerville'] text-[#1C1C1C]">Additional Notes</label>
            <Textarea
              value={sectionAnswers.notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Any additional thoughts, context, or notes for this section..."
              className="min-h-[80px] resize-y rounded-none border-[#1C1C1C]/20 bg-transparent font-['Inter'] text-[#1C1C1C] placeholder:text-[#1C1C1C]/40 focus:border-[#8C7B50] focus:ring-0 transition-colors"
            />
          </div>
        </div>

        {suggestions.length > 0 && (
          <Card className="mt-6 rounded-none border-l-4 border-l-[#8C7B50] border-y border-r border-[#8C7B50]/30 bg-[#FDFCF9] shadow-sm relative">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium font-['JetBrains_Mono'] uppercase tracking-wider text-[#8C7B50]">
                <Lightbulb className="h-4 w-4" />
                AI Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.id}
                    className="flex items-start justify-between gap-3 rounded-none bg-white/50 border border-[#1C1C1C]/10 p-3 text-sm font-['Libre_Baskerville'] italic text-[#1C1C1C]/90"
                  >
                    <div className="flex-1">
                      <span className="mr-2 inline-block bg-[#8C7B50]/10 px-1.5 py-0.5 text-xs font-medium font-['JetBrains_Mono'] uppercase tracking-wider text-[#8C7B50]">
                        {suggestion.type}
                      </span>
                      <span>{suggestion.text}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleApplySuggestion(suggestion)}
                      className="flex-shrink-0 font-['Libre_Baskerville'] rounded-none hover:bg-[#8C7B50]/10 text-[#8C7B50] hover:text-[#6B5B3F]"
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

      <div className="border-t border-[#8C7B50]/20 bg-[#FDFCF9] p-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => prevSection && setActiveKey(prevSection)}
            disabled={!prevSection}
            className="font-['Libre_Baskerville'] rounded-none border-[#1C1C1C]/20 hover:border-[#8C7B50] hover:bg-[#8C7B50]/5 text-[#1C1C1C] hover:text-[#8C7B50] transition-colors"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGetSuggestions}
              disabled={isLoading}
              className="font-['Libre_Baskerville'] rounded-none border-[#1C1C1C]/20 hover:border-[#8C7B50] hover:bg-[#8C7B50]/5 text-[#1C1C1C] hover:text-[#8C7B50] transition-colors"
            >
              {isLoading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="mr-1 h-4 w-4" />
              )}
              Get Suggestions
            </Button>

            <Button onClick={handleCompleteSection} disabled={isLoading} className="font-['Libre_Baskerville'] rounded-none bg-[#8C7B50] hover:bg-[#6B5B3F] text-white border border-[#8C7B50] transition-colors">
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
            className="font-['Libre_Baskerville'] rounded-none border-[#1C1C1C]/20 hover:border-[#8C7B50] hover:bg-[#8C7B50]/5 text-[#1C1C1C] hover:text-[#8C7B50] transition-colors"
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <p className="mt-3 text-center text-xs font-['Inter'] text-[#1C1C1C]/60">
          {section.completionHint}
        </p>
      </div>
    </div>
  );
}
