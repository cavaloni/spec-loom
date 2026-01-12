"use client";

import { useState } from "react";
import { useSessionStore } from "@/store/session";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, ChevronDown, ChevronUp, Download, X, Loader2 } from "lucide-react";

export function ReflectionModal() {
  const {
    isReflectionModalOpen,
    setIsReflectionModalOpen,
    reflectionExpanded,
    setReflectionExpanded,
    reflectionContent,
    setReflectionContent,
    sessionId,
  } = useSessionStore();

  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [userNotes, setUserNotes] = useState("");

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleShowReflections = async () => {
    if (reflectionContent) {
      setReflectionExpanded(true);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/generate/reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) throw new Error("Failed to generate reflections");

      const data = await res.json();
      if (data.ok && data.data.content) {
        setReflectionContent(data.data.content);
        setReflectionExpanded(true);
      }
    } catch (error) {
      console.error("Error generating reflections:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    const content = reflectionContent || "";
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "considerations.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setIsReflectionModalOpen(false);
  };

  if (!isReflectionModalOpen) return null;

  return (
    <Dialog open={isReflectionModalOpen} onOpenChange={handleClose}>
      <DialogContent className={reflectionExpanded ? "max-w-4xl max-h-[90vh]" : "max-w-lg"}>
        {!reflectionExpanded ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="rounded-full bg-[#8C7B50]/10 p-4">
                  <Sparkles className="h-8 w-8 text-[#8C7B50]" />
                </div>
              </div>
              <DialogTitle className="text-center text-3xl">
                Great work!
              </DialogTitle>
              <DialogDescription className="text-center text-base pt-2">
                You&apos;ve got your PRD and Tech Spec. That&apos;s a solid chunk of the work done.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6">
              <p className="text-center text-sm text-[#1C1C1C]/70 mb-6">
                Before you jump into building, would you like some final reflections and considerations?
              </p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 rounded-none border-[#1C1C1C]/20 hover:border-[#8C7B50] hover:bg-[#8C7B50]/5"
              >
                No thanks
              </Button>
              <Button
                onClick={handleShowReflections}
                disabled={isLoading}
                className="flex-1 rounded-none bg-[#8C7B50] hover:bg-[#6B5B3F] text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Show reflections
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
              <div>
                <DialogTitle className="text-2xl">Before You Build</DialogTitle>
                <DialogDescription className="pt-2">
                  A few things worth pressure-testing.
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>

            <ScrollArea className="flex-1 max-h-[60vh] pr-4">
              {isLoading && !reflectionContent ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#8C7B50]" />
                    <p className="text-sm text-[#1C1C1C]/60">Generating reflections...</p>
                  </div>
                </div>
              ) : reflectionContent ? (
                <div className="space-y-6">
                  {renderReflectionContent(reflectionContent, expandedSections, toggleSection)}
                  
                  <div className="mt-8 pt-6 border-t border-[#1C1C1C]/10">
                    <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: 'Libre Baskerville, serif', color: '#1C1C1C' }}>
                      If You Had One More Week…
                    </h3>
                    <p className="text-sm text-[#1C1C1C]/60 mb-3">
                      What would you improve, cut, or validate?
                    </p>
                    <textarea
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      placeholder="Your thoughts here..."
                      className="w-full min-h-[120px] p-3 rounded-none border border-[#1C1C1C]/20 bg-transparent text-sm resize-none focus:border-[#8C7B50] focus:ring-0"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    />
                  </div>
                </div>
              ) : null}
            </ScrollArea>

            <DialogFooter className="flex-col sm:flex-row gap-3 mt-6">
              <Button
                variant="outline"
                onClick={handleClose}
                className="rounded-none border-[#1C1C1C]/20 hover:border-[#8C7B50] hover:bg-[#8C7B50]/5"
              >
                Close
              </Button>
              <Button
                onClick={handleDownload}
                className="rounded-none bg-[#8C7B50] hover:bg-[#6B5B3F] text-white"
              >
                <Download className="mr-2 h-4 w-4" />
                Download considerations.md
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function renderReflectionContent(
  content: string,
  expandedSections: Record<string, boolean>,
  toggleSection: (id: string) => void
) {
  const sections = content.split(/(?=^##\s)/m);

  return sections.map((section, index) => {
    const lines = section.trim().split("\n");
    const title = lines[0].replace(/^##\s*/, "").trim();
    const body = lines.slice(1).join("\n").trim();
    const sectionId = `section-${index}`;

    if (!title) return null;

    return (
      <div key={sectionId} className="border border-[#1C1C1C]/10 rounded-none bg-white/50">
        <button
          onClick={() => toggleSection(sectionId)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#1C1C1C]/5 transition-colors"
        >
          <h3 className="text-base font-semibold" style={{ fontFamily: 'Libre Baskerville, serif', color: '#1C1C1C' }}>
            {title}
          </h3>
          {expandedSections[sectionId] ? (
            <ChevronUp className="h-4 w-4 text-[#1C1C1C]/60" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[#1C1C1C]/60" />
          )}
        </button>
        
        {expandedSections[sectionId] && (
          <div className="px-4 pb-4 border-t border-[#1C1C1C]/10">
            <div className="pt-3 prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: formatMarkdown(body) }} />
            </div>
          </div>
        )}
      </div>
    );
  });
}

function formatMarkdown(text: string): string {
  return text
    .replace(/^###\s+(.+)$/gm, '<h4 class="font-semibold text-sm mt-4 mb-2" style="font-family: Libre Baskerville, serif; color: #1C1C1C;">$1</h4>')
    .replace(/^- (.+)$/gm, '<li class="text-sm mb-1 ml-4" style="font-family: Inter, sans-serif; color: #1C1C1C;">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="mb-3 text-sm" style="font-family: Inter, sans-serif; color: #1C1C1C;">')
    .replace(/^(?!<[hlu])/gm, '<p class="mb-3 text-sm" style="font-family: Inter, sans-serif; color: #1C1C1C;">')
    .replace(/<\/p>$/g, '</p>');
}
