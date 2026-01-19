"use client";

import { useState, useEffect, useRef } from "react";
import { useSessionStore } from "@/store/session";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import {
  X,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  RefreshCw,
  FileCode,
  GitBranch,
  Lightbulb,
  Code,
  Copy,
} from "lucide-react";

// Architecture driver questions
const DRIVER_QUESTIONS = [
  {
    key: "unit_of_work",
    label: "Unit of Work",
    prompt: "What is the atomic unit of work in your system? (e.g., a single API request, a batch job, a user session)",
    placeholder: "e.g., A single document upload and processing cycle",
  },
  {
    key: "scale_shape",
    label: "Scale Shape",
    prompt: "How do you expect load to grow? (e.g., linear with users, bursty during events, steady 24/7)",
    placeholder: "e.g., Bursty during business hours, 10x spikes during product launches",
  },
  {
    key: "latency_contract",
    label: "Latency Contract",
    prompt: "What are your latency requirements? (e.g., p50 < 100ms, p99 < 1s, batch jobs can take hours)",
    placeholder: "e.g., API responses < 200ms p95, background jobs < 5 minutes",
  },
  {
    key: "data_volatility",
    label: "Data Volatility",
    prompt: "How often does your data change? What's the read/write ratio?",
    placeholder: "e.g., 95% reads, data updates hourly, user preferences rarely change",
  },
  {
    key: "correctness_risk",
    label: "Correctness & Risk",
    prompt: "What happens if something goes wrong? What's the cost of errors?",
    placeholder: "e.g., Financial transactions require ACID, analytics can tolerate eventual consistency",
  },
  {
    key: "cost_envelope",
    label: "Cost Envelope",
    prompt: "What are your infrastructure budget constraints? Any cost-per-request targets?",
    placeholder: "e.g., $500/month cloud budget, cost per API call < $0.001",
  },
  {
    key: "privacy_compliance",
    label: "Privacy & Compliance",
    prompt: "What privacy regulations apply? Any data residency requirements?",
    placeholder: "e.g., GDPR for EU users, HIPAA for health data, data must stay in US",
  },
  {
    key: "observability",
    label: "Day-One Observability",
    prompt: "What metrics and alerts do you need from day one?",
    placeholder: "e.g., Error rates, latency percentiles, queue depths, business KPIs",
  },
];

// Decision areas
const DECISION_AREAS = [
  { value: "data_storage", label: "Data Storage" },
  { value: "compute_strategy", label: "Compute Strategy" },
  { value: "ux_contract", label: "UX Contract" },
  { value: "state_sync", label: "State Sync" },
  { value: "interfaces", label: "Interfaces" },
  { value: "risk_controls", label: "Risk Controls" },
  { value: "operations", label: "Operations" },
  { value: "orchestration", label: "Orchestration" },
];

// Agentic Profile options
const AGENTIC_MODES = [
  { value: "none", label: "Not Agentic", description: "Traditional application without AI agents" },
  { value: "assistive", label: "Assistive", description: "AI provides suggestions only; user always drives execution" },
  { value: "semi_autonomous", label: "Semi-Autonomous", description: "Agent proposes plans/actions; user approves before execution" },
  { value: "autonomous", label: "Autonomous", description: "Agent executes within guardrails; user reviews after" },
];

const ORCHESTRATION_SHAPES = [
  { value: "single_agent", label: "Single Agent", description: "One agent handles all tasks" },
  { value: "multi_agent_collaborative", label: "Multi-Agent (Collaborative)", description: "Multiple agents work together on tasks" },
  { value: "multi_agent_specialist", label: "Multi-Agent (Specialist Roles)", description: "Agents have distinct roles (planner, executor, critic, etc.)" },
];

const TOOL_CAPABILITIES = [
  { value: "text_only", label: "Text Generation Only", description: "Agent only generates text responses" },
  { value: "tool_calls", label: "Tool Calls", description: "Agent can call APIs, query databases, run code" },
  { value: "external_actions", label: "External Actions", description: "Agent can take real-world actions (send emails, make purchases, deploy)" },
];

const MEMORY_REQUIREMENTS = [
  { value: "none", label: "None", description: "No memory between interactions" },
  { value: "session_only", label: "Session Only", description: "Memory within a single session" },
  { value: "long_term", label: "Long-Term", description: "Persistent memory across sessions per user/org" },
];

const APPROVAL_REQUIREMENTS = [
  { value: "tool_calls", label: "Tool Calls" },
  { value: "external_actions", label: "External Actions" },
  { value: "data_access", label: "Sensitive Data Access" },
];

