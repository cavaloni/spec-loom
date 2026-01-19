"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SECTIONS } from "@/content/questions";
import { useSessionStore } from "@/store/session";
import { Check, ChevronDown } from "lucide-react";
import type { SectionKey, ProjectScope } from "@/types/core";
import { PROJECT_SCOPE_CONFIG } from "@/types/core";

const SCOPE_OPTIONS: ProjectScope[] = ["personal", "mvp", "production"];

export function RubricSidebar() {
  const { activeKey, setActiveKey, completedSections, getProgress, projectScope, setProjectScope } =
    useSessionStore();
  const progress = getProgress();
  const [isScopeOpen, setIsScopeOpen] = useState(false);

  return (
    <div className="flex h-full flex-col border-r border-[#8C7B50]/20 bg-[#F9F7F2]">
      <div className="border-b border-[#8C7B50]/20 p-4">
        <div className="flex items-center gap-2">
          <div className="rounded bg-[#8C7B50] p-1.5">
            <Check className="h-3.5 w-3.5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-[#1C1C1C] font-['Libre_Baskerville']">Spec Loom</h2>
        </div>
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

        {/* Scope Selector Pill */}
        <div className="mt-3 relative">
          <button
            onClick={() => setIsScopeOpen(!isScopeOpen)}
            className="flex w-full items-center justify-between gap-2 rounded-sm border border-[#8C7B50]/30 bg-[#8C7B50]/5 px-2.5 py-1.5 text-xs font-['Inter'] text-[#1C1C1C] hover:bg-[#8C7B50]/10 transition-colors"
          >
            <span className="text-[#8C7B50] font-medium">Scope:</span>
            <span className="flex-1 text-left">{PROJECT_SCOPE_CONFIG[projectScope].label}</span>
            <ChevronDown className={cn("h-3 w-3 text-[#8C7B50] transition-transform", isScopeOpen && "rotate-180")} />
          </button>
          
          {isScopeOpen && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-[#8C7B50]/30 bg-[#F9F7F2] shadow-md">
              {SCOPE_OPTIONS.map((scope) => (
                <button
                  key={scope}
                  onClick={() => {
                    setProjectScope(scope);
                    setIsScopeOpen(false);
                  }}
                  className={cn(
                    "flex w-full flex-col items-start px-2.5 py-2 text-left text-xs font-['Inter'] hover:bg-[#8C7B50]/10 transition-colors",
                    projectScope === scope && "bg-[#8C7B50]/10"
                  )}
                >
                  <span className={cn("font-medium", projectScope === scope ? "text-[#8C7B50]" : "text-[#1C1C1C]")}>
                    {PROJECT_SCOPE_CONFIG[scope].label}
                  </span>
                  <span className="text-[#1C1C1C]/50 text-[10px]">
                    {PROJECT_SCOPE_CONFIG[scope].description}
                  </span>
                </button>
              ))}
            </div>
          )}
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
