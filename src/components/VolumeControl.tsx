import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onChange: (value: number) => void;
  onToggleMute: () => void;
  isPlaying?: boolean;
}

export function VolumeControl({
  volume,
  isMuted,
  onChange,
  onToggleMute,
  isPlaying,
}: VolumeControlProps) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [recentlyChanged, setRecentlyChanged] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const changedTimerRef = useRef<number | null>(null);
  const firstRenderRef = useRef(true);

  const value = isMuted ? 0 : volume;

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    setRecentlyChanged(true);
    if (changedTimerRef.current) window.clearTimeout(changedTimerRef.current);
    changedTimerRef.current = window.setTimeout(
      () => setRecentlyChanged(false),
      1500,
    );
    return () => {
      if (changedTimerRef.current) window.clearTimeout(changedTimerRef.current);
    };
  }, [value]);

  const updateFromClientY = useCallback(
    (clientY: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = 1 - (clientY - rect.top) / rect.height;
      const clamped = Math.max(0, Math.min(1, ratio));
      onChange(Math.round(clamped * 100) / 100);
    },
    [onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      updateFromClientY(e.clientY);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, updateFromClientY]);

  const scheduleClose = () => {
    if (dragging) return;
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 200);
  };
  const cancelClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!dragging && !open && closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, [dragging, open]);

  return (
    <div
      ref={wrapRef}
      className="relative hidden sm:flex items-center"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={onToggleMute}
        className="p-1.5 rounded hover:bg-muted transition-colors"
        title={isMuted ? "Включить звук" : "Выключить звук"}
      >
        {isMuted || volume === 0 ? (
          <VolumeX className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Volume2 className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {(isPlaying || recentlyChanged) && !open && !dragging && (
        <span className="ml-1 text-[11px] font-mono text-muted-foreground tabular-nums select-none">
          {Math.round(value * 100)}%
        </span>
      )}

      {(open || dragging) && (
        <div
          className="absolute top-full right-0 mt-2 bg-card border border-border rounded-lg shadow-lg p-3 flex flex-col items-center z-50"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div
            ref={trackRef}
            onMouseDown={(e) => {
              e.preventDefault();
              setDragging(true);
              updateFromClientY(e.clientY);
            }}
            className="relative w-6 h-28 flex items-center justify-center cursor-pointer touch-none select-none"
          >
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1.5 rounded-full bg-muted" />
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1.5 rounded-full bg-gold pointer-events-none"
              style={{ height: `${value * 100}%` }}
            />
            <div
              className="absolute left-1/2 w-4 h-4 rounded-full bg-gold border-2 border-background shadow pointer-events-none"
              style={{
                bottom: `calc(${value * 100}% - 8px)`,
                transform: "translateX(-50%)",
              }}
            />
          </div>
          <div className="mt-1 text-[10px] font-mono text-muted-foreground tabular-nums">
            {Math.round(value * 100)}%
          </div>
        </div>
      )}
    </div>
  );
}

export default VolumeControl;
