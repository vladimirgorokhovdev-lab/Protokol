import { supabase } from "@/integrations/supabase/client";

export interface StalledJob {
  id: string;
  file_name: string;
  audio_path: string;
  status: "queued" | "processing" | "error";
  status_message: string | null;
  error: string | null;
  num_speakers: number | null;
  created_at: string;
  updated_at: string;
}

export async function loadStalledJobs(
  stuckMinutes = 10,
): Promise<StalledJob[]> {
  const cutoff = new Date(Date.now() - stuckMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from("transcription_jobs")
    .select(
      "id, file_name, audio_path, status, status_message, error, num_speakers, created_at, updated_at",
    )
    .or(
      `status.eq.error,and(status.in.(queued,processing),updated_at.lt.${cutoff})`,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to load stalled jobs:", error);
    return [];
  }
  return (data || []) as StalledJob[];
}

export async function deleteJob(jobId: string): Promise<boolean> {
  const { error } = await supabase
    .from("transcription_jobs")
    .delete()
    .eq("id", jobId);
  if (error) {
    console.error("Failed to delete job:", error);
    return false;
  }
  return true;
}

export async function retryJob(job: StalledJob): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke(
    "elevenlabs-transcribe",
    {
      body: {
        audio_path: job.audio_path,
        file_name: job.file_name,
        num_speakers: job.num_speakers ?? undefined,
      },
    },
  );

  if (error) {
    console.error("Retry invoke error:", error);
    return null;
  }
  const newId = (data as { job_id?: string })?.job_id ?? null;
  if (newId) {
    await deleteJob(job.id);
    window.dispatchEvent(
      new CustomEvent("transcription-job-created", {
        detail: { jobId: newId },
      }),
    );
  }
  return newId;
}
