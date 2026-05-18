import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  TIER_LIMITS,
  formatHoursFromSeconds,
  type SubscriptionTier,
} from "@/lib/tierLimits";

export type { SubscriptionTier };

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  /** Personal subscription tier (without team override). */
  personalTier: SubscriptionTier;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  autoRenew: boolean;
  paymentMethodSaved: boolean;
  totalUsed: number;
  monthlyUsed: number;
  monthlySecondsUsed: number;
  canTranscribe: boolean;
  canUseAiSummary: boolean;
  loading: boolean;
}

export function useSubscription(): SubscriptionInfo & {
  refresh: () => Promise<void>;
  createPayment: (tier: "basic" | "pro" | "team") => Promise<string | null>;
  setAutoRenew: (value: boolean) => Promise<boolean>;
  checkCanTranscribe: (estimatedSeconds: number) => Promise<boolean>;
} {
  const { user } = useAuth();
  const [info, setInfo] = useState<SubscriptionInfo>({
    tier: "free",
    personalTier: "free",
    status: "active",
    periodStart: null,
    periodEnd: null,
    autoRenew: true,
    paymentMethodSaved: false,
    totalUsed: 0,
    monthlyUsed: 0,
    monthlySecondsUsed: 0,
    canTranscribe: true,
    canUseAiSummary: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setInfo((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      const [
        { data: sub },
        { data: usage },
        { data: membership },
        { data: canTranscribe },
        { data: canUseAiSummary },
      ] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .is("team_id", null)
          .maybeSingle(),
        supabase
          .from("transcription_usage")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("can_user_transcribe", {
          p_user_id: user.id,
          p_estimated_seconds: 0,
        }),
        supabase.rpc("can_use_ai_summary", { p_user_id: user.id }),
      ]);

      const personalTier: SubscriptionTier =
        (sub?.tier as SubscriptionTier) || "free";
      const status = sub?.status || "active";
      const totalUsed = usage?.total_count || 0;

      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageMonth = usage?.month_start?.slice(0, 7);
      const sameMonth = usageMonth === currentMonth;
      const monthlyUsed = sameMonth ? usage?.monthly_count || 0 : 0;
      let monthlySecondsUsed = sameMonth
        ? Number(usage?.monthly_seconds || 0)
        : 0;
      let tier: SubscriptionTier = personalTier;
      let periodStart = sub?.current_period_start || null;
      let periodEnd = sub?.current_period_end || null;
      let effectiveStatus = status;

      if (membership?.team_id) {
        const [{ data: teamSub }, { data: teamUsage }] = await Promise.all([
          supabase
            .from("subscriptions")
            .select("*")
            .eq("team_id", membership.team_id)
            .maybeSingle(),
          supabase
            .from("team_usage")
            .select("monthly_seconds, month_start")
            .eq("team_id", membership.team_id)
            .maybeSingle(),
        ]);
        if (teamSub?.tier === "team" && teamSub?.status === "active") {
          tier = "team";
          effectiveStatus = teamSub.status;
          periodStart = teamSub.current_period_start;
          periodEnd = teamSub.current_period_end;
          const teamMonth = teamUsage?.month_start?.slice(0, 7);
          monthlySecondsUsed =
            teamMonth === currentMonth
              ? Number(teamUsage?.monthly_seconds || 0)
              : 0;
        }
      }

      setInfo({
        tier,
        personalTier,
        status: effectiveStatus,
        periodStart,
        periodEnd,
        autoRenew: sub?.auto_renew ?? true,
        paymentMethodSaved: Boolean(
          (sub as { payment_method_id?: string | null } | null)
            ?.payment_method_id,
        ),
        totalUsed,
        monthlyUsed,
        monthlySecondsUsed,
        canTranscribe: canTranscribe ?? true,
        canUseAiSummary: canUseAiSummary ?? false,
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

  const checkCanTranscribe = useCallback(
    async (estimatedSeconds: number): Promise<boolean> => {
      if (!user) return false;
      const { data } = await supabase.rpc("can_user_transcribe", {
        p_user_id: user.id,
        p_estimated_seconds: Math.max(0, Math.round(estimatedSeconds)),
      });
      return data ?? false;
    },
    [user],
  );

  const createPayment = useCallback(
    async (tier: "basic" | "pro" | "team"): Promise<string | null> => {
      if (!user) return null;

      try {
        const { data, error } = await supabase.functions.invoke(
          "yookassa-create-payment",
          { body: { tier } },
        );

        if (error) throw error;
        return data.confirmation_url;
      } catch (error) {
        console.error("Payment creation failed:", error);
        return null;
      }
    },
    [user],
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
    [user, info.autoRenew],
  );

  return {
    ...info,
    refresh,
    createPayment,
    setAutoRenew,
    checkCanTranscribe,
  };
}

export { TIER_LIMITS, formatHoursFromSeconds };
