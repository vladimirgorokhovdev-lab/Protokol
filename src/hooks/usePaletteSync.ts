import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyPalette,
  getStoredPalette,
  storePalette,
  type PaletteId,
  PALETTES,
  DEFAULT_PALETTE,
} from "@/lib/palettes";

declare global {
  interface Window {
    __hideSplash?: () => void;
  }
}

const hideSplash = () => {
  if (typeof window !== "undefined") window.__hideSplash?.();
};

const isValidPalette = (v: unknown): v is PaletteId =>
  typeof v === "string" && PALETTES.some((p) => p.id === v);

export function usePaletteSync() {
  const { user, loading: authLoading } = useAuth();
  const [current, setCurrent] = useState<PaletteId>(getStoredPalette());

  const guestChangedRef = useRef(false);
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      syncedUserIdRef.current = null;
      hideSplash();
      return;
    }

    if (syncedUserIdRef.current === user.id) {
      hideSplash();
      return;
    }
    syncedUserIdRef.current = user.id;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("palette")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.warn("Failed to load profile palette", error);
        hideSplash();
        return;
      }

      const dbPalette = isValidPalette(data?.palette)
        ? (data!.palette as PaletteId)
        : null;
      const localPalette = getStoredPalette();

      // Push local choice up if guest actively changed palette OR DB has only the default
      // and local differs from default
      const shouldPushLocal =
        guestChangedRef.current ||
        (dbPalette === DEFAULT_PALETTE && localPalette !== DEFAULT_PALETTE);

      if (shouldPushLocal && localPalette !== dbPalette) {
        const { error: upErr } = await supabase
          .from("profiles")
          .update({ palette: localPalette })
          .eq("user_id", user.id);
        if (upErr) console.warn("Failed to push palette to profile", upErr);
        guestChangedRef.current = false;
        hideSplash();
        return;
      }

      if (dbPalette && dbPalette !== current) {
        setCurrent(dbPalette);
        storePalette(dbPalette);
        applyPalette(dbPalette);
      }
      hideSplash();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const setPalette = useCallback(
    async (id: PaletteId) => {
      setCurrent(id);
      storePalette(id);
      applyPalette(id);

      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ palette: id })
          .eq("user_id", user.id);
        if (error) console.warn("Failed to save palette to profile", error);
      } else {
        guestChangedRef.current = true;
      }
    },
    [user],
  );

  return { current, setPalette };
}
