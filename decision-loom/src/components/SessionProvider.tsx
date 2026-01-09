"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/session";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { sessionId, setSessionId } = useSessionStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initSession = async () => {
      if (!sessionId) {
        try {
          const res = await fetch("/api/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "New Product" }),
          });

          const data = await res.json();
          if (data.ok) {
            setSessionId(data.data.sessionId);
          }
        } catch (err) {
          console.error("Failed to create session:", err);
        }
      }
      setIsInitialized(true);
    };

    initSession();
  }, [sessionId, setSessionId]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Initializing session...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
