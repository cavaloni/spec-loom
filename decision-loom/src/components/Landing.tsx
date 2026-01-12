"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useSessionStore } from "@/store/session";
import { ArrowRight, Sparkles } from "lucide-react";

export function Landing() {
  const [description, setDescription] = useState("");
  const [shouldPrefill, setShouldPrefill] = useState(true);
  const { setProductDescription, setHasStarted, startPrefill } = useSessionStore();

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
      <header className="flex items-center justify-center border-b px-6 py-6">
        <h1 className="text-xl font-bold text-primary">Decision Loom</h1>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-ink">
              What are we building?
            </h2>
            <p className="text-lg text-muted-ink">
              Describe your product idea and we&#39;ll help you create a
              comprehensive specification
            </p>
          </div>

          <div className="space-y-4">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., A mobile app that helps people track their daily habits with AI-powered suggestions and social accountability features..."
              className="min-h-[160px] resize-none text-lg border-2 focus:border-primary"
            />

            <div className="flex items-center space-x-2">
              <Checkbox
                id="prefill"
                checked={shouldPrefill}
                onCheckedChange={(checked: boolean) => setShouldPrefill(checked)}
              />
              <Label htmlFor="prefill" className="text-sm cursor-pointer">
                Pre-fill specification with AI-generated suggestions
              </Label>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!description.trim()}
              className="w-full h-12 text-lg"
              size="lg"
            >
              Start Building
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          <div className="text-center text-sm text-muted-ink">
            <p>
              We&#39;ll pre-fill your specification with AI-generated suggestions
              based on your description
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
