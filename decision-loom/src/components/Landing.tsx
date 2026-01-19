"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useSessionStore } from "@/store/session";
import { ArrowRight, Sparkles, FileText, HelpCircle } from "lucide-react";
import { PROJECT_SCOPE_CONFIG, type ProjectScope } from "@/types/core";
import { cn } from "@/lib/utils";
import { IdeaExplorerModal } from "@/components/IdeaExplorerModal";

const SCOPE_OPTIONS: ProjectScope[] = ["personal", "mvp", "production"];

export function Landing() {
  const [description, setDescription] = useState("");
  const [shouldPrefill, setShouldPrefill] = useState(true);
  const [isIdeaExplorerOpen, setIsIdeaExplorerOpen] = useState(false);
  const { projectScope, setProjectScope, setProductDescription, setHasStarted, startPrefill } = useSessionStore();

  const handleSubmit = () => {
    if (!description.trim()) return;

    setProductDescription(description);
    setHasStarted(true);

    // Start prefill in background - the CoreflowLoader will show while this runs
    if (shouldPrefill) {
      startPrefill(description);
    }
  };

  return (
    <div
      className="flex h-screen flex-col bg-[#F9F7F2]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 2px 2px, var(--border-ink) 1px, transparent 0)",
        backgroundSize: "40px 40px",
      }}
    >
      <header className="flex items-center justify-center border-b border-[#8C7B50]/20 px-6 py-6 bg-white/50 backdrop-blur-sm">
        <h1 className="text-xl font-bold text-[#1C1C1C] font-['Libre_Baskerville']">Spec Loom</h1>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-2xl space-y-10">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-[#8C7B50]/20 blur-2xl rounded-full" />
                <div className="relative rounded-2xl bg-gradient-to-br from-[#8C7B50] to-[#6B5B3F] p-5 shadow-xl">
                  <Sparkles className="h-10 w-10 text-white" />
                </div>
              </div>
            </div>
            <h2 className="text-5xl font-bold tracking-tight text-[#1C1C1C] font-['Libre_Baskerville']">
              What are we building?
            </h2>
            <button
              onClick={() => setIsIdeaExplorerOpen(true)}
              className="inline-flex items-center gap-2 text-sm text-[#8C7B50] hover:text-[#6B5B3F] transition-colors font-medium"
            >
              <HelpCircle className="h-4 w-4" />
              I haven't the foggiest
            </button>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-lg border border-[#E5E0D8] space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#1C1C1C] mb-2 font-['Libre_Baskerville']">
                Your Product Idea
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., A mobile app that helps people track their daily habits with AI-powered suggestions and social accountability features..."
                className="min-h-[160px] resize-none text-base border-2 border-[#E5E0D8] focus:border-[#8C7B50] focus:ring-0 rounded-lg bg-[#FDFCF9] placeholder:text-[#6B5B3F]/40"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1C1C1C] mb-2 font-['Libre_Baskerville']">
                Project Scope
              </label>
              <div className="flex rounded-lg border-2 border-[#E5E0D8] bg-white p-1.5 shadow-sm">
                {SCOPE_OPTIONS.map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setProjectScope(scope)}
                    className={cn(
                      "flex-1 rounded-md px-3 py-2.5 text-sm font-medium transition-all relative",
                      projectScope === scope
                        ? "bg-[#8C7B50] text-white shadow-md"
                        : "text-[#6B5B3F] hover:bg-[#F5F3ED]"
                    )}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-semibold">{PROJECT_SCOPE_CONFIG[scope].label}</span>
                      <span className={cn(
                        "text-xs font-normal",
                        projectScope === scope ? "text-white/90" : "text-[#6B5B3F]/60"
                      )}>
                        {PROJECT_SCOPE_CONFIG[scope].description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-1">
              <Checkbox
                id="prefill"
                checked={shouldPrefill}
                onCheckedChange={(checked: boolean) => setShouldPrefill(checked)}
                className="border-[#8C7B50]/30 data-[state=checked]:bg-[#8C7B50] data-[state=checked]:border-[#8C7B50]"
              />
              <Label htmlFor="prefill" className="text-sm cursor-pointer text-[#1C1C1C] font-['Inter']">
                Pre-fill specification with AI-generated suggestions
              </Label>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!description.trim()}
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-[#8C7B50] to-[#6B5B3F] hover:from-[#7A6A40] hover:to-[#5A4A30] text-white border-0 shadow-md hover:shadow-lg transition-all"
              size="lg"
            >
              Start Building
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-[#8C7B50]/10 px-6 py-4 text-center">
        <p className="text-xs text-[#6B5B3F]/60 font-['Inter']">
          Spec Loom — Turn ideas into production-ready specifications
        </p>
      </footer>

      <IdeaExplorerModal
        isOpen={isIdeaExplorerOpen}
        onClose={() => setIsIdeaExplorerOpen(false)}
        onSelectIdea={(idea) => setDescription(idea)}
      />
    </div>
  );
}
