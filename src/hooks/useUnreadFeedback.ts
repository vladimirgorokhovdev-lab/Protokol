import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "protokol-feedback-last-read";

function getLastReadAt(): string {
  return localStorage.getItem(STORAGE_KEY) || "1970-01-01T00:00:00Z";
}

function markAllRead() {
  localStorage.setItem(STORAGE_KEY, new Date().toISOString());
}

export function useUnreadFeedback() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) { setCount(0); return; }
    const lastRead = getLastReadAt();
    const { count: c, error } = await supabase
      .from("feedback")
      .select("*", { count: "exact", head: true })
      .gt("created_at", lastRead);

    if (!error && c !== null) setCount(c);
  }, [user]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`feedback-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback" },
        () => {
          setCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markRead = useCallback(() => {
    markAllRead();
    setCount(0);
  }, []);

  return { unreadCount: count, markRead };
}
