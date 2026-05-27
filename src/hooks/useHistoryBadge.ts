import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getHistoryLastSeenAt,
  HISTORY_UPDATED_EVENT,
} from "@/lib/historyBadge";

export function useHistoryBadge() {
  const { user } = useAuth();
  const [totalCount, setTotalCount] = useState(0);
  const [newCount, setNewCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setTotalCount(0);
      setNewCount(0);
      return;
    }

    const lastSeen = getHistoryLastSeenAt();
    const [totalRes, newRes] = await Promise.all([
      supabase
        .from("transcriptions")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("transcriptions")
        .select("*", { count: "exact", head: true })
        .gt("created_at", lastSeen),
    ]);

    if (!totalRes.error && totalRes.count !== null) setTotalCount(totalRes.count);
    if (!newRes.error && newRes.count !== null) setNewCount(newRes.count);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener(HISTORY_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(HISTORY_UPDATED_EVENT, onUpdate);
  }, [refresh]);

  return { totalCount, newCount };
}
