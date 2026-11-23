/** Default B2C Team seats (owner + members). */
export const DEFAULT_TEAM_MAX_MEMBERS = 5;
/** Court / B2B package seats — set on teams.max_members when provisioning. */
export const COURT_TEAM_MAX_MEMBERS = 30;

export const TIER_LIMITS = {
  free: {
    total: 1,
    monthly: null as number | null,
    monthlyHours: null as number | null,
    maxFileHours: 2,
    /** Max audio stored in Supabase Storage for this user (gigabytes). */
    maxAudioStorageGb: 1,
    /** Auto-remove audio after this many days (text stays). */
    audioRetentionDays: 7,
    label: "Бесплатный",
  },
  basic: {
    total: null,
    monthly: 5,
    monthlyHours: 10,
    maxFileHours: null,
    maxAudioStorageGb: 10,
    audioRetentionDays: 30,
    label: "Базовый",
  },
  pro: {
    total: null,
    monthly: null,
    monthlyHours: 50,
    maxFileHours: null,
    maxAudioStorageGb: 25,
    audioRetentionDays: 90,
    label: "Про",
  },
  team: {
    total: null,
    monthly: null,
    monthlyHours: 100,
    maxFileHours: null,
    /** Shared audio pool for the whole team. */
    maxAudioStorageGb: 50,
    audioRetentionDays: 90,
    /** Default seats; override per team via teams.max_members (court = 30). */
    maxMembers: DEFAULT_TEAM_MAX_MEMBERS,
    label: "Команда",
  },
} as const;

export type SubscriptionTier = keyof typeof TIER_LIMITS;

const BYTES_PER_GB = 1024 ** 3;

export function audioStorageLimitBytes(tier: SubscriptionTier): number {
  return TIER_LIMITS[tier].maxAudioStorageGb * BYTES_PER_GB;
}

export function formatHoursFromSeconds(seconds: number): string {
  const h = seconds / 3600;
  if (h < 0.1) return "0 ч";
  return h >= 10 ? `${Math.round(h)} ч` : `${h.toFixed(1)} ч`;
}

/** Human-readable used / limit for UI (e.g. "3.2 ГБ / 10 ГБ"). */
export function formatAudioStorageUsage(
  usedBytes: number,
  limitBytes: number,
): string {
  const fmt = (bytes: number) => {
    if (bytes >= BYTES_PER_GB) return `${(bytes / BYTES_PER_GB).toFixed(1)} ГБ`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} МБ`;
    return `${(bytes / 1024).toFixed(0)} КБ`;
  };
  return `${fmt(usedBytes)} / ${fmt(limitBytes)}`;
}
