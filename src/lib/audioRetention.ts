import { supabase } from "@/integrations/supabase/client";
import {
  TIER_LIMITS,
  audioStorageLimitBytes,
  type SubscriptionTier,
} from "@/lib/tierLimits";
import { deleteTranscriptionAudio } from "@/lib/transcriptionStorage";

type AudioScope =
  | { kind: "user"; userId: string }
  | { kind: "team"; teamId: string };

async function fetchEffectiveTier(userId: string): Promise<SubscriptionTier> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", userId)
    .is("team_id", null)
    .maybeSingle();

  let tier = (sub?.tier as SubscriptionTier) || "free";
  if (sub?.status !== "active") tier = "free";

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (membership?.team_id) {
    const { data: teamSub } = await supabase
      .from("subscriptions")
      .select("tier, status")
      .eq("team_id", membership.team_id)
      .maybeSingle();
    if (teamSub?.tier === "team" && teamSub?.status === "active") {
      return "team";
    }
  }

  return tier in TIER_LIMITS ? tier : "free";
}

async function resolveAudioScope(userId: string): Promise<{
  scope: AudioScope;
  tier: SubscriptionTier;
}> {
  const tier = await fetchEffectiveTier(userId);
  if (tier === "team") {
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (membership?.team_id) {
      return { scope: { kind: "team", teamId: membership.team_id }, tier };
    }
  }
  return { scope: { kind: "user", userId }, tier };
}

function scopeQuery(scope: AudioScope) {
  let q = supabase
    .from("transcriptions")
    .select("id, audio_path, audio_size_bytes, created_at")
    .not("audio_path", "is", null);

  if (scope.kind === "team") {
    q = q.eq("team_id", scope.teamId);
  } else {
    q = q.eq("user_id", scope.userId);
  }
  return q;
}

export async function getAudioStorageStats(userId: string): Promise<{
  usedBytes: number;
  limitBytes: number;
  tier: SubscriptionTier;
  retentionDays: number;
}> {
  const { scope, tier } = await resolveAudioScope(userId);
  const { data, error } = await scopeQuery(scope);

  if (error) {
    console.error("getAudioStorageStats:", error);
    return {
      usedBytes: 0,
      limitBytes: audioStorageLimitBytes(tier),
      tier,
      retentionDays: TIER_LIMITS[tier].audioRetentionDays,
    };
  }

  const usedBytes = (data ?? []).reduce(
    (sum, row) => sum + Number(row.audio_size_bytes || 0),
    0,
  );

  return {
    usedBytes,
    limitBytes: audioStorageLimitBytes(tier),
    tier,
    retentionDays: TIER_LIMITS[tier].audioRetentionDays,
  };
}

/** Drop audio older than tier retention (transcript text remains). */
export async function purgeExpiredAudioForScope(
  scope: AudioScope,
  tier: SubscriptionTier,
): Promise<void> {
  const days = TIER_LIMITS[tier].audioRetentionDays;
  const cutoff = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await scopeQuery(scope).lt("created_at", cutoff);

  if (error || !data?.length) return;

  for (const row of data) {
    if (row.audio_path) {
      await deleteTranscriptionAudio(row.id, row.audio_path);
    }
  }
}

/** Remove audio from oldest entries until used storage is within GB quota. */
export async function enforceAudioStorageQuota(
  scope: AudioScope,
  tier: SubscriptionTier,
): Promise<void> {
  const limitBytes = audioStorageLimitBytes(tier);
  const { data, error } = await scopeQuery(scope).order("created_at", {
    ascending: true,
  });

  if (error || !data?.length) return;

  let usedBytes = data.reduce(
    (sum, row) => sum + Number(row.audio_size_bytes || 0),
    0,
  );

  for (const row of data) {
    if (usedBytes <= limitBytes) break;
    if (!row.audio_path) continue;
    const size = Number(row.audio_size_bytes || 0);
    const ok = await deleteTranscriptionAudio(row.id, row.audio_path);
    if (ok) usedBytes = Math.max(0, usedBytes - size);
  }
}

export async function applyAudioRetentionPolicy(
  userId: string,
): Promise<void> {
  const { scope, tier } = await resolveAudioScope(userId);
  await purgeExpiredAudioForScope(scope, tier);
  await enforceAudioStorageQuota(scope, tier);
}

