import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TIER_LIMITS } from "@/lib/tierLimits";
import { useAuth } from "@/contexts/AuthContext";

export interface TeamMember {
  id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  email?: string | null;
}

export interface TeamInvitation {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  owner_id: string;
}

export interface UseTeamResult {
  team: TeamInfo | null;
  role: "owner" | "member" | null;
  members: TeamMember[];
  invitations: TeamInvitation[];
  monthlyUsed: number;
  monthlySecondsUsed: number;
  monthlyHoursLimit: number;
  loading: boolean;
  refresh: () => Promise<void>;
  inviteMember: (email: string) => Promise<{ token?: string; error?: string }>;
  revokeInvitation: (id: string) => Promise<{ ok: boolean; error?: string }>;
  removeMember: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  leaveTeam: () => Promise<{ ok: boolean; error?: string }>;
  renameTeam: (name: string) => Promise<{ ok: boolean; error?: string }>;
}

function humanizeError(
  err: { message?: string; code?: string } | null | undefined,
): string {
  if (!err) return "Неизвестная ошибка";
  const msg = err.message || "";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg))
    return "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
  if (/JWT|token|expired/i.test(msg)) return "Сессия истекла. Войдите снова.";
  if (/row-level security|permission denied|not authorized/i.test(msg))
    return "Недостаточно прав для этого действия.";
  if (/Владельца команды нельзя удалить/i.test(msg))
    return "Нельзя удалить владельца команды.";
  if (/уже состоит/i.test(msg))
    return "Этот пользователь уже состоит в команде.";
  if (/уже существует/i.test(msg))
    return "Активное приглашение для этого email уже существует.";
  if (/лимит 5/i.test(msg)) return "Достигнут лимит 5 участников команды.";
  if (/приглашение не найдено|истекло/i.test(msg))
    return "Приглашение недействительно или истекло.";
  if (/другой email/i.test(msg))
    return "Это приглашение отправлено на другой email.";
  return msg || "Не удалось выполнить действие";
}

export function useTeam(): UseTeamResult {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [role, setRole] = useState<"owner" | "member" | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [monthlySecondsUsed, setMonthlySecondsUsed] = useState(0);
  const monthlyHoursLimit = TIER_LIMITS.team.monthlyHours ?? 100;
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTeam(null);
      setRole(null);
      setMembers([]);
      setInvitations([]);
      setMonthlyUsed(0);
      setMonthlySecondsUsed(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: myMembership } = await supabase
        .from("team_members")
        .select("team_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!myMembership) {
        setTeam(null);
        setRole(null);
        setMembers([]);
        setInvitations([]);
        setMonthlyUsed(0);
        setMonthlySecondsUsed(0);
        setLoading(false);
        return;
      }

      setRole(myMembership.role as "owner" | "member");

      const [{ data: teamData }, { data: memberRows }, { data: usageRow }] =
        await Promise.all([
          supabase
            .from("teams")
            .select("id, name, owner_id")
            .eq("id", myMembership.team_id)
            .maybeSingle(),
          supabase
            .from("team_members")
            .select("*")
            .eq("team_id", myMembership.team_id)
            .order("joined_at"),
          supabase
            .from("team_usage")
            .select("monthly_count, monthly_seconds, month_start")
            .eq("team_id", myMembership.team_id)
            .maybeSingle(),
        ]);

      setTeam(teamData ?? null);
      setMembers((memberRows as TeamMember[]) ?? []);

      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageMonth = (
        usageRow as { month_start?: string } | null
      )?.month_start?.slice(0, 7);
      const sameMonth = usageMonth === currentMonth;
      setMonthlyUsed(
        sameMonth
          ? (usageRow as { monthly_count?: number } | null)?.monthly_count || 0
          : 0,
      );
      setMonthlySecondsUsed(
        sameMonth
          ? (usageRow as { monthly_seconds?: number } | null)
              ?.monthly_seconds || 0
          : 0,
      );

      if (myMembership.role === "owner") {
        const { data: invs } = await supabase
          .from("team_invitations")
          .select("*")
          .eq("team_id", myMembership.team_id)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });
        setInvitations((invs as TeamInvitation[]) ?? []);
      } else {
        setInvitations([]);
      }
    } catch (err) {
      console.error("useTeam refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const inviteMember = useCallback(
    async (email: string) => {
      if (!user || !team) return { error: "Команда не загружена" };
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) return { error: "Введите email" };

      const [local, domain] = trimmed.split("@");
      let normalized = trimmed;
      if (domain === "gmail.com" || domain === "googlemail.com") {
        normalized = `${local.replace(/\./g, "").split("+")[0]}@gmail.com`;
      } else {
        normalized = `${local.split("+")[0]}@${domain}`;
      }

      const { data: existing } = await supabase
        .from("team_invitations")
        .select("id")
        .eq("team_id", team.id)
        .eq("email_normalized", normalized)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (existing) {
        return { error: "Активное приглашение для этого email уже существует" };
      }

      const { data, error } = await supabase
        .from("team_invitations")
        .insert({
          team_id: team.id,
          email: trimmed,
          email_normalized: normalized,
          invited_by: user.id,
        })
        .select("token")
        .single();

      if (error) {
        console.error("Invite failed:", error);
        const msg = error.message || "";
        if (/уже существует/i.test(msg))
          return {
            error: "Активное приглашение для этого email уже существует",
          };
        if (/уже состоит/i.test(msg))
          return { error: "Этот пользователь уже состоит в команде" };
        return { error: "Не удалось создать приглашение" };
      }
      await refresh();
      return { token: data.token };
    },
    [user, team, refresh],
  );

  const revokeInvitation = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("team_invitations")
        .delete()
        .eq("id", id);
      if (error) return { ok: false, error: humanizeError(error) };
      await refresh();
      return { ok: true };
    },
    [refresh],
  );

  const removeMember = useCallback(
    async (userId: string) => {
      if (!team) return { ok: false, error: "Команда не загружена" };
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", team.id)
        .eq("user_id", userId);
      if (error) return { ok: false, error: humanizeError(error) };
      await refresh();
      return { ok: true };
    },
    [team, refresh],
  );

  const leaveTeam = useCallback(async () => {
    if (!user || !team) return { ok: false, error: "Команда не загружена" };
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("user_id", user.id)
      .eq("team_id", team.id);
    if (error) return { ok: false, error: humanizeError(error) };
    await refresh();
    return { ok: true };
  }, [user, team, refresh]);

  const renameTeam = useCallback(
    async (name: string) => {
      if (!team) return { ok: false, error: "Команда не загружена" };
      const { error } = await supabase
        .from("teams")
        .update({ name })
        .eq("id", team.id);
      if (error) return { ok: false, error: humanizeError(error) };
      await refresh();
      return { ok: true };
    },
    [team, refresh],
  );

  return {
    team,
    role,
    members,
    invitations,
    monthlyUsed,
    monthlySecondsUsed,
    monthlyHoursLimit,
    loading,
    refresh,
    inviteMember,
    revokeInvitation,
    removeMember,
    leaveTeam,
    renameTeam,
  };
}
