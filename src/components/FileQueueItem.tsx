import { useState, useRef, useEffect, useCallback } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  FileAudio,
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Ban,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { QueueItem } from "@/hooks/useTranscriptionQueue";
import TranscriptionView from "./TranscriptionView";
import { type ReplacementMatch } from "./ReplacementConfirm";
import {
  loadReplacementRules,
  findMatches,
  applyReplacements,
} from "@/lib/replacementEngine";
import {
  mergeSpeakersInDb,
  reassignSegmentSpeaker,
  deleteSegment,
  updateSegmentText,
} from "@/lib/transcriptionStorage";
import type { TranscriptSegment } from "@/lib/transcript";
import { ReplacementRulesManager } from "@/components/ReplacementRulesManager";
import { JobProgressBar } from "@/components/JobProgressBar";
import { toast } from "@/hooks/use-toast";

interface FileQueueItemProps {
  item: QueueItem;
  onCancel: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onRenameSpeaker?: (originalName: string, newName: string) => void;
}

const getMimeType = (name: string): string => {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
    webm: "audio/webm",
    aac: "audio/aac",
    flac: "audio/flac",
  };
  return map[ext || ""] || "audio/mpeg";
};

const formatTime = (seconds: number) => {
  if (!isFinite(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: (
    <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
  ),
  processing: <Loader2 className="w-3.5 h-3.5 text-gold-dark animate-spin" />,
  done: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  error: <AlertCircle className="w-3.5 h-3.5 text-destructive" />,
  cancelled: <Ban className="w-3.5 h-3.5 text-muted-foreground" />,
};

const STATUS_BORDER: Record<string, string> = {
  pending: "border-border",
  processing: "border-gold/30",
  done: "border-green-500/20",
  error: "border-destructive/20",
  cancelled: "border-border",
};

const FileQueueItem = ({
  item,
  onCancel,
  onRemove,
  onRetry,
  onRenameSpeaker,
}: FileQueueItemProps) => {
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolume, setShowVolume] = useState(false);
  const [replacementMatches, setReplacementMatches] = useState<
    ReplacementMatch[]
  >([]);
  const [localSegments, setLocalSegments] = useState<
    TranscriptSegment[] | null
  >(null);
  const [speakerUndoStack, setSpeakerUndoStack] = useState<
    TranscriptSegment[][]
  >([]);
  const [replacementChecked, setReplacementChecked] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(
    null,
  );
  const [showNextButton, setShowNextButton] = useState(false);
  const [continuousPlay, setContinuousPlay] = useState(false);
  const [fragmentReviewMode, setFragmentReviewMode] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fragmentReviewRef = useRef<{
    index: number;
    startTime: number;
    endTime: number;
  } | null>(null);
  const continuousPlayRef = useRef(false);
  const fragmentReviewModeRef = useRef(false);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const [playerVisible, setPlayerVisible] = useState(true);

  const updateContinuousPlay = useCallback((next: boolean) => {
    continuousPlayRef.current = next;
    setContinuousPlay(next);
  }, []);

  const updateFragmentReviewMode = useCallback((next: boolean) => {
    fragmentReviewModeRef.current = next;
    setFragmentReviewMode(next);
  }, []);

  useEffect(() => {
    if (!playerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPlayerVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(playerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (item.status === "done" && item.segments && !replacementChecked) {
      setReplacementChecked(true);
      loadReplacementRules().then((rules) => {
        if (rules.length === 0) return;
        const matches = findMatches(item.segments!, rules);
        if (matches.length > 0) {
          setReplacementMatches(matches);
        }
      });
    }
  }, [item.status, item.segments, replacementChecked]);

  const handleReplacementAccept = (match: ReplacementMatch) => {
    if (item.segments) {
      const segs = localSegments || item.segments;
      const updated = applyReplacements(segs, [match]);
      setLocalSegments(updated);
      const changed = updated[match.segmentIndex];
      if (changed?.id) {
        updateSegmentText(changed.id, changed.text).catch((e) =>
          console.error("Failed to persist replacement:", e),
        );
      }
    }
    setReplacementMatches((prev) => prev.filter((m) => m !== match));
  };

  const handleRuleAdded = useCallback(
    (rule: { find_text: string; replace_text: string }) => {
      const segs = localSegments || item.segments;
      if (!segs) return;
      const matches = findMatches(segs, [rule]);
      if (matches.length === 0) {
        toast({
          title: "Совпадений не найдено",
          description: `«${rule.find_text}» не встречается в расшифровке`,
        });
        return;
      }
      const updated = applyReplacements(segs, matches);
      setLocalSegments(updated);
      const changedIdx = new Set(matches.map((m) => m.segmentIndex));
      for (const idx of changedIdx) {
        const seg = updated[idx];
        if (seg?.id) {
          updateSegmentText(seg.id, seg.text).catch((e) =>
            console.error("Failed to persist replacement:", e),
          );
        }
      }
      setReplacementMatches((prev) =>
        prev.filter(
          (m) => m.find.toLowerCase() !== rule.find_text.toLowerCase(),
        ),
      );
      toast({
        title: "Заменено",
        description: `${matches.length} совпадений: «${rule.find_text}» → «${rule.replace_text}»`,
      });
    },
    [localSegments, item.segments],
  );

  const handleReplacementDismiss = (match: ReplacementMatch) => {
    setReplacementMatches((prev) => prev.filter((m) => m !== match));
  };

  const handleMergeSegments = useCallback(
    (index: number) => {
      const segs = [...(localSegments || item.segments || [])];
      if (index < 0 || index >= segs.length - 1) return;
      const current = segs[index];
      const next = segs[index + 1];
      const merged: TranscriptSegment = {
        ...current,
        text: current.text + " " + next.text,
        endTime: next.endTime,
      };
      segs.splice(index, 2, merged);
      setLocalSegments(segs);
      toast({ title: "Объединено", description: "Два сегмента объединены" });
    },
    [localSegments, item.segments],
  );

  const handleSplitSegment = useCallback(
    (index: number, splitPos: number) => {
      const segs = [...(localSegments || item.segments || [])];
      if (index < 0 || index >= segs.length) return;
      const seg = segs[index];
      const midTime =
        seg.startTime +
        ((seg.endTime - seg.startTime) * splitPos) / seg.text.length;
      const part1: TranscriptSegment = {
        ...seg,
        id: seg.id,
        text: seg.text.slice(0, splitPos).trim(),
        endTime: midTime,
      };
      const part2: TranscriptSegment = {
        ...seg,
        id: crypto.randomUUID(),
        text: seg.text.slice(splitPos).trim(),
        startTime: midTime,
      };
      segs.splice(index, 1, part1, part2);
      setLocalSegments(segs);
      toast({ title: "Разделено", description: "Сегмент разделён на два" });
    },
    [localSegments, item.segments],
  );

  const handleDeleteSegment = useCallback(
    (index: number) => {
      const segs = [...(localSegments || item.segments || [])];
      if (index < 0 || index >= segs.length) return;
      const seg = segs[index];
      segs.splice(index, 1);
      setLocalSegments(segs);
      if (seg.id) deleteSegment(seg.id).catch(console.error);
      toast({ title: "Удалено", description: "Фрагмент удалён" });
    },
    [localSegments, item.segments],
  );

  const handleDeleteSegments = useCallback(
    (indices: number[]) => {
      if (!indices || indices.length === 0) return;
      const segs = [...(localSegments || item.segments || [])];
      const toRemove = new Set(indices);
      const removedIds: string[] = [];
      const remaining = segs.filter((s, i) => {
        if (toRemove.has(i)) {
          if (s.id) removedIds.push(s.id);
          return false;
        }
        return true;
      });
      setLocalSegments(remaining);
      removedIds.forEach((id) => deleteSegment(id).catch(console.error));
      toast({
        title: "Удалено",
        description: `Фрагментов удалено: ${indices.length}`,
      });
    },
    [localSegments, item.segments],
  );

  const handleMergeSpeakers = useCallback(
    (fromSpeaker: string, toSpeaker: string) => {
      const allSegs = localSegments || item.segments || [];
      setSpeakerUndoStack((prev) => [...prev, [...allSegs]]);

      const targetSeg = allSegs.find((t) => t.speaker === toSpeaker);
      const targetIndex = targetSeg ? targetSeg.speakerIndex : 0;

      const segs = allSegs.map((s) => {
        if (s.speaker === fromSpeaker) {
          return { ...s, speaker: toSpeaker, speakerIndex: targetIndex };
        }
        return s;
      });
      setLocalSegments(segs);

      if (item.dbId) {
        mergeSpeakersInDb(item.dbId, fromSpeaker, toSpeaker, targetIndex).catch(
          console.error,
        );
      }
    },
    [localSegments, item.segments, item.dbId],
  );

  const handleReassignSegmentSpeaker = useCallback(
    (segmentId: string, newSpeaker: string, newSpeakerIndex: number) => {
      const allSegs = localSegments || item.segments || [];
      setSpeakerUndoStack((prev) => [...prev, [...allSegs]]);

      setLocalSegments(
        allSegs.map((s) =>
          s.id === segmentId
            ? { ...s, speaker: newSpeaker, speakerIndex: newSpeakerIndex }
            : s,
        ),
      );
      reassignSegmentSpeaker(segmentId, newSpeaker, newSpeakerIndex).catch(
        console.error,
      );
    },
    [localSegments, item.segments],
  );

  const handleUndoSpeakerChange = useCallback(() => {
    setSpeakerUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const snapshot = newStack.pop()!;
      setLocalSegments(snapshot);

      if (item.dbId) {
        snapshot.forEach((seg) => {
          reassignSegmentSpeaker(seg.id, seg.speaker, seg.speakerIndex).catch(
            console.error,
          );
        });
      }

      toast({ title: "Отменено", description: "Изменение спикера отменено" });
      return newStack;
    });
  }, [item.dbId]);

  const displaySegments = localSegments || item.segments;

  const playFragment = useCallback(
    (index: number, segment: TranscriptSegment) => {
      const audio = audioRef.current;
      if (!audio) return;

      fragmentReviewRef.current = {
        index,
        startTime: segment.startTime,
        endTime: segment.endTime,
      };
      setActiveSegmentIndex(index);
      setShowNextButton(false);
      updateFragmentReviewMode(true);
      updateContinuousPlay(false);

      audio.pause();
      audio.currentTime = segment.startTime;
      setCurrentTime(segment.startTime);
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    },
    [updateContinuousPlay, updateFragmentReviewMode],
  );

  const playNextFragment = useCallback(
    (targetIndex?: number, targetSegment?: TranscriptSegment) => {
      const segs = localSegments || item.segments;
      const nextIdx =
        targetIndex ??
        (activeSegmentIndex !== null ? activeSegmentIndex + 1 : -1);
      const nextSegment = targetSegment ?? segs?.[nextIdx];
      if (!segs || nextIdx < 0 || nextIdx >= segs.length || !nextSegment) {
        setActiveSegmentIndex(null);
        setShowNextButton(false);
        return;
      }
      playFragment(nextIdx, nextSegment);
    },
    [activeSegmentIndex, item.segments, localSegments, playFragment],
  );

  const continuePlayback = useCallback(() => {
    const segs = localSegments || item.segments;
    const audio = audioRef.current;
    if (!segs || !audio) return;

    const currentIndex = fragmentReviewRef.current?.index ?? activeSegmentIndex;
    const nextIndex =
      currentIndex !== null && currentIndex >= 0 ? currentIndex + 1 : 0;
    if (nextIndex >= segs.length) {
      setShowNextButton(false);
      setActiveSegmentIndex(null);
      return;
    }

    fragmentReviewRef.current = null;
    updateFragmentReviewMode(false);
    updateContinuousPlay(true);
    setActiveSegmentIndex(nextIndex);
    setShowNextButton(false);
    audio.currentTime = segs[nextIndex].startTime;
    setCurrentTime(segs[nextIndex].startTime);
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [
    activeSegmentIndex,
    item.segments,
    localSegments,
    updateContinuousPlay,
    updateFragmentReviewMode,
  ]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      const segs = localSegments || item.segments;
      if (activeSegmentIndex !== null && segs && segs[activeSegmentIndex]) {
        const seg = segs[activeSegmentIndex];
        const reviewSegment = fragmentReviewModeRef.current
          ? fragmentReviewRef.current
          : null;

        if (reviewSegment) {
          if (audio.currentTime < reviewSegment.startTime - 0.05) {
            audio.currentTime = reviewSegment.startTime;
            setCurrentTime(reviewSegment.startTime);
            return;
          }

          if (audio.currentTime >= reviewSegment.endTime - 0.02) {
            audio.pause();
            audio.currentTime = reviewSegment.endTime;
            setCurrentTime(reviewSegment.endTime);
            setIsPlaying(false);
            setShowNextButton(true);
          }
          return;
        }

        if (audio.currentTime >= seg.endTime) {
          if (
            !fragmentReviewModeRef.current &&
            continuousPlayRef.current &&
            activeSegmentIndex < segs.length - 1
          ) {
            const nextIdx = activeSegmentIndex + 1;
            setActiveSegmentIndex(nextIdx);
            setShowNextButton(false);
            audio.currentTime = segs[nextIdx].startTime;
          } else if (
            !fragmentReviewModeRef.current &&
            continuousPlayRef.current &&
            activeSegmentIndex >= segs.length - 1
          ) {
            audio.pause();
            setIsPlaying(false);
            setActiveSegmentIndex(null);
            setShowNextButton(false);
          } else {
            audio.pause();
            audio.currentTime = seg.endTime;
            setCurrentTime(seg.endTime);
            setIsPlaying(false);
            setShowNextButton(true);
          }
        }
      }
    };
    const onLoaded = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setShowNextButton(false);
      setActiveSegmentIndex(null);
    };
    const onError = () => {
      console.error("Audio load error:", audio.error);
      setIsPlaying(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    if (audio.readyState >= 1 && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [
    item.audioUrl,
    activeSegmentIndex,
    localSegments,
    item.segments,
    continuousPlay,
    fragmentReviewMode,
  ]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        console.log(
          "[FileQueueItem] Attempting play, src:",
          audioRef.current.src?.substring(0, 80),
          "readyState:",
          audioRef.current.readyState,
        );
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("[FileQueueItem] Play failed:", err);
        setIsPlaying(false);
      }
    }
  };

  const skip = (sec: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(
      0,
      Math.min(duration, audioRef.current.currentTime + sec),
    );
  };

  const togglePlayCb = useCallback(() => {
    togglePlay();
  }, [isPlaying, item.audioUrl]);
  const skipForwardCb = useCallback(() => skip(5), [duration]);
  const skipBackwardCb = useCallback(() => skip(-5), [duration]);

  useKeyboardShortcuts({
    onTogglePlay:
      item.status === "done" && item.audioUrl ? togglePlayCb : undefined,
    onSkipForward:
      item.status === "done" && item.audioUrl ? skipForwardCb : undefined,
    onSkipBackward:
      item.status === "done" && item.audioUrl ? skipBackwardCb : undefined,
  });

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    audioRef.current.currentTime = ratio * duration;
  };

  const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, item.audioUrl]);

  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMuted = !isMuted;
    audioRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) {
        setIsMuted(true);
        audioRef.current.muted = true;
      } else if (isMuted) {
        setIsMuted(false);
        audioRef.current.muted = false;
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      layout
      className={`rounded-xl bg-card border ${STATUS_BORDER[item.status]} overflow-hidden`}
    >
      <div className="flex items-center gap-3 p-4 pb-2">
        <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
          <FileAudio className="w-4 h-4 text-gold-dark" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate text-sm">
            {item.file.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatSize(item.file.size)}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              {STATUS_ICON[item.status]}
              {item.statusMessage}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(item.status === "processing" || item.status === "pending") && (
            <button
              type="button"
              onClick={item.status === "pending" ? onRemove : onCancel}
              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
              title={item.status === "pending" ? "Убрать из очереди" : "Остановить"}
            >
              <X className="w-4 h-4 text-destructive" />
            </button>
          )}
          {(item.status === "error" || item.status === "cancelled") && (
            <button
              onClick={onRetry}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Повторить"
            >
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {item.status !== "processing" && (
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Удалить"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {item.status === "done" && item.segments && (
            <>
              <ReplacementRulesManager onRuleAdded={handleRuleAdded} />
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                title={expanded ? "Свернуть" : "Показать расшифровку"}
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {item.status === "error" && item.error && (
        <div className="px-4 pb-2">
          <p className="text-xs text-destructive bg-destructive/5 rounded-lg p-2">
            {item.error}
          </p>
        </div>
      )}

      {item.status === "processing" && (
        <div className="px-4 pb-3">
          <JobProgressBar
            uploadProgress={item.uploadProgress}
            statusMessage={item.statusMessage}
            status={item.status}
            mediaDurationSec={item.mediaDurationSec}
            uploadCompletedAtMs={item.uploadCompletedAtMs}
          />
        </div>
      )}

      <div ref={playerRef} className="px-4 pb-3">
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="group relative w-full h-1.5 bg-muted rounded-full cursor-pointer mb-2"
        >
          <div
            className="absolute inset-y-0 left-0 bg-gold rounded-full transition-[width] duration-100"
            style={{
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono w-12">
            {formatTime(currentTime)}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => skip(-10)}
              className="p-1 rounded hover:bg-muted transition-colors"
              title="−10 сек"
            >
              <SkipBack className="w-3 h-3 text-muted-foreground" />
            </button>
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-full bg-navy hover:bg-navy-light transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-3 h-3 text-primary-foreground" />
              ) : (
                <Play className="w-3 h-3 text-primary-foreground ml-0.5" />
              )}
            </button>
            <button
              onClick={() => skip(10)}
              className="p-1 rounded hover:bg-muted transition-colors"
              title="+10 сек"
            >
              <SkipForward className="w-3 h-3 text-muted-foreground" />
            </button>
            <div
              className="relative flex items-center ml-1"
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => setShowVolume(false)}
            >
              <button
                onClick={toggleMute}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <Volume2 className="w-3 h-3 text-muted-foreground" />
                )}
              </button>
              {showVolume && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-card border border-border rounded-lg shadow-lg p-2 flex flex-col items-center z-50"
                  style={{ height: 100 }}
                >
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-1.5 appearance-none bg-muted rounded-full cursor-pointer accent-gold"
                    style={{
                      writingMode: "vertical-lr",
                      direction: "rtl",
                      height: "100%",
                    }}
                  />
                </div>
              )}
            </div>
            <button
              onClick={cycleSpeed}
              className="px-1.5 py-0.5 rounded hover:bg-muted transition-colors ml-1 text-[10px] font-mono text-muted-foreground font-semibold min-w-[2rem]"
              title="Скорость воспроизведения"
            >
              {playbackRate}x
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono w-12 text-right">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {replacementMatches.length > 0 && !expanded && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-gold-dark hover:text-gold transition-colors flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3" />
            Найдено {replacementMatches.length} предложений замены — нажмите для
            просмотра
          </button>
        </div>
      )}

      {expanded && displaySegments && (
        <div className="border-t border-border p-4">
          <div className="flex items-center justify-end gap-2 mb-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <span>Непрерывное воспроизведение</span>
              <button
                role="switch"
                aria-checked={continuousPlay}
                onClick={() => updateContinuousPlay(!continuousPlayRef.current)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${continuousPlay ? "bg-gold" : "bg-muted"}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${continuousPlay ? "translate-x-[18px]" : "translate-x-[3px]"}`}
                />
              </button>
            </label>
          </div>
          <TranscriptionView
            segments={displaySegments}
            fileName={item.file.name}
            speakerNames={item.speakerNames}
            onRenameSpeaker={onRenameSpeaker}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onSeekTo={(seconds) => {
              const segs = localSegments || item.segments;
              if (audioRef.current && segs) {
                const idx = segs.findIndex(
                  (s) => seconds >= s.startTime && seconds < s.endTime,
                );
                const segment = idx >= 0 ? segs[idx] : null;
                setActiveSegmentIndex(idx >= 0 ? idx : null);
                setShowNextButton(false);
                updateContinuousPlay(false);
                updateFragmentReviewMode(!!segment);
                fragmentReviewRef.current = segment
                  ? {
                      index: idx,
                      startTime: segment.startTime,
                      endTime: segment.endTime,
                    }
                  : null;
                audioRef.current.currentTime = seconds;
                setCurrentTime(seconds);
                audioRef.current
                  .play()
                  .then(() => setIsPlaying(true))
                  .catch(() => setIsPlaying(false));
              }
            }}
            activeSegmentIndex={activeSegmentIndex}
            showNextButton={showNextButton}
            onNextSegment={playNextFragment}
            onContinuePlayback={continuePlayback}
            onRepeatSegment={() => {
              const segs = localSegments || item.segments;
              if (
                segs &&
                activeSegmentIndex !== null &&
                segs[activeSegmentIndex]
              ) {
                playFragment(activeSegmentIndex, segs[activeSegmentIndex]);
              }
            }}
            replacementMatches={replacementMatches}
            onReplacementAccept={handleReplacementAccept}
            onReplacementDismiss={handleReplacementDismiss}
            onMergeSegments={handleMergeSegments}
            onSplitSegment={handleSplitSegment}
            onDeleteSegment={handleDeleteSegment}
            onDeleteSegments={handleDeleteSegments}
            onMergeSpeakers={handleMergeSpeakers}
            onReassignSegmentSpeaker={handleReassignSegmentSpeaker}
            onUndoSpeakerChange={handleUndoSpeakerChange}
            canUndoSpeakerChange={speakerUndoStack.length > 0}
            onEditStart={(index, segment) => {}}
            onTogglePlay={() => {
              const audio = audioRef.current;
              if (!audio) return;
              if (audio.paused) {
                audio
                  .play()
                  .then(() => setIsPlaying(true))
                  .catch(() => {});
              } else {
                audio.pause();
                setIsPlaying(false);
              }
            }}
          />
        </div>
      )}

      <AnimatePresence>
        {!playerVisible && isPlaying && expanded && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border shadow-lg px-4 py-2"
          >
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <p className="text-xs text-muted-foreground truncate flex-shrink min-w-0 max-w-[120px]">
                {item.file.name}
              </p>
              <div
                className="flex-1 h-1 bg-muted rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  if (!audioRef.current) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(
                    0,
                    Math.min(1, (e.clientX - rect.left) / rect.width),
                  );
                  audioRef.current.currentTime = ratio * duration;
                }}
              >
                <div
                  className="h-full bg-gold rounded-full"
                  style={{
                    width:
                      duration > 0
                        ? `${(currentTime / duration) * 100}%`
                        : "0%",
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-10">
                {formatTime(currentTime)}
              </span>
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-full bg-navy hover:bg-navy-light transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-3 h-3 text-primary-foreground" />
                ) : (
                  <Play className="w-3 h-3 text-primary-foreground ml-0.5" />
                )}
              </button>
              <button
                onClick={cycleSpeed}
                className="text-[10px] font-mono text-muted-foreground font-semibold px-1"
              >
                {playbackRate}x
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={audioRef} preload="metadata" className="hidden">
        <source src={item.audioUrl} type={getMimeType(item.file.name)} />
      </audio>
    </motion.div>
  );
};

export default FileQueueItem;
