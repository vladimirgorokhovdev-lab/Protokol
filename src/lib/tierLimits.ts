export const TIER_LIMITS = {
  free: {
    total: 1,
    monthly: null as number | null,
    monthlyHours: null as number | null,
    maxFileHours: 2,
    label: "Бесплатный",
  },
  basic: {
    total: null,
    monthly: 5,
    monthlyHours: 10,
    maxFileHours: null,
    label: "Базовый",
  },
  pro: {
    total: null,
    monthly: null,
    monthlyHours: 50,
    maxFileHours: null,
    label: "Про",
  },
  team: {
    total: null,
    monthly: null,
    monthlyHours: 100,
    maxFileHours: null,
    label: "Команда",
  },
} as const;

export type SubscriptionTier = keyof typeof TIER_LIMITS;

export function formatHoursFromSeconds(seconds: number): string {
  const h = seconds / 3600;
  if (h < 0.1) return "0 ч";
  return h >= 10 ? `${Math.round(h)} ч` : `${h.toFixed(1)} ч`;
}
