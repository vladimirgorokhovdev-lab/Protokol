import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SubscriptionTier = "free" | "basic" | "pro" | "team";

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  autoRenew: boolean;
  paymentMethodSaved: boolean;
  totalUsed: number;
  monthlyUsed: number;
  canTranscribe: boolean;
  loading: boolean;
}

const TIER_LIMITS = {
  free: { total: 1, monthly: Infinity, label: "Бесплатный" },
  basic: { total: Infinity, monthly: 5, label: "Базовый" },
  pro: { total: Infinity, monthly: Infinity, label: "Про" },
  team: { total: Infinity, monthly: 100, label: "Команда" },
};

export function useSubscription(): SubscriptionInfo & {
  refresh: () => Promise<void>;
  createPayment: (tier: "basic" | "pro" | "team") => Promise<string | null>;
  setAutoRenew: (value: boolean) => Promise<boolean>;
} {
  const { user } = useAuth();
  const [info, setInfo] = useState<SubscriptionInfo>({
    tier: "free",
    status: "active",
    periodStart: null,
    periodEnd: null,
    autoRenew: true,
    paymentMethodSaved: false,
    totalUsed: 0,
    monthlyUsed: 0,
    canTranscribe: true,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setInfo((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: usage } = await supabase
        .from("transcription_usage")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const tier: SubscriptionTier = (sub?.tier as SubscriptionTier) || "free";
      const status = sub?.status || "active";
      const totalUsed = usage?.total_count || 0;
      
      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageMonth = usage?.month_start?.slice(0, 7);
      const monthlyUsed = usageMonth === currentMonth ? (usage?.monthly_count || 0) : 0;

      const { data: canTranscribe } = await supabase.rpc("can_user_transcribe", {
        p_user_id: user.id,
      });

      setInfo({
        tier,
        status,
        periodStart: sub?.current_period_start || null,
        periodEnd: sub?.current_period_end || null,
        autoRenew: sub?.auto_renew ?? true,
        paymentMethodSaved: Boolean((sub as { payment_method_id?: string | null } | null)?.payment_method_id),
        totalUsed,
        monthlyUsed,
        canTranscribe: canTranscribe ?? true,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
      setInfo((prev) => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createPayment = useCallback(
    async (tier: "basic" | "pro" | "team"): Promise<string | null> => {
      if (!user) return null;

      try {
        const { data, error } = await supabase.functions.invoke(
          "yookassa-create-payment",
          { body: { tier } }
        );

        if (error) throw error;
        return data.confirmation_url;
      } catch (error) {
        console.error("Payment creation failed:", error);
        return null;
      }
    },
    [user]
  );

  const setAutoRenew = useCallback(
    async (value: boolean): Promise<boolean> => {
      if (!user) return false;
      const prev = info.autoRenew;
      setInfo((s) => ({ ...s, autoRenew: value }));
      const { error } = await supabase
        .from("subscriptions")
        .update({ auto_renew: value })
        .eq("user_id", user.id);
      if (error) {
        console.error("Failed to update auto_renew:", error);
        setInfo((s) => ({ ...s, autoRenew: prev }));
        return false;
      }
      return true;
    },
    [user, info.autoRenew]
  );

  return { ...info, refresh, createPayment, setAutoRenew };
}

export { TIER_LIMITS };
