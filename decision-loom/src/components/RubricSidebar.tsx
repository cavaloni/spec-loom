"use client";

import { cn } from "@/lib/utils";
import { SECTIONS } from "@/content/questions";
import { useSessionStore } from "@/store/session";
import { Check } from "lucide-react";
import type { SectionKey } from "@/types/core";

export function RubricSidebar() {
  const { activeKey, setActiveKey, completedSections, getProgress } =
    useSessionStore();
  const progress = getProgress();

  return (
    <div className="flex h-full flex-col border-r border-[#8C7B50]/20 bg-[#F9F7F2]">
      <div className="border-b border-[#8C7B50]/20 p-4">
        <h2 className="text-lg font-semibold text-[#1C1C1C] font-['Libre_Baskerville']">Decision Loom</h2>
        <p className="text-sm text-[#1C1C1C]/60 font-['Inter']">
          {progress.completed}/{progress.total} sections complete
        </p>
        <div className="mt-2 h-2 w-full bg-[#1C1C1C]/10">
          <div
            className="h-full bg-[#8C7B50] transition-all"
            style={{
              width: `${(progress.completed / progress.total) * 100}%`,
            }}
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {SECTIONS.map((section, index) => {
            const isActive = activeKey === section.key;
            const isComplete = completedSections.has(section.key);
            const sectionNumber = String(index + 1).padStart(2, "0");

            return (
              <li key={section.key}>
                <button
                  onClick={() => setActiveKey(section.key as SectionKey)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                    isActive
                      ? "bg-[#8C7B50]/10 text-[#1C1C1C] opacity-100"
                      : "hover:bg-[#1C1C1C]/5 text-[#1C1C1C] opacity-50 hover:opacity-75",
                    isComplete && !isActive && "opacity-50"
                  )}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  <span
                    className="text-xs font-['JetBrains_Mono'] text-[#8C7B50]"
                  >
                    {sectionNumber}
                  </span>
                  <span className="flex-1">{section.label}</span>
                  {isActive && (
                    <span className="text-[#8C7B50] font-['JetBrains_Mono']">•</span>
                  )}
                  {isComplete && !isActive && (
                    <Check className="h-4 w-4 text-[#8C7B50]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[#8C7B50]/20 p-4">
        <p className="text-xs text-[#1C1C1C]/50 font-['JetBrains_Mono']">
          Complete all sections to generate your PRD and Tech Spec.
        </p>
        <p className="mt-2 text-xs text-[#1C1C1C]/40 font-['JetBrains_Mono']">
          v1.0.0
        </p>
      </div>
    </div>
  );
}
