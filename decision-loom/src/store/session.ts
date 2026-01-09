import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SectionKey, QAItem, Artifact, Suggestion } from "@/types/core";
import { SECTIONS, SECTION_ORDER } from "@/content/questions";

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
  getNextSection: () => SectionKey | null;
  getPrevSection: () => SectionKey | null;
  getProgress: () => { completed: number; total: number };
  reset: () => void;
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
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.completedSections)) {
          state.completedSections = new Set(state.completedSections as unknown as SectionKey[]);
        }
      },
    }
  )
);
