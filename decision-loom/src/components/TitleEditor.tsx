"use client";

import { useState } from "react";
import { useSessionStore } from "@/store/session";
import { Input } from "@/components/ui/input";
import { Pencil, Check } from "lucide-react";

export function TitleEditor() {
  const { title, setTitle } = useSessionStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  const handleSave = () => {
    setTitle(editValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(title);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-8 w-64 rounded-none border-0 border-b-2 border-[rgba(28,28,28,0.15)] bg-transparent px-0 py-1 font-['Libre_Baskerville',serif] text-xl text-[#1C1C1C] placeholder:text-[rgba(28,28,28,0.4)] focus-visible:border-[#8C7B50] focus-visible:ring-0"
          autoFocus
        />
        <button
          onClick={handleSave}
          className="rounded-none p-1 text-[#8C7B50] opacity-60 hover:opacity-100"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setEditValue(title);
        setIsEditing(true);
      }}
      className="group flex items-center gap-2 rounded-none px-2 py-1 transition-opacity hover:opacity-80"
    >
      <span className="font-['Libre_Baskerville',serif] text-xl font-normal text-[#1C1C1C]">{title || "Untitled Product"}</span>
      <Pencil className="h-3 w-3 text-[#8C7B50] opacity-0 transition-opacity group-hover:opacity-60" />
    </button>
  );
}
