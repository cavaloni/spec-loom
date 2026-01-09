"use client";

import { RubricSidebar } from "@/components/RubricSidebar";
import { SectionEditor } from "@/components/SectionEditor";
import { ArtifactPreview } from "@/components/ArtifactPreview";
import { TitleEditor } from "@/components/TitleEditor";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/store/session";
import { RotateCcw } from "lucide-react";

export default function Home() {
  const { reset } = useSessionStore();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-primary">Decision Loom</h1>
          <TitleEditor />
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Start Over
        </Button>
      </header>

      <div className="grid flex-1 grid-cols-[280px_1fr_380px] overflow-hidden">
        <RubricSidebar />
        <main className="overflow-hidden">
          <SectionEditor />
        </main>
        <ArtifactPreview />
      </div>
    </div>
  );
}
