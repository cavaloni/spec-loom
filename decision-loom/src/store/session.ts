import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SectionKey, QAItem, Artifact, Suggestion } from "@/types/core";
import { SECTIONS, SECTION_ORDER } from "@/content/questions";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface SessionState {
  sessionId: string | null;
  title: string;
  activeKey: SectionKey;
  answersByKey: Record<SectionKey, { qa: QAItem[]; notes: string }>;
  summariesByKey: Record<SectionKey, string>;
  completedSections: Set<SectionKey>;
  prdArtifact: Artifact | null;
  techSpecArtifact: Artifact | null;
  suggestions: Suggestion[];
  isLoading: boolean;
  error: string | null;
  productDescription: string;
  hasStarted: boolean;
  // Prefill loading state
  isPrefilling: boolean;
  prefillError: string | null;
  // Artifact View
  isArtifactExpanded: boolean;
  isGenerating: boolean;
  streamingContent: string;
  // Chat refinement state
  chatMessages: ChatMessage[];
  isChatOpen: boolean;
  // Reflection modal state
  prdCopied: boolean;
  techSpecCopied: boolean;
  prdDownloaded: boolean;
  techSpecDownloaded: boolean;
  reflectionContent: string | null;
  isReflectionModalOpen: boolean;
  reflectionExpanded: boolean;
}

