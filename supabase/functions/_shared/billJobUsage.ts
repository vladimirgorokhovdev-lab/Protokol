import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/** Deduct job duration from user/team quota (idempotent). Service role only. */
export async function billJobUsage(
  admin: SupabaseClient,
  jobId: string,
): Promise<void> {
  const { error } = await admin.rpc("bill_transcription_job", {
    p_job_id: jobId,
  });
  if (error) {
    console.error(`[bill] job ${jobId}:`, error.message);
  }
}
