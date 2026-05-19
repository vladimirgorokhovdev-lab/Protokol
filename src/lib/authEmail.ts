import type { User } from "@supabase/supabase-js";

/** Email/password and OAuth users with verified email. */
export function isEmailConfirmed(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.email_confirmed_at) return true;

  const meta = user.app_metadata as Record<string, unknown> | undefined;
  if (meta?.email_verified === true) return true;

  const providers = user.app_metadata?.providers as string[] | undefined;
  if (
    providers?.some((p) => p === "google" || p === "apple" || p === "github")
  ) {
    return true;
  }

  return user.identities?.some((id) => {
    const data = id.identity_data as Record<string, unknown> | undefined;
    return data?.email_verified === true;
  }) ?? false;
}
