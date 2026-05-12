import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStaleSessionRecovery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let lastRecovered = 0;

    const recover = async () => {
      const now = Date.now();
      if (now - lastRecovered < 2000) return;
      lastRecovered = now;

      try {
        await supabase.auth.getSession();
        try {
          const rt = (
            supabase as unknown as {
              realtime?: {
                disconnect: () => void;
                connect: () => void;
                isConnected?: () => boolean;
              };
            }
          ).realtime;
          if (rt && typeof rt.isConnected === "function" && !rt.isConnected()) {
            rt.disconnect();
            rt.connect();
          }
        } catch {
          // не критично
        }

        queryClient.invalidateQueries();
      } catch (err) {
        console.warn("Session recovery failed", err);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") recover();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", recover);
    window.addEventListener("online", recover);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", recover);
      window.removeEventListener("online", recover);
    };
  }, [queryClient]);
}
