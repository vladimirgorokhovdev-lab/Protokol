import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApprovalStatus } from "@/hooks/useApprovalStatus";

export function useUnreadContact() {
  const { isAdmin } = useApprovalStatus();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isAdmin) { setCount(0); return; }
    const { count: c, error } = await supabase
      .from("contact_messages")
      .select("*", { count: "exact", head: true })
      .is("read_at", null);
    if (!error && c !== null) setCount(c);
  }, [isAdmin]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel(`contact-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_messages" },
        () => fetchCount(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, fetchCount]);

  return { unreadCount: count, refresh: fetchCount };
}
