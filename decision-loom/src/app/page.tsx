"use client";

import { RubricSidebar } from "@/components/RubricSidebar";
import { SectionEditor } from "@/components/SectionEditor";
import { ArtifactPreview } from "@/components/ArtifactPreview";
import { TitleEditor } from "@/components/TitleEditor";
import { Button } from "@/components/ui/button";
import { Landing } from "@/components/Landing";
import { ReflectionModal } from "@/components/ReflectionModal";
import { CoreflowLoader } from "@/components/CoreflowLoader";
import { TechWalkthroughModal } from "@/components/TechWalkthroughModal";
import { useSessionStore } from "@/store/session";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const { reset, hasStarted, isArtifactExpanded } = useSessionStore();

  if (!hasStarted) {
    return <Landing />;
  }

  return (
    <>
      <div className="flex h-screen flex-col bg-[#F9F7F2]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, var(--border-ink) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      <header className="flex items-center justify-between border-b px-6 py-6 bg-[#F9F7F2]/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-primary">Decision Loom</h1>
          <TitleEditor />
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Start Over
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Fixed width */}
        <aside className="w-[320px] flex-none overflow-hidden border-r bg-[#F9F7F2]/50">
          <RubricSidebar />
        </aside>

        {/* Editor - Flexible */}
        <main 
          className={cn(
            "overflow-hidden p-6 transition-all duration-300 ease-in-out",
            isArtifactExpanded ? "w-[400px] flex-none" : "flex-1 min-w-[400px]"
          )}
        >
          <div className="h-full overflow-hidden bg-white rounded-lg shadow-sm border border-[#1C1C1C]/10">
            <SectionEditor />
          </div>
        </main>

        {/* Artifact Preview - Dynamic width */}
        <aside 
          className={cn(
            "overflow-hidden border-l bg-white transition-all duration-300 ease-in-out shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)]",
            isArtifactExpanded ? "flex-1 min-w-[500px]" : "w-[450px] flex-none"
          )}
        >
          <ArtifactPreview />
        </aside>
      </div>
    </div>
    <ReflectionModal />
    <CoreflowLoader />
    <TechWalkthroughModal />
    </>
  );
}
