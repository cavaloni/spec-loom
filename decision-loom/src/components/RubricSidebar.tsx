"use client";

import { cn } from "@/lib/utils";
import { SECTIONS } from "@/content/questions";
import { useSessionStore } from "@/store/session";
import { Check, Circle } from "lucide-react";
import type { SectionKey } from "@/types/core";

export function RubricSidebar() {
  const { activeKey, setActiveKey, completedSections, getProgress } =
    useSessionStore();
  const progress = getProgress();

  return (
    <div className="flex h-full flex-col border-r bg-muted/30">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Decision Loom</h2>
        <p className="text-sm text-muted-foreground">
          {progress.completed}/{progress.total} sections complete
        </p>
        <div className="mt-2 h-2 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${(progress.completed / progress.total) * 100}%`,
            }}
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {SECTIONS.map((section) => {
            const isActive = activeKey === section.key;
            const isComplete = completedSections.has(section.key);

            return (
              <li key={section.key}>
                <button
                  onClick={() => setActiveKey(section.key as SectionKey)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                    isComplete && !isActive && "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      isComplete
                        ? "border-green-500 bg-green-500 text-white"
                        : isActive
                          ? "border-primary-foreground"
                          : "border-muted-foreground"
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Circle className="h-2 w-2" />
                    )}
                  </span>
                  <span className="flex-1">{section.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          Complete all sections to generate your PRD and Tech Spec.
        </p>
      </div>
    </div>
  );
}