interface SessionActions {
  setSessionId: (id: string) => void;
  setTitle: (title: string) => void;
  setActiveKey: (key: SectionKey) => void;
  updateAnswer: (key: SectionKey, questionId: string, answer: string) => void;
  setNotes: (key: SectionKey, notes: string) => void;
  setSummary: (key: SectionKey, summary: string) => void;
  markSectionComplete: (key: SectionKey) => void;
  setPrdArtifact: (artifact: Artifact) => void;
  setTechSpecArtifact: (artifact: Artifact) => void;
  setSuggestions: (suggestions: Suggestion[]) => void;
  clearSuggestions: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setProductDescription: (description: string) => void;
  setHasStarted: (started: boolean) => void;
  // Prefill actions
  setIsPrefilling: (prefilling: boolean) => void;
  setPrefillError: (error: string | null) => void;
  startPrefill: (description: string) => Promise<void>;
  getNextSection: () => SectionKey | null;
  getPrevSection: () => SectionKey | null;
  getProgress: () => { completed: number; total: number };
  reset: () => void;
  // Artifact View actions
  toggleArtifactExpansion: () => void;
  setArtifactExpanded: (expanded: boolean) => void;
  // Streaming actions
  setIsGenerating: (generating: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  // Chat actions
  addChatMessage: (message: ChatMessage) => void;
  updateLastChatMessage: (content: string) => void;
  clearChatMessages: () => void;
  setIsChatOpen: (open: boolean) => void;
  // Reflection actions
  setPrdCopied: (copied: boolean) => void;
  setTechSpecCopied: (copied: boolean) => void;
  setPrdDownloaded: (downloaded: boolean) => void;
  setTechSpecDownloaded: (downloaded: boolean) => void;
  setReflectionContent: (content: string | null) => void;
  setIsReflectionModalOpen: (open: boolean) => void;
  setReflectionExpanded: (expanded: boolean) => void;
  hasBothArtifactsExported: () => boolean;
}

type SessionStore = SessionState & SessionActions;

const initialAnswers = (): Record<SectionKey, { qa: QAItem[]; notes: string }> => {
  const answers: Record<string, { qa: QAItem[]; notes: string }> = {};
  for (const section of SECTIONS) {
    answers[section.key] = {
      qa: section.questions.map((q) => ({
        questionId: q.id,
        question: q.prompt,
        answer: "",
      })),
      notes: "",
    };
  }
  return answers as Record<SectionKey, { qa: QAItem[]; notes: string }>;
};

const initialState: SessionState = {
  sessionId: null,
  title: "",
  activeKey: "CONTEXT",
  answersByKey: initialAnswers(),
  summariesByKey: {} as Record<SectionKey, string>,
  completedSections: new Set(),
  prdArtifact: null,
  techSpecArtifact: null,
  suggestions: [],
  isLoading: false,
  error: null,
  productDescription: "",
  hasStarted: false,
  isPrefilling: false,
  prefillError: null,
  isArtifactExpanded: false,
  isGenerating: false,
  streamingContent: "",
  chatMessages: [],
  isChatOpen: false,
  prdCopied: false,
  techSpecCopied: false,
  prdDownloaded: false,
  techSpecDownloaded: false,
  reflectionContent: null,
  isReflectionModalOpen: false,
  reflectionExpanded: false,
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSessionId: (id) => set({ sessionId: id }),

      setTitle: (title) => set({ title }),

      setActiveKey: (key) => set({ activeKey: key }),

      updateAnswer: (key, questionId, answer) =>
        set((state) => {
          const sectionAnswers = state.answersByKey[key];
          const updatedQa = sectionAnswers.qa.map((item) =>
            item.questionId === questionId ? { ...item, answer } : item
          );
          return {
            answersByKey: {
              ...state.answersByKey,
              [key]: { ...sectionAnswers, qa: updatedQa },
            },
          };
        }),

      setNotes: (key, notes) =>
        set((state) => ({
          answersByKey: {
            ...state.answersByKey,
            [key]: { ...state.answersByKey[key], notes },
          },
        })),

      setSummary: (key, summary) =>
        set((state) => ({
          summariesByKey: { ...state.summariesByKey, [key]: summary },
        })),

      markSectionComplete: (key) =>
        set((state) => {
          const newCompleted = new Set(state.completedSections);
          newCompleted.add(key);
          return { completedSections: newCompleted };
        }),

      setPrdArtifact: (artifact) => set({ prdArtifact: artifact }),

      setTechSpecArtifact: (artifact) => set({ techSpecArtifact: artifact }),

      setSuggestions: (suggestions) => set({ suggestions }),

      clearSuggestions: () => set({ suggestions: [] }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      setProductDescription: (description) => set({ productDescription: description }),

      setHasStarted: (started) => set({ hasStarted: started }),

      // Prefill actions
      setIsPrefilling: (prefilling) => set({ isPrefilling: prefilling }),
      setPrefillError: (error) => set({ prefillError: error }),
      startPrefill: async (description: string) => {
        set({ isPrefilling: true, prefillError: null });
        try {
          const controller = new AbortController();
          const timeoutMs = 120_000;
          const timer = setTimeout(() => controller.abort(), timeoutMs);

          const response = await fetch("/api/generate/prefill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description }),
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (!response.ok) {
            let serverMessage = "Failed to prefill answers";
            try {
              const maybeJson = await response.json();
              if (maybeJson?.error?.message) serverMessage = maybeJson.error.message;
            } catch {
              // ignore
            }
            throw new Error(serverMessage);
          }

          const data = await response.json();

          if (data.ok && data.data.answers) {
            const answers = data.data.answers as Record<SectionKey, { qa: QAItem[] }>;
            for (const [sectionKey, sectionData] of Object.entries(answers)) {
              for (const qaItem of sectionData.qa) {
                get().updateAnswer(
                  sectionKey as SectionKey,
                  qaItem.questionId,
                  qaItem.answer
                );
              }
            }
          }
        } catch (error) {
          console.error("Error prefilling:", error);
          const msg = error instanceof Error ? error.message : "Failed to generate initial answers. Please try again.";
          set({ prefillError: msg || "Failed to generate initial answers. Please try again." });
        } finally {
          set({ isPrefilling: false });
        }
      },

      getNextSection: () => {
        const { activeKey } = get();
        const currentIndex = SECTION_ORDER.indexOf(activeKey);
        if (currentIndex < SECTION_ORDER.length - 1) {
          return SECTION_ORDER[currentIndex + 1];
        }
        return null;
      },

      getPrevSection: () => {
        const { activeKey } = get();
        const currentIndex = SECTION_ORDER.indexOf(activeKey);
        if (currentIndex > 0) {
          return SECTION_ORDER[currentIndex - 1];
        }
        return null;
      },

      getProgress: () => {
        const { completedSections } = get();
        return {
          completed: completedSections.size,
          total: SECTION_ORDER.length,
        };
      },

      reset: () => set({ ...initialState, answersByKey: initialAnswers() }),

      // Artifact View actions
      toggleArtifactExpansion: () =>
        set((state) => ({ isArtifactExpanded: !state.isArtifactExpanded })),
      setArtifactExpanded: (expanded) => set({ isArtifactExpanded: expanded }),

      // Streaming actions
      setIsGenerating: (generating) => set({ isGenerating: generating }),
      setStreamingContent: (content) => set({ streamingContent: content }),
      appendStreamingContent: (chunk) =>
        set((state) => ({ streamingContent: state.streamingContent + chunk })),

      // Chat actions
      addChatMessage: (message) =>
        set((state) => ({ chatMessages: [...state.chatMessages, message] })),
      updateLastChatMessage: (content) =>
        set((state) => {
          const messages = [...state.chatMessages];
          if (messages.length > 0) {
            messages[messages.length - 1] = {
              ...messages[messages.length - 1],
              content,
            };
          }
          return { chatMessages: messages };
        }),
      clearChatMessages: () => set({ chatMessages: [] }),
      setIsChatOpen: (open) => set({ isChatOpen: open }),

      // Reflection actions
      setPrdCopied: (copied) => set({ prdCopied: copied }),
      setTechSpecCopied: (copied) => set({ techSpecCopied: copied }),
      setPrdDownloaded: (downloaded) => set({ prdDownloaded: downloaded }),
      setTechSpecDownloaded: (downloaded) => set({ techSpecDownloaded: downloaded }),
      setReflectionContent: (content) => set({ reflectionContent: content }),
      setIsReflectionModalOpen: (open) => set({ isReflectionModalOpen: open }),
      setReflectionExpanded: (expanded) => set({ reflectionExpanded: expanded }),
      hasBothArtifactsExported: () => {
        const { prdCopied, techSpecCopied, prdDownloaded, techSpecDownloaded } = get();
        return (prdCopied || prdDownloaded) && (techSpecCopied || techSpecDownloaded);
      },
    }),
    {
      name: "decision-loom-session",
      partialize: (state) => ({
        sessionId: state.sessionId,
        title: state.title,
        activeKey: state.activeKey,
        answersByKey: state.answersByKey,
        summariesByKey: state.summariesByKey,
        completedSections: Array.from(state.completedSections),
        prdArtifact: state.prdArtifact,
        techSpecArtifact: state.techSpecArtifact,
        productDescription: state.productDescription,
        hasStarted: state.hasStarted,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.completedSections)) {
          state.completedSections = new Set(state.completedSections as unknown as SectionKey[]);
        }
      },
    }
  )
);