interface ArchitectureDecision {
  id: string;
  title: string;
  area: string;
  chosenOption: string;
  alternatives: string[];
  tradeoffs: string;
  userVisibleConsequence: string;
  mvpImpact: string;
  openQuestions: string;
  status: "tentative" | "approved";
}

interface DriverAnswer {
  questionKey: string;
  answer: string;
}

interface AgenticProfile {
  agenticMode: string;
  orchestrationShape: string | null;
  toolCapabilities: string[];
  memoryRequirements: string | null;
  humanApprovalRequired: string[];
  guardrailsNotes: string | null;
}

interface TechWalkthrough {
  id: string;
  sessionId: string;
  status: string;
  drivers: DriverAnswer[];
  decisions: ArchitectureDecision[];
  agenticProfile?: AgenticProfile;
}

export function TechWalkthroughModal() {
  const {
    sessionId,
    prdArtifact,
    isTechWalkthroughOpen,
    setIsTechWalkthroughOpen,
    setTechSpecArtifact,
  } = useSessionStore();

  const [activeTab, setActiveTab] = useState<"drivers" | "agentic" | "decisions" | "spec" | "diagram">("drivers");
  const [walkthrough, setWalkthrough] = useState<TechWalkthrough | null>(null);
  const [driverAnswers, setDriverAnswers] = useState<Record<string, string>>({});
  const [decisions, setDecisions] = useState<ArchitectureDecision[]>([]);
  const [expandedDecisions, setExpandedDecisions] = useState<Set<string>>(new Set());
  const [generatedSpec, setGeneratedSpec] = useState<string>("");
  const [diagramCode, setDiagramCode] = useState<string>("");
  const [showDiagramCode, setShowDiagramCode] = useState(false);

  // Agentic profile state
  const [agenticProfile, setAgenticProfile] = useState<AgenticProfile>({
    agenticMode: "none",
    orchestrationShape: null,
    toolCapabilities: [],
    memoryRequirements: null,
    humanApprovalRequired: [],
    guardrailsNotes: null,
  });
  const [isSavingAgenticProfile, setIsSavingAgenticProfile] = useState(false);

  // Loading states
  const [isLoadingWalkthrough, setIsLoadingWalkthrough] = useState(false);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const [isSuggestingFor, setIsSuggestingFor] = useState<string | null>(null);
  const [isProposingDecisions, setIsProposingDecisions] = useState(false);
  const [isGeneratingSpec, setIsGeneratingSpec] = useState(false);
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [isSavingDrivers, setIsSavingDrivers] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});

  // Mermaid diagram ref
  const diagramRef = useRef<HTMLDivElement>(null);

  // Initialize mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "loose",
    });
  }, []);

  // Render mermaid diagram when code changes
  useEffect(() => {
    if (diagramCode && diagramRef.current && !showDiagramCode) {
      const renderDiagram = async () => {
        try {
          diagramRef.current!.innerHTML = "";
          const { svg } = await mermaid.render("mermaid-diagram", diagramCode);
          diagramRef.current!.innerHTML = svg;
        } catch (err) {
          console.error("Mermaid render error:", err);
          diagramRef.current!.innerHTML = `<pre class="text-red-500">Failed to render diagram: ${err}</pre>`;
        }
      };
      renderDiagram();
    }
  }, [diagramCode, showDiagramCode]);

  // Load or create walkthrough when modal opens
  useEffect(() => {
    if (isTechWalkthroughOpen && sessionId) {
      loadWalkthrough();
    }
  }, [isTechWalkthroughOpen, sessionId]);

  const loadWalkthrough = async () => {
    if (!sessionId) return;
    setIsLoadingWalkthrough(true);
    setError(null);

    try {
      const res = await fetch(`/api/tech-walkthrough?sessionId=${sessionId}`);
      const data = await res.json();

      if (data.ok && data.data) {
        setWalkthrough(data.data);
        // Populate driver answers
        const answers: Record<string, string> = {};
        for (const driver of data.data.drivers || []) {
          answers[driver.questionKey] = driver.answer;
        }
        setDriverAnswers(answers);
        // Populate decisions
        setDecisions(data.data.decisions || []);
        // Populate agentic profile if exists
        if (data.data.agenticProfile) {
          setAgenticProfile({
            agenticMode: data.data.agenticProfile.agenticMode || "none",
            orchestrationShape: data.data.agenticProfile.orchestrationShape || null,
            toolCapabilities: data.data.agenticProfile.toolCapabilities || [],
            memoryRequirements: data.data.agenticProfile.memoryRequirements || null,
            humanApprovalRequired: data.data.agenticProfile.humanApprovalRequired || [],
            guardrailsNotes: data.data.agenticProfile.guardrailsNotes || null,
          });
        }
        // If there's a generated spec, load it
        if (data.data.generatedSpec) {
          setGeneratedSpec(data.data.generatedSpec);
        }
      } else {
        // Create new walkthrough
        const createRes = await fetch("/api/tech-walkthrough", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const createData = await createRes.json();
        if (createData.ok) {
          setWalkthrough(createData.data);
        }
      }
    } catch (err) {
      setError("Failed to load walkthrough");
      console.error(err);
    } finally {
      setIsLoadingWalkthrough(false);
    }
  };

  const handleDriverChange = (key: string, value: string) => {
    setDriverAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const saveDrivers = async () => {
    if (!walkthrough) return;
    setIsSavingDrivers(true);
    setError(null);

    try {
      const drivers = Object.entries(driverAnswers).map(([questionKey, answer]) => ({
        questionKey,
        answer,
      }));

      await fetch("/api/tech-walkthrough/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walkthroughId: walkthrough.id, drivers }),
      });
    } catch (err) {
      setError("Failed to save drivers");
      console.error(err);
    } finally {
      setIsSavingDrivers(false);
    }
  };

  const handlePrefillAll = async () => {
    if (!prdArtifact) return;
    setIsPrefilling(true);
    setError(null);

    try {
      const res = await fetch("/api/tech-walkthrough/prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prdContent: prdArtifact.contentMd }),
      });
      const data = await res.json();

      if (data.ok && data.data.answers) {
        setDriverAnswers(data.data.answers);
        // Also load agentic profile if provided
        if (data.data.agenticProfile) {
          setAgenticProfile({
            agenticMode: data.data.agenticProfile.agenticMode || "none",
            orchestrationShape: data.data.agenticProfile.orchestrationShape || null,
            toolCapabilities: data.data.agenticProfile.toolCapabilities || [],
            memoryRequirements: data.data.agenticProfile.memoryRequirements || null,
            humanApprovalRequired: data.data.agenticProfile.humanApprovalRequired || [],
            guardrailsNotes: data.data.agenticProfile.guardrailsNotes || null,
          });
        }
      } else {
        setError(data.error?.message || "Failed to prefill answers");
      }
    } catch (err) {
      setError("Failed to prefill answers");
      console.error(err);
    } finally {
      setIsPrefilling(false);
    }
  };

  const handleSuggest = async (questionKey: string) => {
    if (!prdArtifact) return;
    setIsSuggestingFor(questionKey);
    setError(null);

    try {
      const res = await fetch("/api/tech-walkthrough/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prdContent: prdArtifact.contentMd,
          questionKey,
          currentAnswer: driverAnswers[questionKey] || "",
        }),
      });
      const data = await res.json();

      if (data.ok && data.data.suggestions) {
        setSuggestions((prev) => ({ ...prev, [questionKey]: data.data.suggestions }));
      }
    } catch (err) {
      setError("Failed to get suggestions");
      console.error(err);
    } finally {
      setIsSuggestingFor(null);
    }
  };

  const saveAgenticProfile = async () => {
    if (!walkthrough) return;
    setIsSavingAgenticProfile(true);
    setError(null);

    try {
      await fetch("/api/tech-walkthrough/agentic-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walkthroughId: walkthrough.id,
          ...agenticProfile,
        }),
      });
    } catch (err) {
      setError("Failed to save agentic profile");
      console.error(err);
    } finally {
      setIsSavingAgenticProfile(false);
    }
  };

  const handleProposeDecisions = async () => {
    if (!walkthrough || !prdArtifact) return;
    setIsProposingDecisions(true);
    setError(null);

    try {
      // Save drivers and agentic profile first
      await saveDrivers();
      await saveAgenticProfile();

      const res = await fetch("/api/tech-walkthrough/decisions/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walkthroughId: walkthrough.id,
          prdContent: prdArtifact.contentMd,
          drivers: driverAnswers,
          agenticProfile,
        }),
      });
      const data = await res.json();

      if (data.ok && data.data.decisions) {
        setDecisions(data.data.decisions);
        setActiveTab("decisions");
      } else {
        setError(data.error?.message || "Failed to propose decisions");
      }
    } catch (err) {
      setError("Failed to propose decisions");
      console.error(err);
    } finally {
      setIsProposingDecisions(false);
    }
  };

  const handleUpdateDecision = async (decisionId: string, updates: Partial<ArchitectureDecision>) => {
    setDecisions((prev) =>
      prev.map((d) => (d.id === decisionId ? { ...d, ...updates } : d))
    );

    try {
      await fetch("/api/tech-walkthrough/decisions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId, updates }),
      });
    } catch (err) {
      console.error("Failed to update decision:", err);
    }
  };

  const toggleDecisionExpanded = (id: string) => {
    setExpandedDecisions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGenerateSpec = async () => {
    if (!walkthrough || !prdArtifact) return;
    setIsGeneratingSpec(true);
    setError(null);

    try {
      const res = await fetch("/api/tech-walkthrough/generate-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walkthroughId: walkthrough.id,
          sessionId,
          prdContent: prdArtifact.contentMd,
          drivers: driverAnswers,
          decisions,
        }),
      });
      const data = await res.json();

      if (data.ok && data.data.spec) {
        setGeneratedSpec(data.data.spec);
        setTechSpecArtifact({
          type: "TECH_SPEC",
          title: "Tech Spec - Generated via Guide",
          contentMd: data.data.spec,
        });
        setActiveTab("spec");
      } else {
        setError(data.error?.message || "Failed to generate spec");
      }
    } catch (err) {
      setError("Failed to generate spec");
      console.error(err);
    } finally {
      setIsGeneratingSpec(false);
    }
  };

  const handleGenerateDiagram = async () => {
    if (!prdArtifact) return;
    setIsGeneratingDiagram(true);
    setError(null);

    try {
      const res = await fetch("/api/tech-walkthrough/generate-diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prdContent: prdArtifact.contentMd,
          drivers: driverAnswers,
          decisions,
        }),
      });
      const data = await res.json();

      if (data.ok && data.data.diagram) {
        setDiagramCode(data.data.diagram);
        setActiveTab("diagram");
      } else {
        setError(data.error?.message || "Failed to generate diagram");
      }
    } catch (err) {
      setError("Failed to generate diagram");
      console.error(err);
    } finally {
      setIsGeneratingDiagram(false);
    }
  };

  const copyDiagramCode = async () => {
    try {
      await navigator.clipboard.writeText(diagramCode);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const hasAllDrivers = DRIVER_QUESTIONS.every((q) => driverAnswers[q.key]?.trim());
  const hasDecisions = decisions.length > 0;

  if (!isTechWalkthroughOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div
        className="bg-[#F9F7F2] w-full h-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
          <div>
            <h2 className="text-xl font-semibold" style={{ fontFamily: "Libre Baskerville, serif", color: "#1C1C1C" }}>
              Tech Spec Guide
            </h2>
            <p className="text-sm" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
              Guided walkthrough for architecture decisions
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsTechWalkthroughOpen(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto h-6 px-2">
              Dismiss
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
          {[
            { key: "drivers", label: "1. Drivers", icon: Lightbulb },
            { key: "agentic", label: "2. Agentic Profile", icon: Sparkles },
            { key: "decisions", label: "3. Decisions", icon: GitBranch },
            { key: "spec", label: "4. Tech Spec", icon: FileCode },
            { key: "diagram", label: "5. Diagram", icon: Code },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === key
                  ? "bg-[#1C1C1C] text-[#F9F7F2]"
                  : "text-[#1C1C1C]/60 hover:text-[#1C1C1C] hover:bg-[#1C1C1C]/5"
              }`}
              style={{ fontFamily: "Libre Baskerville, serif" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoadingWalkthrough ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-[#8C7B50]" />
            </div>
          ) : (
            <>
              {/* Drivers Tab */}
              {activeTab === "drivers" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
                    <p className="text-sm" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                      Answer these 8 questions to define your architecture drivers
                    </p>
                    <Button
                      onClick={handlePrefillAll}
                      disabled={isPrefilling || !prdArtifact}
                      variant="outline"
                      size="sm"
                      style={{ borderRadius: "0" }}
                    >
                      {isPrefilling ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Prefill All from PRD
                    </Button>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-6 space-y-6">
                      {DRIVER_QUESTIONS.map((question) => (
                        <div key={question.key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="font-medium" style={{ fontFamily: "Libre Baskerville, serif", color: "#1C1C1C" }}>
                              {question.label}
                            </label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSuggest(question.key)}
                              disabled={isSuggestingFor === question.key}
                              className="h-7 text-xs"
                            >
                              {isSuggestingFor === question.key ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Lightbulb className="mr-1 h-3 w-3" />
                              )}
                              Suggest
                            </Button>
                          </div>
                          <p className="text-sm" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                            {question.prompt}
                          </p>
                          <Textarea
                            value={driverAnswers[question.key] || ""}
                            onChange={(e) => handleDriverChange(question.key, e.target.value)}
                            placeholder={question.placeholder}
                            className="min-h-[80px]"
                            style={{ borderRadius: "0", borderColor: "rgba(28, 28, 28, 0.15)" }}
                          />
                          {suggestions[question.key] && suggestions[question.key].length > 0 && (
                            <div className="bg-[#8C7B50]/10 p-3 space-y-2">
                              <p className="text-xs font-medium" style={{ color: "#8C7B50" }}>
                                Suggestions:
                              </p>
                              {suggestions[question.key].map((suggestion, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleDriverChange(question.key, suggestion)}
                                  className="block w-full text-left text-sm p-2 hover:bg-[#8C7B50]/10 transition-colors"
                                  style={{ color: "#1C1C1C" }}
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
                    <Button
                      onClick={() => setActiveTab("agentic")}
                      disabled={!hasAllDrivers}
                      style={{
                        fontFamily: "Libre Baskerville, serif",
                        borderRadius: "0",
                        backgroundColor: !hasAllDrivers ? "rgba(28, 28, 28, 0.1)" : "#1C1C1C",
                        color: !hasAllDrivers ? "rgba(28, 28, 28, 0.4)" : "#F9F7F2",
                      }}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Next: Agentic Profile
                    </Button>
                  </div>
                </div>
              )}

              {/* Agentic Profile Tab */}
              {activeTab === "agentic" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
                    <p className="text-sm" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                      Define if and how your system uses AI agents
                    </p>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-6 space-y-6">
                      {/* Agentic Mode Selector */}
                      <div className="space-y-3">
                        <label className="font-medium" style={{ fontFamily: "Libre Baskerville, serif", color: "#1C1C1C" }}>
                          Is this an agentic system?
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {AGENTIC_MODES.map((mode) => (
                            <button
                              key={mode.value}
                              onClick={() => setAgenticProfile((prev) => ({
                                ...prev,
                                agenticMode: mode.value,
                                // Reset other fields if switching to "none"
                                ...(mode.value === "none" ? {
                                  orchestrationShape: null,
                                  toolCapabilities: [],
                                  memoryRequirements: null,
                                  humanApprovalRequired: [],
                                  guardrailsNotes: null,
                                } : {}),
                              }))}
                              className={`p-4 text-left border transition-colors ${
                                agenticProfile.agenticMode === mode.value
                                  ? "border-[#8C7B50] bg-[#8C7B50]/10"
                                  : "border-[#1C1C1C]/15 hover:border-[#1C1C1C]/30"
                              }`}
                              style={{ borderRadius: "0" }}
                            >
                              <div className="font-medium" style={{ color: "#1C1C1C" }}>{mode.label}</div>
                              <div className="text-xs mt-1" style={{ color: "rgba(28, 28, 28, 0.6)" }}>{mode.description}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Conditional fields - only show if agentic mode is not "none" */}
                      {agenticProfile.agenticMode !== "none" && (
                        <>
                          {/* Orchestration Shape */}
                          <div className="space-y-3">
                            <label className="font-medium" style={{ fontFamily: "Libre Baskerville, serif", color: "#1C1C1C" }}>
                              Orchestration Shape
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                              {ORCHESTRATION_SHAPES.map((shape) => (
                                <button
                                  key={shape.value}
                                  onClick={() => setAgenticProfile((prev) => ({ ...prev, orchestrationShape: shape.value }))}
                                  className={`p-3 text-left border transition-colors ${
                                    agenticProfile.orchestrationShape === shape.value
                                      ? "border-[#8C7B50] bg-[#8C7B50]/10"
                                      : "border-[#1C1C1C]/15 hover:border-[#1C1C1C]/30"
                                  }`}
                                  style={{ borderRadius: "0" }}
                                >
                                  <div className="font-medium text-sm" style={{ color: "#1C1C1C" }}>{shape.label}</div>
                                  <div className="text-xs mt-1" style={{ color: "rgba(28, 28, 28, 0.6)" }}>{shape.description}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Tool Capabilities */}
                          <div className="space-y-3">
                            <label className="font-medium" style={{ fontFamily: "Libre Baskerville, serif", color: "#1C1C1C" }}>
                              Tool & Action Capabilities
                            </label>
                            <div className="space-y-2">
                              {TOOL_CAPABILITIES.map((cap) => (
                                <label
                                  key={cap.value}
                                  className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                                    agenticProfile.toolCapabilities.includes(cap.value)
                                      ? "border-[#8C7B50] bg-[#8C7B50]/10"
                                      : "border-[#1C1C1C]/15 hover:border-[#1C1C1C]/30"
                                  }`}
                                  style={{ borderRadius: "0" }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={agenticProfile.toolCapabilities.includes(cap.value)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setAgenticProfile((prev) => ({
                                          ...prev,
                                          toolCapabilities: [...prev.toolCapabilities, cap.value],
                                        }));
                                      } else {
                                        setAgenticProfile((prev) => ({
                                          ...prev,
                                          toolCapabilities: prev.toolCapabilities.filter((v) => v !== cap.value),
                                        }));
                                      }
                                    }}
                                    className="mt-1"
                                  />
                                  <div>
                                    <div className="font-medium text-sm" style={{ color: "#1C1C1C" }}>{cap.label}</div>
                                    <div className="text-xs" style={{ color: "rgba(28, 28, 28, 0.6)" }}>{cap.description}</div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Memory Requirements */}
                          <div className="space-y-3">
                            <label className="font-medium" style={{ fontFamily: "Libre Baskerville, serif", color: "#1C1C1C" }}>
                              Memory Requirements
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                              {MEMORY_REQUIREMENTS.map((mem) => (
                                <button
                                  key={mem.value}
                                  onClick={() => setAgenticProfile((prev) => ({ ...prev, memoryRequirements: mem.value }))}
                                  className={`p-3 text-left border transition-colors ${
                                    agenticProfile.memoryRequirements === mem.value
                                      ? "border-[#8C7B50] bg-[#8C7B50]/10"
                                      : "border-[#1C1C1C]/15 hover:border-[#1C1C1C]/30"
                                  }`}
                                  style={{ borderRadius: "0" }}
                                >
                                  <div className="font-medium text-sm" style={{ color: "#1C1C1C" }}>{mem.label}</div>
                                  <div className="text-xs mt-1" style={{ color: "rgba(28, 28, 28, 0.6)" }}>{mem.description}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Human Approval Requirements */}
                          <div className="space-y-3">
                            <label className="font-medium" style={{ fontFamily: "Libre Baskerville, serif", color: "#1C1C1C" }}>
                              Human Approval Required For
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {APPROVAL_REQUIREMENTS.map((req) => (
                                <label
                                  key={req.value}
                                  className={`flex items-center gap-2 px-3 py-2 border cursor-pointer transition-colors ${
                                    agenticProfile.humanApprovalRequired.includes(req.value)
                                      ? "border-[#8C7B50] bg-[#8C7B50]/10"
                                      : "border-[#1C1C1C]/15 hover:border-[#1C1C1C]/30"
                                  }`}
                                  style={{ borderRadius: "0" }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={agenticProfile.humanApprovalRequired.includes(req.value)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setAgenticProfile((prev) => ({
                                          ...prev,
                                          humanApprovalRequired: [...prev.humanApprovalRequired, req.value],
                                        }));
                                      } else {
                                        setAgenticProfile((prev) => ({
                                          ...prev,
                                          humanApprovalRequired: prev.humanApprovalRequired.filter((v) => v !== req.value),
                                        }));
                                      }
                                    }}
                                  />
                                  <span className="text-sm" style={{ color: "#1C1C1C" }}>{req.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Guardrails Notes */}
                          <div className="space-y-2">
                            <label className="font-medium" style={{ fontFamily: "Libre Baskerville, serif", color: "#1C1C1C" }}>
                              Safety, Compliance & Guardrails
                            </label>
                            <p className="text-sm" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                              Safety constraints, compliance requirements, evaluation protocols, audit requirements, or policy checks?
                            </p>
                            <Textarea
                              value={agenticProfile.guardrailsNotes || ""}
                              onChange={(e) => setAgenticProfile((prev) => ({ ...prev, guardrailsNotes: e.target.value }))}
                              placeholder="e.g., Only allow pre-approved tools, require audit log for all actions, sandbox code execution, GDPR compliance, prompt injection testing..."
                              className="min-h-[80px]"
                              style={{ borderRadius: "0", borderColor: "rgba(28, 28, 28, 0.15)" }}
                            />
                          </div>
                        </>
                      )}

                      {/* Summary for "Not Agentic" */}
                      {agenticProfile.agenticMode === "none" && (
                        <div className="bg-[#1C1C1C]/5 p-4 border border-[#1C1C1C]/15">
                          <p className="text-sm" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                            This is a traditional application without AI agents. The decision generator will focus on conventional architecture patterns.
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="p-4 border-t flex justify-between" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
                    <Button
                      onClick={() => setActiveTab("drivers")}
                      variant="outline"
                      style={{ borderRadius: "0" }}
                    >
                      Back to Drivers
                    </Button>
                    <Button
                      onClick={handleProposeDecisions}
                      disabled={isProposingDecisions}
                      style={{
                        fontFamily: "Libre Baskerville, serif",
                        borderRadius: "0",
                        backgroundColor: isProposingDecisions ? "rgba(28, 28, 28, 0.1)" : "#1C1C1C",
                        color: isProposingDecisions ? "rgba(28, 28, 28, 0.4)" : "#F9F7F2",
                      }}
                    >
                      {isProposingDecisions ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <GitBranch className="mr-2 h-4 w-4" />
                      )}
                      Propose Decisions
                    </Button>
                  </div>
                </div>
              )}

              {/* Decisions Tab */}
              {activeTab === "decisions" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
                    <p className="text-sm" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                      Review and refine the proposed architecture decisions
                    </p>
                    <Button
                      onClick={handleProposeDecisions}
                      disabled={isProposingDecisions}
                      variant="outline"
                      size="sm"
                      style={{ borderRadius: "0" }}
                    >
                      {isProposingDecisions ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-6 space-y-4">
                      {decisions.length === 0 ? (
                        <div className="text-center py-12">
                          <GitBranch className="h-12 w-12 mx-auto mb-4" style={{ color: "rgba(28, 28, 28, 0.3)" }} />
                          <p style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                            No decisions yet. Complete the drivers and click &quot;Propose Decisions&quot;.
                          </p>
                        </div>
                      ) : (
                        decisions.map((decision) => (
                          <div
                            key={decision.id}
                            className="border bg-white"
                            style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}
                          >
                            <button
                              onClick={() => toggleDecisionExpanded(decision.id)}
                              className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1C1C1C]/5 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className="px-2 py-1 text-xs font-medium"
                                  style={{
                                    backgroundColor: "#8C7B50",
                                    color: "#F9F7F2",
                                  }}
                                >
                                  {DECISION_AREAS.find((a) => a.value === decision.area)?.label || decision.area}
                                </span>
                                <span className="font-medium" style={{ fontFamily: "Libre Baskerville, serif" }}>
                                  {decision.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateDecision(decision.id, {
                                      status: decision.status === "approved" ? "tentative" : "approved",
                                    });
                                  }}
                                  className={`px-2 py-1 text-xs font-medium transition-colors ${
                                    decision.status === "approved"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {decision.status === "approved" ? (
                                    <Check className="h-3 w-3 inline mr-1" />
                                  ) : null}
                                  {decision.status}
                                </button>
                                {expandedDecisions.has(decision.id) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </div>
                            </button>
                            {expandedDecisions.has(decision.id) && (
                              <div className="p-4 border-t space-y-4" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
                                <div>
                                  <label className="text-xs font-medium" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                                    Chosen Option
                                  </label>
                                  <Input
                                    value={decision.chosenOption}
                                    onChange={(e) => handleUpdateDecision(decision.id, { chosenOption: e.target.value })}
                                    style={{ borderRadius: "0", borderColor: "rgba(28, 28, 28, 0.15)" }}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                                    Alternatives (comma-separated)
                                  </label>
                                  <Input
                                    value={decision.alternatives.join(", ")}
                                    onChange={(e) =>
                                      handleUpdateDecision(decision.id, {
                                        alternatives: e.target.value.split(",").map((s) => s.trim()),
                                      })
                                    }
                                    style={{ borderRadius: "0", borderColor: "rgba(28, 28, 28, 0.15)" }}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                                    Tradeoffs
                                  </label>
                                  <Textarea
                                    value={decision.tradeoffs}
                                    onChange={(e) => handleUpdateDecision(decision.id, { tradeoffs: e.target.value })}
                                    style={{ borderRadius: "0", borderColor: "rgba(28, 28, 28, 0.15)" }}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                                    User-Visible Consequence
                                  </label>
                                  <Textarea
                                    value={decision.userVisibleConsequence}
                                    onChange={(e) =>
                                      handleUpdateDecision(decision.id, { userVisibleConsequence: e.target.value })
                                    }
                                    style={{ borderRadius: "0", borderColor: "rgba(28, 28, 28, 0.15)" }}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                                    MVP Impact
                                  </label>
                                  <Textarea
                                    value={decision.mvpImpact}
                                    onChange={(e) => handleUpdateDecision(decision.id, { mvpImpact: e.target.value })}
                                    style={{ borderRadius: "0", borderColor: "rgba(28, 28, 28, 0.15)" }}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium" style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                                    Open Questions
                                  </label>
                                  <Textarea
                                    value={decision.openQuestions}
                                    onChange={(e) => handleUpdateDecision(decision.id, { openQuestions: e.target.value })}
                                    style={{ borderRadius: "0", borderColor: "rgba(28, 28, 28, 0.15)" }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
                    <Button
                      onClick={handleGenerateSpec}
                      disabled={!hasDecisions || isGeneratingSpec}
                      style={{
                        fontFamily: "Libre Baskerville, serif",
                        borderRadius: "0",
                        backgroundColor: !hasDecisions || isGeneratingSpec ? "rgba(28, 28, 28, 0.1)" : "#1C1C1C",
                        color: !hasDecisions || isGeneratingSpec ? "rgba(28, 28, 28, 0.4)" : "#F9F7F2",
                      }}
                    >
                      {isGeneratingSpec ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileCode className="mr-2 h-4 w-4" />
                      )}
                      Generate Tech Spec
                    </Button>
                  </div>
                </div>
              )}

              {/* Spec Tab */}
              {activeTab === "spec" && (
                <div className="h-full flex flex-col">
                  {generatedSpec ? (
                    <ScrollArea className="flex-1">
                      <div
                        className="prose prose-sm max-w-none p-6"
                        style={{ fontFamily: "Inter, sans-serif", color: "#1C1C1C" }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{generatedSpec}</ReactMarkdown>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <FileCode className="h-12 w-12 mx-auto mb-4" style={{ color: "rgba(28, 28, 28, 0.3)" }} />
                        <p style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                          No spec generated yet. Complete decisions and click &quot;Generate Tech Spec&quot;.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
                    <Button
                      onClick={handleGenerateDiagram}
                      disabled={!generatedSpec || isGeneratingDiagram}
                      style={{
                        fontFamily: "Libre Baskerville, serif",
                        borderRadius: "0",
                        backgroundColor: !generatedSpec || isGeneratingDiagram ? "rgba(28, 28, 28, 0.1)" : "#1C1C1C",
                        color: !generatedSpec || isGeneratingDiagram ? "rgba(28, 28, 28, 0.4)" : "#F9F7F2",
                      }}
                    >
                      {isGeneratingDiagram ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Code className="mr-2 h-4 w-4" />
                      )}
                      Generate Diagram
                    </Button>
                  </div>
                </div>
              )}

              {/* Diagram Tab */}
              {activeTab === "diagram" && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={showDiagramCode ? "outline" : "default"}
                        size="sm"
                        onClick={() => setShowDiagramCode(false)}
                        style={{ borderRadius: "0" }}
                      >
                        Preview
                      </Button>
                      <Button
                        variant={showDiagramCode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowDiagramCode(true)}
                        style={{ borderRadius: "0" }}
                      >
                        Code
                      </Button>
                    </div>
                    {diagramCode && (
                      <Button variant="outline" size="sm" onClick={copyDiagramCode} style={{ borderRadius: "0" }}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Code
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto p-6">
                    {diagramCode ? (
                      showDiagramCode ? (
                        <pre className="bg-[#1C1C1C] text-[#F9F7F2] p-4 overflow-auto text-sm font-mono">
                          {diagramCode}
                        </pre>
                      ) : (
                        <div ref={diagramRef} className="flex items-center justify-center min-h-[400px]" />
                      )
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Code className="h-12 w-12 mx-auto mb-4" style={{ color: "rgba(28, 28, 28, 0.3)" }} />
                          <p style={{ color: "rgba(28, 28, 28, 0.6)" }}>
                            No diagram generated yet. Generate a spec first, then click &quot;Generate Diagram&quot;.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: "rgba(28, 28, 28, 0.15)" }}>
                    <Button
                      onClick={handleGenerateDiagram}
                      disabled={isGeneratingDiagram}
                      variant="outline"
                      style={{ borderRadius: "0" }}
                    >
                      {isGeneratingDiagram ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
