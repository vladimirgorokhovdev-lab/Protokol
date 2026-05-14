import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JobProgressBar } from "@/components/JobProgressBar";
import { toast } from "@/hooks/use-toast";

interface ActiveJob {
  id: string;
  file_name: string;
  status: "queued" | "processing";
  status_message: string | null;
  updated_at: string;
}

export function ActiveJobsPanel() {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const cancelledIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data, error } = await supabase
      .from("transcription_jobs")
      .select("id, file_name, status, status_message, updated_at")
      .in("status", ["queued", "processing"])
      .gte("updated_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error) {
      const filtered = (data || []).filter((j) => !cancelledIdsRef.current.has(j.id));
      setJobs(filtered as ActiveJob[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("active-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transcription_jobs" },
        () => refresh(),
      )
      .subscribe();
    const timer = window.setInterval(refresh, 5_000);
    const onJobCreated = () => refresh();
    window.addEventListener("transcription-job-created", onJobCreated);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(timer);
      window.removeEventListener("transcription-job-created", onJobCreated);
    };
  }, [refresh]);

  const handleCancel = async (job: ActiveJob) => {
    setCancellingId(job.id);
    cancelledIdsRef.current.add(job.id);
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    try {
      const { error } = await supabase
        .from("transcription_jobs")
        .update({ status: "cancelled", status_message: "Отменено пользователем" })
        .eq("id", job.id);
      if (error) {
        cancelledIdsRef.current.delete(job.id);
        await refresh();
        toast({ title: "Не удалось отменить", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Расшифровка отменена", description: job.file_name });
      }
    } finally {
      setCancellingId(null);
    }
  };

  if (loading || jobs.length === 0) return null;

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-gold/15">
        <Loader2 className="w-4 h-4 text-gold animate-spin flex-shrink-0" />
        <span className="text-sm font-medium text-foreground">
          Активные расшифровки ({jobs.length})
        </span>
      </div>
      <ul className="divide-y divide-gold/10">
        {jobs.map((job) => {
          const isCancelling = cancellingId === job.id;
          return (
            <li key={job.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {job.file_name}
                  </div>
                </div>
                <button
                  onClick={() => handleCancel(job)}
                  disabled={isCancelling}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                  title="Отменить расшифровку"
                >
                  {isCancelling ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <JobProgressBar
                uploadProgress={100}
                statusMessage={job.status_message}
                status={job.status}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
