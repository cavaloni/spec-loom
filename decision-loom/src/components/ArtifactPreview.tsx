"use client";

import { useState } from "react";
import { useSessionStore } from "@/store/session";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Code,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { Artifact } from "@/types/core";

export function ArtifactPreview() {
  const {
    sessionId,
    prdArtifact,
    techSpecArtifact,
    isLoading,
    error,
    setPrdArtifact,
    setTechSpecArtifact,
    setLoading,
    setError,
    getProgress,
  } = useSessionStore();

  const [activeTab, setActiveTab] = useState<"prd" | "tech-spec">("prd");
  const progress = getProgress();
  const allComplete = progress.completed === progress.total;

  const handleGeneratePrd = async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate/prd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();
      if (data.ok) {
        setPrdArtifact(data.data.artifact);
      } else {
        setError(data.error.message);
      }
    } catch {
      setError("Failed to generate PRD");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTechSpec = async () => {
    if (!sessionId || !prdArtifact) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate/tech-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();
      if (data.ok) {
        setTechSpecArtifact(data.data.artifact);
      } else {
        setError(data.error.message);
      }
    } catch {
      setError("Failed to generate Tech Spec");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (artifact: Artifact) => {
    const blob = new Blob([artifact.contentMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.type === "PRD" ? "PRD" : "TECH_SPEC"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentArtifact = activeTab === "prd" ? prdArtifact : techSpecArtifact;

  return (
    <div className="flex h-full flex-col border-l bg-muted/30">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Generated Artifacts</h2>
        <p className="text-sm text-muted-foreground">
          {allComplete
            ? "Ready to generate"
            : `Complete ${progress.total - progress.completed} more sections`}
        </p>
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("prd")}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "prd"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          PRD
          {prdArtifact && <CheckCircle className="h-3 w-3 text-green-500" />}
        </button>
        <button
          onClick={() => setActiveTab("tech-spec")}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "tech-spec"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Code className="h-4 w-4" />
          Tech Spec
          {techSpecArtifact && (
            <CheckCircle className="h-3 w-3 text-green-500" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {currentArtifact ? (
          <ScrollArea className="h-full">
            <div className="prose prose-sm max-w-none p-4 dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {currentArtifact.contentMd}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            {activeTab === "prd" ? (
              <>
                <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="font-medium">No PRD Generated</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  {allComplete
                    ? "Click below to generate your PRD"
                    : "Complete all sections first"}
                </p>
              </>
            ) : (
              <>
                <Code className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="font-medium">No Tech Spec Generated</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  {prdArtifact
                    ? "Click below to generate your Tech Spec"
                    : "Generate PRD first"}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="border-t bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}

      <div className="border-t p-4">
        <div className="flex gap-2">
          {activeTab === "prd" ? (
            <>
              <Button
                className="flex-1"
                onClick={handleGeneratePrd}
                disabled={isLoading || !allComplete}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                {prdArtifact ? "Regenerate PRD" : "Generate PRD"}
              </Button>
              {prdArtifact && (
                <Button
                  variant="outline"
                  onClick={() => handleDownload(prdArtifact)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                className="flex-1"
                onClick={handleGenerateTechSpec}
                disabled={isLoading || !prdArtifact}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Code className="mr-2 h-4 w-4" />
                )}
                {techSpecArtifact ? "Regenerate Tech Spec" : "Generate Tech Spec"}
              </Button>
              {techSpecArtifact && (
                <Button
                  variant="outline"
                  onClick={() => handleDownload(techSpecArtifact)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
