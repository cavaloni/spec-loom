"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, Lightbulb, ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const QUESTION_SETS = [
  {
    id: "annoyance-magic-ingredient",
    label: "Annoyance + Magic Wand",
    questions: [
      {
        key: "prompt1",
        label: "The itch",
        question: "What's been mildly annoying you lately?",
        placeholder: "Scheduling, inbox chaos, keeping up with friends, decision fatigue…",
      },
      {
        key: "prompt2",
        label: "Magic wand",
        question: "If you could wave a wand and make one thing effortless, what would it be?",
        placeholder: "Knowing what to cook, starting hard tasks, remembering names…",
      },
      {
        key: "prompt3",
        label: "Weird ingredient",
        question: "Pick one ingredient to remix ideas with (optional):",
        placeholder: "a timer, a map, a camera, a chatbot, a daily ritual, a buddy, a scoreboard, a surprise…",
      },
    ],
  },
  {
    id: "feeling-reframe-playground",
    label: "Feeling + Reframe",
    questions: [
      {
        key: "prompt1",
        label: "The feeling",
        question: "What feeling do you want more of at work/life? (or less of)",
        placeholder: "Calm, momentum, clarity, connection… less guilt, less chaos…",
      },
      {
        key: "prompt2",
        label: "The reframe",
        question: "What's something you do the hard way that \"should be easy by now\"?",
        placeholder: "Tracking expenses, staying in touch, finding good content…",
      },
      {
        key: "prompt3",
        label: "The playground",
        question: "Where should this live? (optional)",
        placeholder: "Text message, browser, calendar, notes, voice, camera, desktop…",
      },
    ],
  },
  {
    id: "two-truths-lie",
    label: "Two Truths & a Lie",
    questions: [
      {
        key: "prompt1",
        label: "Truth #1",
        question: "Something you actually do often:",
        placeholder: "Check my phone first thing, make lists, forget to reply…",
      },
      {
        key: "prompt2",
        label: "Truth #2",
        question: "Something you wish you did often:",
        placeholder: "Exercise, read, call friends, ship side projects…",
      },
      {
        key: "prompt3",
        label: "The lie",
        question: "Something absurd you'd never do (but imagine an app that helps anyway):",
        placeholder: "Wake up at 5am, meditate for an hour, inbox zero daily…",
      },
    ],
  },
];

type IdeaSuggestion = {
  title: string;
  oneLiner: string;
  descriptionToPaste: string;
};

interface IdeaExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIdea: (description: string) => void;
}

export function IdeaExplorerModal({ isOpen, onClose, onSelectIdea }: IdeaExplorerModalProps) {
  const [selectedSetIndex, setSelectedSetIndex] = useState(2); // Default to "Two Truths & a Lie"
  const [answers, setAnswers] = useState<Record<string, string>>({
    prompt1: "",
    prompt2: "",
    prompt3: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [ideas, setIdeas] = useState<IdeaSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const currentSet = QUESTION_SETS[selectedSetIndex];

  const handleAnswerChange = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSetChange = (index: number) => {
    setSelectedSetIndex(index);
    // Clear answers when switching sets
    setAnswers({ prompt1: "", prompt2: "", prompt3: "" });
    setIdeas([]);
    setError(null);
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setIdeas([]);

    try {
      const res = await fetch("/api/generate/idea-explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionSetId: currentSet.id,
          questions: currentSet.questions.map((q) => ({
            label: q.label,
            question: q.question,
            answer: answers[q.key] || "",
          })),
        }),
      });

      const data = await res.json();

      if (data.ok && data.data?.ideas) {
        setIdeas(data.data.ideas);
      } else {
        setError(data.error?.message || "Failed to generate ideas. Try again?");
      }
    } catch (err) {
      console.error("Idea explorer error:", err);
      setError("Something went wrong. Try again?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectIdea = (idea: IdeaSuggestion) => {
    onSelectIdea(idea.descriptionToPaste);
    handleClose();
  };

  const handleClose = () => {
    setAnswers({ prompt1: "", prompt2: "", prompt3: "" });
    setIdeas([]);
    setError(null);
    onClose();
  };

  const hasAnyInput = Object.values(answers).some((v) => v.trim());

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-[#8C7B50]/10 p-4">
              <Lightbulb className="h-8 w-8 text-[#8C7B50]" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl font-['Libre_Baskerville']">
            Idea Explorer
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Throw in scraps. The AI will assemble 3 possibilities. Skip any box.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {ideas.length === 0 ? (
            <div className="space-y-6 py-4">
              {/* Question set selector */}
              <div>
                <label className="block text-sm font-semibold text-[#1C1C1C] mb-2 font-['Libre_Baskerville']">
                  Pick a prompt style
                </label>
                <div className="flex rounded-lg border-2 border-[#E5E0D8] bg-white p-1 shadow-sm">
                  {QUESTION_SETS.map((set, index) => (
                    <button
                      key={set.id}
                      type="button"
                      onClick={() => handleSetChange(index)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                        selectedSetIndex === index
                          ? "bg-[#8C7B50] text-white shadow-md"
                          : "text-[#6B5B3F] hover:bg-[#F5F3ED]"
                      )}
                    >
                      {set.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Questions */}
              {currentSet.questions.map((q) => (
                <div key={q.key}>
                  <label className="block text-sm font-semibold text-[#1C1C1C] mb-1 font-['Libre_Baskerville']">
                    {q.label}
                  </label>
                  <p className="text-sm text-[#6B5B3F]/70 mb-2">{q.question}</p>
                  <Textarea
                    value={answers[q.key]}
                    onChange={(e) => handleAnswerChange(q.key, e.target.value)}
                    placeholder={q.placeholder}
                    className="min-h-[80px] resize-none text-base border-2 border-[#E5E0D8] focus:border-[#8C7B50] focus:ring-0 rounded-lg bg-[#FDFCF9] placeholder:text-[#6B5B3F]/40"
                  />
                </div>
              ))}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <p className="text-sm text-[#6B5B3F]/70 text-center">
                Pick one to paste back into "Your Product Idea". You can edit it after.
              </p>
              {ideas.map((idea, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectIdea(idea)}
                  className="w-full text-left p-4 border-2 border-[#E5E0D8] rounded-lg hover:border-[#8C7B50] hover:bg-[#8C7B50]/5 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#1C1C1C] font-['Libre_Baskerville'] group-hover:text-[#8C7B50]">
                        {idea.title}
                      </h3>
                      <p className="text-sm text-[#6B5B3F]/80 mt-1">{idea.oneLiner}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-[#8C7B50] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-4">
          {ideas.length === 0 ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 rounded-lg border-[#1C1C1C]/20 hover:border-[#8C7B50] hover:bg-[#8C7B50]/5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-[#8C7B50] hover:bg-[#6B5B3F] text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Give me three ideas
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIdeas([]);
                  setError(null);
                }}
                className="flex-1 rounded-lg border-[#1C1C1C]/20 hover:border-[#8C7B50] hover:bg-[#8C7B50]/5"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try different answers
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-[#8C7B50] hover:bg-[#6B5B3F] text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Regenerate
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
