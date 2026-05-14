import { useEffect, useState, useCallback } from "react";
import { AlertCircle, Loader2, RotateCw, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { loadStalledJobs, retryJob, deleteJob, type StalledJob } from "@/lib/jobsService";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export function StalledJobsPanel() {
  const [jobs, setJobs] = useState<StalledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(async () => {
    const list = await loadStalledJobs(10);
    setJobs(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("stalled-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transcription_jobs" },
        () => refresh(),
      )
      .subscribe();
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const handleRetry = async (job: StalledJob) => {
    setBusyId(job.id);
    try {
      const newId = await retryJob(job);
      if (newId) {
        toast({ title: "Расшифровка перезапущена", description: job.file_name });
        await refresh();
      } else {
        toast({
          title: "Не удалось перезапустить",
          description: "Файл мог быть удалён из хранилища. Загрузите заново.",
          variant: "destructive",
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (job: StalledJob) => {
    setBusyId(job.id);
    try {
      const ok = await deleteJob(job.id);
      if (ok) {
        toast({ title: "Задача удалена" });
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loading || jobs.length === 0) return null;

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-destructive/10 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-sm font-medium text-foreground">
            Незавершённые расшифровки ({jobs.length})
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <ul className="divide-y divide-destructive/15">
          {jobs.map((job) => {
            const isBusy = busyId === job.id;
            const reason =
              job.status === "error"
                ? job.error || "Ошибка"
                : `Зависло на этапе: ${job.status_message || job.status}`;
            return (
              <li key={job.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {job.file_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {reason} ·{" "}
                    {format(new Date(job.created_at), "d MMM HH:mm", { locale: ru })}
                  </div>
                </div>
                <button
                  onClick={() => handleRetry(job)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-navy text-primary-foreground hover:bg-navy-light disabled:opacity-50 transition-colors"
                  title="Повторить расшифровку (без повторной загрузки)"
                >
                  {isBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="w-3.5 h-3.5" />
                  )}
                  Повторить
                </button>
                <button
                  onClick={() => handleDelete(job)}
                  disabled={isBusy}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                  title="Удалить задачу"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
