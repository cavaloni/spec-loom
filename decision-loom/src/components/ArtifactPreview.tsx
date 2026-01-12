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
  Maximize2,
  Minimize2,
  Copy,
} from "lucide-react";
import type { Artifact } from "@/types/core";
import { ChatRefinement } from "@/components/ChatRefinement";

export function ArtifactPreview() {
  const {
    sessionId,
    prdArtifact,
    techSpecArtifact,
    error,
    isGenerating,
    streamingContent,
    isArtifactExpanded,
    setPrdArtifact,
    setTechSpecArtifact,
    setError,
    setIsGenerating,
    setStreamingContent,
    appendStreamingContent,
    setArtifactExpanded,
    toggleArtifactExpansion,
    getProgress,
    setPrdCopied,
    setTechSpecCopied,
    setPrdDownloaded,
    setTechSpecDownloaded,
    setIsReflectionModalOpen,
    hasBothArtifactsExported,
  } = useSessionStore();

  const [activeTab, setActiveTab] = useState<"prd" | "tech-spec">("prd");
  const progress = getProgress();
  const allComplete = progress.completed === progress.total;

  const handleGeneratePrd = async () => {
    if (!sessionId) return;

    setIsGenerating(true);
    setStreamingContent("");
    setError(null);

    // Expand artifact view
    setArtifactExpanded(true);

    try {
      const res = await fetch("/api/generate/prd/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error?.message || "Failed to generate PRD");
        setIsGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setError("Failed to read stream");
        setIsGenerating(false);
        return;
      }

      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        appendStreamingContent(chunk);
      }

      // Save the final artifact
      setPrdArtifact({
        type: "PRD",
        title: `PRD - Generated`,
        contentMd: fullContent,
      });
      setStreamingContent("");
    } catch {
      setError("Failed to generate PRD");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateTechSpec = async () => {
    if (!sessionId || !prdArtifact) return;

    setIsGenerating(true);
    setStreamingContent("");
    setError(null);

    // Expand artifact view
    setArtifactExpanded(true);

    try {
      const res = await fetch("/api/generate/tech-spec/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error?.message || "Failed to generate Tech Spec");
        setIsGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setError("Failed to read stream");
        setIsGenerating(false);
        return;
      }

      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        appendStreamingContent(chunk);
      }

      // Save the final artifact
      setTechSpecArtifact({
        type: "TECH_SPEC",
        title: `Tech Spec - Generated`,
        contentMd: fullContent,
      });
      setStreamingContent("");
    } catch {
      setError("Failed to generate Tech Spec");
    } finally {
      setIsGenerating(false);
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

    if (artifact.type === "PRD") {
      setPrdDownloaded(true);
    } else {
      setTechSpecDownloaded(true);
    }

    if (hasBothArtifactsExported()) {
      setTimeout(() => setIsReflectionModalOpen(true), 500);
    }
  };

  const handleCopy = async (artifact: Artifact) => {
    try {
      await navigator.clipboard.writeText(artifact.contentMd);
      if (artifact.type === "PRD") {
        setPrdCopied(true);
      } else {
        setTechSpecCopied(true);
      }

      if (hasBothArtifactsExported()) {
        setTimeout(() => setIsReflectionModalOpen(true), 500);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const currentArtifact = activeTab === "prd" ? prdArtifact : techSpecArtifact;

  return (
    <div className="flex h-full flex-col border-l bg-[#F9F7F2]" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'rgba(28, 28, 28, 0.15)', backgroundColor: '#F9F7F2' }}>
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'Libre Baskerville, serif', color: '#1C1C1C' }}>
            Generated Artifacts
          </h2>
          <p className="text-sm" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#8C7B50' }}>
            {allComplete
              ? "READY_TO_GENERATE"
              : `COMPLETE_${progress.total - progress.completed}_MORE_SECTIONS`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleArtifactExpansion}
          className="h-8 w-8 p-0 text-[#1C1C1C]/60 hover:text-[#1C1C1C] hover:bg-[#1C1C1C]/5"
        >
          {isArtifactExpanded ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex border-b" style={{ borderColor: 'rgba(28, 28, 28, 0.15)' }}>
        <button
          onClick={() => setActiveTab("prd")}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "prd"
              ? "bg-[#1C1C1C] text-[#F9F7F2]"
              : "text-[#1C1C1C]/60 hover:text-[#1C1C1C] hover:bg-[#1C1C1C]/5"
          }`}
          style={{ fontFamily: 'Libre Baskerville, serif', borderRadius: '0' }}
        >
          <FileText className="h-4 w-4" />
          PRD
          {prdArtifact && <CheckCircle className="h-3 w-3" style={{ color: '#8C7B50' }} />}
        </button>
        <button
          onClick={() => setActiveTab("tech-spec")}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "tech-spec"
              ? "bg-[#1C1C1C] text-[#F9F7F2]"
              : "text-[#1C1C1C]/60 hover:text-[#1C1C1C] hover:bg-[#1C1C1C]/5"
          }`}
          style={{ fontFamily: 'Libre Baskerville, serif', borderRadius: '0' }}
        >
          <Code className="h-4 w-4" />
          Tech Spec
          {techSpecArtifact && (
            <CheckCircle className="h-3 w-3" style={{ color: '#8C7B50' }} />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-hidden" style={{ backgroundColor: '#F9F7F2' }}>
        {isGenerating && streamingContent ? (
          <ScrollArea className="h-full">
            <div
              className="prose prose-sm max-w-none p-6"
              style={{
                fontFamily: 'Inter, sans-serif',
                color: '#1C1C1C',
                backgroundColor: '#F9F7F2'
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamingContent}
              </ReactMarkdown>
              <span className="inline-block w-2 h-4 bg-[#8C7B50] animate-pulse ml-1" />
            </div>
          </ScrollArea>
        ) : currentArtifact ? (
          <ScrollArea className="h-full">
            <div
              className="prose prose-sm max-w-none p-6"
              style={{
                fontFamily: 'Inter, sans-serif',
                color: '#1C1C1C',
                backgroundColor: '#F9F7F2'
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {currentArtifact.contentMd}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center" style={{ backgroundColor: '#F9F7F2' }}>
            {activeTab === "prd" ? (
              <>
                <FileText className="mb-4 h-12 w-12" style={{ color: 'rgba(28, 28, 28, 0.3)' }} />
                <h3 className="font-medium mb-2" style={{ fontFamily: 'Libre Baskerville, serif', color: '#1C1C1C' }}>
                  No PRD Generated
                </h3>
                <p className="mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(28, 28, 28, 0.6)' }}>
                  {allComplete
                    ? "Click below to generate your PRD"
                    : "Complete all sections first"}
                </p>
              </>
            ) : (
              <>
                <Code className="mb-4 h-12 w-12" style={{ color: 'rgba(28, 28, 28, 0.3)' }} />
                <h3 className="font-medium mb-2" style={{ fontFamily: 'Libre Baskerville, serif', color: '#1C1C1C' }}>
                  No Tech Spec Generated
                </h3>
                <p className="mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(28, 28, 28, 0.6)' }}>
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
        <div
          className="border-t p-3"
          style={{
            borderColor: 'rgba(28, 28, 28, 0.15)',
            backgroundColor: 'rgba(220, 38, 38, 0.08)'
          }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ fontFamily: 'Inter, sans-serif', color: '#991B1B' }}>
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}

      <div className="border-t p-4" style={{ borderColor: 'rgba(28, 28, 28, 0.15)', backgroundColor: '#F9F7F2' }}>
        <div className="flex gap-2">
          {activeTab === "prd" ? (
            <>
              <Button
                className="flex-1"
                onClick={handleGeneratePrd}
                disabled={isGenerating || !allComplete}
                style={{
                  fontFamily: 'Libre Baskerville, serif',
                  borderRadius: '0',
                  backgroundColor: isGenerating || !allComplete ? 'rgba(28, 28, 28, 0.1)' : '#1C1C1C',
                  color: isGenerating || !allComplete ? 'rgba(28, 28, 28, 0.4)' : '#F9F7F2'
                }}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                {prdArtifact ? "Regenerate PRD" : "Generate PRD"}
              </Button>
              {prdArtifact && !isGenerating && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleCopy(prdArtifact)}
                    style={{
                      fontFamily: 'Libre Baskerville, serif',
                      borderRadius: '0',
                      borderColor: 'rgba(28, 28, 28, 0.15)',
                      color: '#1C1C1C'
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDownload(prdArtifact)}
                    style={{
                      fontFamily: 'Libre Baskerville, serif',
                      borderRadius: '0',
                      borderColor: 'rgba(28, 28, 28, 0.15)',
                      color: '#1C1C1C'
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <Button
                className="flex-1"
                onClick={handleGenerateTechSpec}
                disabled={isGenerating || !prdArtifact}
                style={{
                  fontFamily: 'Libre Baskerville, serif',
                  borderRadius: '0',
                  backgroundColor: isGenerating || !prdArtifact ? 'rgba(28, 28, 28, 0.1)' : '#1C1C1C',
                  color: isGenerating || !prdArtifact ? 'rgba(28, 28, 28, 0.4)' : '#F9F7F2'
                }}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Code className="mr-2 h-4 w-4" />
                )}
                {techSpecArtifact ? "Regenerate Tech Spec" : "Generate Tech Spec"}
              </Button>
              {techSpecArtifact && !isGenerating && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleCopy(techSpecArtifact)}
                    style={{
                      fontFamily: 'Libre Baskerville, serif',
                      borderRadius: '0',
                      borderColor: 'rgba(28, 28, 28, 0.15)',
                      color: '#1C1C1C'
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDownload(techSpecArtifact)}
                    style={{
                      fontFamily: 'Libre Baskerville, serif',
                      borderRadius: '0',
                      borderColor: 'rgba(28, 28, 28, 0.15)',
                      color: '#1C1C1C'
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <ChatRefinement />
    </div>
  );
}
