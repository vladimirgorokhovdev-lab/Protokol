import { detectJobStage, JOB_STAGES } from "@/lib/jobStages";
import { cn } from "@/lib/utils";

interface JobProgressBarProps {
  uploadProgress: number;
  statusMessage: string | null | undefined;
  status?: string;
}

export function JobProgressBar({
  uploadProgress,
  statusMessage,
  status,
}: JobProgressBarProps) {
  const stage = detectJobStage(uploadProgress, statusMessage, status);
  const currentIdx = JOB_STAGES.findIndex((s) => s.key === stage.key);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-500"
            style={{ width: `${stage.percent}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground font-mono w-10 text-right">
          {stage.percent}%
        </span>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto">
        {JOB_STAGES.map((s, i) => {
          const isDone = i < currentIdx || stage.key === "done";
          const isActive = i === currentIdx && stage.key !== "done";
          return (
            <div
              key={s.key}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors",
                isActive && "bg-gold/15 text-gold-dark font-medium",
                isDone && "text-muted-foreground/70",
                !isActive && !isDone && "text-muted-foreground/40",
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isDone && "bg-muted-foreground/50",
                  isActive && "bg-gold animate-pulse",
                  !isActive && !isDone && "bg-muted",
                )}
              />
              {s.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
