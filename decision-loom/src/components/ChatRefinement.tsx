"use client";

import { useState, useRef, useEffect } from "react";
import { useSessionStore } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";

export function ChatRefinement() {
  const {
    sessionId,
    prdArtifact,
    techSpecArtifact,
    chatMessages,
    isChatOpen,
    addChatMessage,
    updateLastChatMessage,
    setIsChatOpen,
    setPrdArtifact,
    setTechSpecArtifact,
  } = useSessionStore();

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasArtifact = prdArtifact || techSpecArtifact;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSubmit = async () => {
    if (!input.trim() || !sessionId || isStreaming) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message
    addChatMessage({
      id: `user-${Date.now()}`,
      role: "user",
      content: userMessage,
    });

    // Add placeholder for assistant response
    const assistantId = `assistant-${Date.now()}`;
    addChatMessage({
      id: assistantId,
      role: "assistant",
      content: "",
    });

    setIsStreaming(true);

    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: userMessage,
          artifactType: techSpecArtifact ? "TECH_SPEC" : "PRD",
        }),
      });

      if (!res.ok) {
        updateLastChatMessage("Sorry, I encountered an error. Please try again.");
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        updateLastChatMessage("Failed to read response stream.");
        setIsStreaming(false);
        return;
      }

      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        updateLastChatMessage(fullResponse);
      }

      // Check if the response contains updated artifact content
      // The API will return the response with optional artifact updates
      if (fullResponse.includes("---ARTIFACT_UPDATE---")) {
        const [chatResponse, artifactContent] = fullResponse.split("---ARTIFACT_UPDATE---");
        updateLastChatMessage(chatResponse.trim());
        
        if (artifactContent?.trim()) {
          if (techSpecArtifact) {
            setTechSpecArtifact({
              ...techSpecArtifact,
              contentMd: artifactContent.trim(),
            });
          } else if (prdArtifact) {
            setPrdArtifact({
              ...prdArtifact,
              contentMd: artifactContent.trim(),
            });
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      updateLastChatMessage("Sorry, something went wrong. Please try again.");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!hasArtifact) return null;

  return (
    <div className="border-t border-[#1C1C1C]/15 bg-[#F9F7F2]">
      {/* Toggle Header */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-[#1C1C1C]/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium" style={{ fontFamily: 'Libre Baskerville, serif', color: '#1C1C1C' }}>
          <MessageSquare className="h-4 w-4 text-[#8C7B50]" />
          Refine with Chat
          {chatMessages.length > 0 && (
            <span className="rounded-full bg-[#8C7B50]/20 px-2 py-0.5 text-xs text-[#8C7B50]">
              {chatMessages.length}
            </span>
          )}
        </div>
        {isChatOpen ? (
          <ChevronDown className="h-4 w-4 text-[#1C1C1C]/60" />
        ) : (
          <ChevronUp className="h-4 w-4 text-[#1C1C1C]/60" />
        )}
      </button>

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="border-t border-[#1C1C1C]/10">
          {/* Messages */}
          <ScrollArea className="h-[200px]" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <p className="text-center text-sm text-[#1C1C1C]/50" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Ask questions or request changes to refine your document.
                </p>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-[#1C1C1C] text-[#F9F7F2]"
                          : "bg-[#1C1C1C]/5 text-[#1C1C1C]"
                      }`}
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content || "..."}
                          </ReactMarkdown>
                          {isStreaming && msg.id === chatMessages[chatMessages.length - 1]?.id && (
                            <span className="inline-block w-2 h-3 bg-[#8C7B50] animate-pulse ml-1" />
                          )}
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-[#1C1C1C]/10 p-3">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask to refine the document..."
                className="min-h-[40px] max-h-[100px] resize-none rounded-none border-[#1C1C1C]/20 bg-transparent text-sm"
                style={{ fontFamily: 'Inter, sans-serif' }}
                disabled={isStreaming}
              />
              <Button
                onClick={handleSubmit}
                disabled={!input.trim() || isStreaming}
                className="h-10 w-10 p-0 rounded-none bg-[#1C1C1C] hover:bg-[#1C1C1C]/80"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
