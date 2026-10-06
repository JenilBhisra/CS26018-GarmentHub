/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";

interface RealTimeChatParams {
  conversationId: string | null;
  onNewMessages: (messages: any[]) => void;
  onTypingChange: (typingUserIds: string[]) => void;
  onParticipantsSync: (participants: any[]) => void;
  onModerationSync: (data: { isSuspended: boolean; suspendedReason: string | null }) => void;
}

export function useRealTimeChat({
  conversationId,
  onNewMessages,
  onTypingChange,
  onParticipantsSync,
  onModerationSync,
}: RealTimeChatParams) {
  const lastFetchedAtRef = useRef<string | null>(null);
  const activeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isTabFocused, setIsTabFocused] = useState(true);

  // Sync function to pull incremental updates
  const syncChat = async () => {
    if (!conversationId) return;

    try {
      const url = new URL("/api/chat/sync", window.location.origin);
      url.searchParams.set("conversationId", conversationId);
      if (lastFetchedAtRef.current) {
        url.searchParams.set("lastFetchedAt", lastFetchedRefUnix(lastFetchedAtRef.current));
      }

      const res = await fetch(url.toString());
      if (!res.ok) return;

      const data = await res.json();
      if (data.success) {
        if (data.messages && data.messages.length > 0) {
          onNewMessages(data.messages);
        }
        onTypingChange(data.typingUserIds || []);
        onParticipantsSync(data.otherParticipants || []);
        onModerationSync({
          isSuspended: data.isSuspended || false,
          suspendedReason: data.suspendedReason || null,
        });

        // Track last fetch sync time
        lastFetchedAtRef.current = data.syncTime;
      }
    } catch (error) {
      console.error("[useRealTimeChat] Sync error:", error);
    }
  };

  // Helper to subtract 100ms from lastFetchedAt to capture any race conditions
  const lastFetchedRefUnix = (isoStr: string) => {
    const d = new Date(isoStr);
    d.setMilliseconds(d.getMilliseconds() - 100);
    return d.toISOString();
  };

  // Setup tab focus and visibility listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      const active = document.visibilityState === "visible";
      setIsTabFocused(active);
    };

    window.addEventListener("focus", () => setIsTabFocused(true));
    window.addEventListener("blur", () => setIsTabFocused(false));
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", () => setIsTabFocused(true));
      window.removeEventListener("blur", () => setIsTabFocused(false));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Poll controller
  useEffect(() => {
    // Reset tracker when conversation swaps
    lastFetchedAtRef.current = null;
    
    if (!conversationId) {
      if (activeIntervalRef.current) {
        clearInterval(activeIntervalRef.current);
        activeIntervalRef.current = null;
      }
      return;
    }

    // Initial load immediately
    syncChat();

    // Setup polling: 3 seconds when active/focused. Slower 15 seconds (or paused) when blurred/hidden.
    const intervalTime = isTabFocused ? 3000 : 15000;

    if (activeIntervalRef.current) {
      clearInterval(activeIntervalRef.current);
    }

    activeIntervalRef.current = setInterval(() => {
      syncChat();
    }, intervalTime);

    return () => {
      if (activeIntervalRef.current) {
        clearInterval(activeIntervalRef.current);
      }
    };
  }, [conversationId, isTabFocused]);

  return {
    triggerSync: syncChat,
  };
}
