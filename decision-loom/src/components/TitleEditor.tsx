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
          className="h-8 w-64"
          autoFocus
        />
        <button
          onClick={handleSave}
          className="rounded p-1 hover:bg-muted"
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
      className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted"
    >
      <span className="font-medium">{title || "Untitled Product"}</span>
      <Pencil className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}
