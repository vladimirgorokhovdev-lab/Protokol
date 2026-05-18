import { supabase } from "@/integrations/supabase/client";

/** Idempotent: charges quota once per completed job (fallback if server billing missed). */
export async function billMyTranscriptionJob(jobId: string): Promise<void> {
  const { error } = await supabase.rpc("bill_my_transcription_job", {
    p_job_id: jobId,
  });
  if (error) console.error("bill_my_transcription_job:", error.message);
}
