import { useState, useRef, useEffect, useCallback } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { RotateCcw, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  FileText,
  Clock,
  Pencil,
  Check,
  FileDown,
  Search,
  LocateFixed,
  SkipForward,
  Merge,
  Scissors,
  Undo2,
  Redo2,
  Trash2,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { updateSegmentText } from "@/lib/transcriptionStorage";
import ExportDialog from "./ExportDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TranscriptionSearch from "./TranscriptionSearch";
import AISummaryPanel, { type AISummaryData } from "./AISummaryPanel";
import { InlineReplacementText } from "./InlineReplacement";
import type { TranscriptSegment } from "@/lib/transcript";
import type { ReplacementMatch } from "@/components/ReplacementConfirm";

interface TranscriptionViewProps {
  segments: TranscriptSegment[];
  fileName?: string;
  speakerNames?: Record<string, string>;
  onRenameSpeaker?: (originalName: string, newName: string) => void;
  onSeekTo?: (seconds: number) => void;
  currentTime?: number;
  onSegmentEdit?: (segmentId: string, newText: string) => void | Promise<void>;
  replacementMatches?: ReplacementMatch[];
  onReplacementAccept?: (match: ReplacementMatch) => void;
  onReplacementDismiss?: (match: ReplacementMatch) => void;
  isPlaying?: boolean;
  activeSegmentIndex?: number | null;
  showNextButton?: boolean;
  onNextSegment?: (index?: number, segment?: TranscriptSegment) => void;
  onContinuePlayback?: () => void;
  onRepeatSegment?: () => void;
  onMergeSegments?: (index: number) => void;
  onSplitSegment?: (index: number, splitPos: number) => void;
  onDeleteSegment?: (index: number) => void;
  onDeleteSegments?: (indices: number[]) => void;
  totalSegments?: number;
  onMergeSpeakers?: (fromSpeaker: string, toSpeaker: string) => void;
  onReassignSegmentSpeaker?: (
    segmentId: string,
    newSpeaker: string,
    newSpeakerIndex: number,
  ) => void;
  onUndoSpeakerChange?: () => void;
  onRedo?: () => void;
  onEditStart?: (index: number, segment: TranscriptSegment) => void;
  onTogglePlay?: () => void;
  onEditNextSegment?: () => void;
  canUndoSpeakerChange?: boolean;
  canRedo?: boolean;
  transcriptionId?: string;
}

const SPEAKER_COLORS = [
  "bg-speaker-1/10 text-speaker-1 border-speaker-1/30",
  "bg-speaker-2/10 text-speaker-2 border-speaker-2/30",
  "bg-speaker-3/10 text-speaker-3 border-speaker-3/30",
  "bg-speaker-4/10 text-speaker-4 border-speaker-4/30",
  "bg-speaker-5/10 text-speaker-5 border-speaker-5/30",
];

const SPEAKER_DOT = [
  "bg-speaker-1",
  "bg-speaker-2",
  "bg-speaker-3",
  "bg-speaker-4",
  "bg-speaker-5",
];

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

function highlightText(text: string, ranges: number[][] | undefined) {
  if (!ranges || ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const [start, end] of ranges) {
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <mark key={start} className="bg-gold/30 text-foreground rounded px-0.5">
        {text.slice(start, end)}
      </mark>,
    );
    last = end;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

const SegmentItem = ({
  segment,
  index,
  isActive,
  isScrollTarget,
  onSeekTo,
  getSpeakerDisplay,
  highlights,
  onEdit,
  onRenameSpeaker,
  segmentReplacements,
  onReplacementAccept,
  onReplacementDismiss,
  userScrollingRef,
  activeSegmentRef,
  currentTime,
  onMerge,
  onMergePrev,
  onSplit,
  onDelete,
  isLast,
  isFirst,
  allSpeakers,
  onReassignSpeaker,
  onEditStart,
  onTogglePlay,
  onNextSegment,
  onContinuePlayback,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  selectionMode,
  isSelected,
  onToggleSelected,
  autoScrollLocked,
  onEditingChange,
  forceEditToken,
}: {
  segment: TranscriptSegment;
  index: number;
  isActive: boolean;
  isScrollTarget: boolean;
  onSeekTo?: (seconds: number) => void;
  getSpeakerDisplay: (s: string) => string;
  highlights?: number[][];
  onEdit?: (segmentId: string, newText: string) => void;
  onRenameSpeaker?: (originalName: string, newName: string) => void;
  segmentReplacements?: ReplacementMatch[];
  onReplacementAccept?: (match: ReplacementMatch) => void;
  onReplacementDismiss?: (match: ReplacementMatch) => void;
  userScrollingRef?: React.MutableRefObject<boolean>;
  activeSegmentRef?: React.MutableRefObject<HTMLDivElement | null>;
  currentTime?: number;
  onMerge?: () => void;
  onMergePrev?: () => void;
  onSplit?: (splitPos: number) => void;
  onDelete?: () => void;
  isLast?: boolean;
  isFirst?: boolean;
  allSpeakers?: { speaker: string; speakerIndex: number }[];
  onReassignSpeaker?: (
    segmentId: string,
    newSpeaker: string,
    newSpeakerIndex: number,
  ) => void;
  onEditStart?: (index: number, segment: TranscriptSegment) => void;
  onTogglePlay?: () => void;
  onNextSegment?: (index?: number, segment?: TranscriptSegment) => void;
  onContinuePlayback?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelected?: () => void;
  autoScrollLocked?: boolean;
  onEditingChange?: (index: number, editing: boolean) => void;
  forceEditToken?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [renamingInline, setRenamingInline] = useState(false);
  const [showSpeakerMenu, setShowSpeakerMenu] = useState(false);
  const [inlineName, setInlineName] = useState("");
  const [showMergeMenu, setShowMergeMenu] = useState(false);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const speakerMenuRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!showSpeakerMenu) return;
    const onDown = (e: MouseEvent) => {
      if (
        speakerMenuRef.current &&
        !speakerMenuRef.current.contains(e.target as Node)
      ) {
        setShowSpeakerMenu(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSpeakerMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showSpeakerMenu]);

  useEffect(() => {
    if (isActive && ref.current && activeSegmentRef) {
      activeSegmentRef.current = ref.current;
    }
  }, [isActive, activeSegmentRef]);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(segment.text);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [wasEdited, setWasEdited] = useState(segment.isEdited ?? false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const selectedTextRangeRef = useRef<{ start: number; end: number } | null>(
    null,
  );
  const editUndoStackRef = useRef<string[]>([]);
  const editRedoStackRef = useRef<string[]>([]);
  const lastForceEditTokenRef = useRef(0);
  const navigationLockRef = useRef(false);
  const [editHistoryVersion, setEditHistoryVersion] = useState(0);
  const [pendingNavigation, setPendingNavigation] = useState<
    "continue" | "next" | null
  >(null);

  const resizeTextarea = useCallback((preserveViewport = false) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const topBefore = preserveViewport
      ? ref.current?.getBoundingClientRect().top
      : undefined;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    if (topBefore === undefined) return;
    requestAnimationFrame(() => {
      const topAfter = ref.current?.getBoundingClientRect().top;
      if (topAfter !== undefined)
        window.scrollBy({ top: topAfter - topBefore, behavior: "instant" });
    });
  }, []);

  const rememberSelectedTextRange = useCallback(() => {
    const selection = window.getSelection();
    const textNode = textRef.current;

    if (
      !selection ||
      selection.rangeCount === 0 ||
      selection.isCollapsed ||
      !textNode
    ) {
      selectedTextRangeRef.current = null;
      return;
    }

    const range = selection.getRangeAt(0);
    if (!textNode.contains(range.commonAncestorContainer)) {
      selectedTextRangeRef.current = null;
      return;
    }

    const beforeSelection = range.cloneRange();
    beforeSelection.selectNodeContents(textNode);
    beforeSelection.setEnd(range.startContainer, range.startOffset);

    const start = beforeSelection.toString().length;
    const end = start + range.toString().length;
    selectedTextRangeRef.current = start < end ? { start, end } : null;
  }, []);

  useEffect(() => {
    if (editing || autoScrollLocked) return;
    if (
      (isActive || isScrollTarget) &&
      ref.current &&
      !userScrollingRef?.current
    ) {
      ref.current.scrollIntoView({ behavior: "auto", block: "center" });
    }
  }, [isActive, isScrollTarget, editing, autoScrollLocked]);

  useEffect(() => {
    onEditingChange?.(index, editing);
    return () => {
      if (editing) onEditingChange?.(index, false);
    };
  }, [editing, index, onEditingChange]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      resizeTextarea(true);
      const selectedRange = selectedTextRangeRef.current;
      if (selectedRange) {
        textareaRef.current.setSelectionRange(
          selectedRange.start,
          selectedRange.end,
        );
      }
    }
  }, [editing, resizeTextarea]);

  useEffect(() => {
    if (saveState === "saved") {
      setWasEdited(true);
      const t = setTimeout(() => setSaveState("idle"), 2000);
      return () => clearTimeout(t);
    }
  }, [saveState]);

  const commitEdit = async (
    options: { keepEditing?: boolean; showSavedIfUnchanged?: boolean } = {},
  ) => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== segment.text && segment.id && onEdit) {
      if (!options.keepEditing) setEditing(false);
      setSaveState("saving");
      try {
        await onEdit(segment.id, trimmed);
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    } else {
      if (options.showSavedIfUnchanged) setSaveState("saved");
      if (!options.keepEditing) setEditing(false);
    }
  };

  const saveThenNavigate = async (
    type: "continue" | "next",
    navigate: () => void,
  ) => {
    if (navigationLockRef.current || pendingNavigation) return;
    navigationLockRef.current = true;
    setPendingNavigation(type);
    try {
      await commitEdit({ keepEditing: true, showSavedIfUnchanged: true });
      await new Promise((resolve) => setTimeout(resolve, 550));
      setEditing(false);
      navigate();
    } finally {
      navigationLockRef.current = false;
      setPendingNavigation(null);
    }
  };

  const startEditing = () => {
    rememberSelectedTextRange();
    editUndoStackRef.current = [];
    editRedoStackRef.current = [];
    setEditHistoryVersion((version) => version + 1);
    setEditText(segment.text);
    setEditing(true);
    onEditStart?.(index, segment);
  };

  useEffect(() => {
    if (!forceEditToken || forceEditToken === lastForceEditTokenRef.current)
      return;
    lastForceEditTokenRef.current = forceEditToken;
    if (!editing) startEditing();
  }, [forceEditToken]);

  const updateEditText = (nextText: string) => {
    if (nextText === editText) return;
    editUndoStackRef.current.push(editText);
    editRedoStackRef.current = [];
    setEditHistoryVersion((version) => version + 1);
    setEditText(nextText);
  };

  const undoEditText = () => {
    const previousText = editUndoStackRef.current.pop();
    if (previousText === undefined) return;
    editRedoStackRef.current.push(editText);
    setEditHistoryVersion((version) => version + 1);
    setEditText(previousText);
  };

  const redoEditText = () => {
    const nextText = editRedoStackRef.current.pop();
    if (nextText === undefined) return;
    editUndoStackRef.current.push(editText);
    setEditHistoryVersion((version) => version + 1);
    setEditText(nextText);
  };

  const canUndoEdit =
    editHistoryVersion >= 0 && editUndoStackRef.current.length > 0;
  const canRedoEdit =
    editHistoryVersion >= 0 && editRedoStackRef.current.length > 0;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.3 }}
      onClick={() => {
        if (editing) return;
        if (selectionMode) onToggleSelected?.();
        else onSeekTo?.(segment.startTime);
      }}
      className={`group p-4 rounded-xl border transition-all ${
        isSelected
          ? "bg-gold/10 border-gold/60 shadow-sm shadow-gold/10"
          : isActive
            ? "bg-gold/5 border-gold/40 shadow-sm shadow-gold/10"
            : "bg-card border-border hover:border-gold/30"
      } ${(onSeekTo || selectionMode) && !editing ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-3 mb-2">
        {selectionMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelected?.();
            }}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={isSelected ? "Снять выделение" : "Выделить фрагмент"}
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-gold" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
        )}
        {renamingInline ? (
          (() => {
            const applyLocalRename = (newName: string) => {
              const trimmed = newName.trim();
              if (!trimmed || !onReassignSpeaker) return;
              const existing = allSpeakers?.find(
                (s) => getSpeakerDisplay(s.speaker) === trimmed,
              );
              if (existing) {
                onReassignSpeaker(
                  segment.id,
                  existing.speaker,
                  existing.speakerIndex,
                );
                return;
              }
              const maxIdx =
                allSpeakers?.reduce(
                  (m, s) => Math.max(m, s.speakerIndex),
                  -1,
                ) ?? -1;
              onReassignSpeaker(segment.id, trimmed, maxIdx + 1);
            };
            return (
              <div
                className={`relative inline-flex flex-col items-start`}
                onClick={(e) => e.stopPropagation()}
              >
                <span
                  className={`inline-flex items-center gap-1.5 px-1 py-0.5 rounded-md text-xs font-semibold border ${SPEAKER_COLORS[segment.speakerIndex % 5]}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${SPEAKER_DOT[segment.speakerIndex % 5]}`}
                  />
                  <input
                    ref={inlineInputRef}
                    value={inlineName}
                    onChange={(e) => setInlineName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        applyLocalRename(inlineName);
                        setRenamingInline(false);
                      }
                      if (e.key === "Escape") setRenamingInline(false);
                    }}
                    onBlur={(e) => {
                      if (e.relatedTarget?.closest("[data-preset-role]"))
                        return;
                      applyLocalRename(inlineName);
                      setRenamingInline(false);
                    }}
                    className="bg-transparent outline-none border-b border-current w-24 text-xs font-semibold"
                    autoFocus
                  />
                </span>
                <div
                  className="absolute top-full left-0 mt-1 z-50 flex flex-col gap-1.5 p-2 rounded-lg border border-border shadow-xl min-w-[240px] max-h-[280px] overflow-y-auto bg-popover text-popover-foreground backdrop-blur-none"
                  style={{ backgroundColor: "hsl(var(--popover))" }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <p className="text-[10px] text-muted-foreground">
                    Стандартные роли:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {[
                      "Судья",
                      "Истец",
                      "Ответчик",
                      "Адвокат",
                      "Свидетель",
                      "Прокурор",
                      "Секретарь",
                    ].map((role) => (
                      <button
                        key={role}
                        data-preset-role
                        tabIndex={-1}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyLocalRename(role);
                          setRenamingInline(false);
                        }}
                        className="px-2 py-1 rounded-md text-xs border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const standardRoles = [
                      "Судья",
                      "Истец",
                      "Ответчик",
                      "Адвокат",
                      "Свидетель",
                      "Прокурор",
                      "Секретарь",
                    ];
                    const renamedInSession = allSpeakers
                      ? allSpeakers
                          .map((s) => getSpeakerDisplay(s.speaker))
                          .filter(
                            (name) =>
                              !name.startsWith("Спикер") &&
                              !standardRoles.includes(name) &&
                              name !== getSpeakerDisplay(segment.speaker),
                          )
                      : [];
                    const unique = Array.from(new Set(renamedInSession));
                    if (unique.length === 0) return null;
                    return (
                      <>
                        <div className="border-t border-border my-0.5" />
                        <p className="text-[10px] text-muted-foreground">
                          В этой расшифровке:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {unique.map((name) => (
                            <button
                              key={name}
                              data-preset-role
                              tabIndex={-1}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                applyLocalRename(name);
                                setRenamingInline(false);
                              }}
                              className="px-2 py-1 rounded-md text-xs border border-accent/50 bg-accent/10 hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                  <div className="border-t border-border my-0.5" />
                  <div className="flex gap-1">
                    {getSpeakerDisplay(segment.speaker) !==
                      `Спикер ${segment.speakerIndex + 1}` && (
                      <button
                        data-preset-role
                        tabIndex={-1}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyLocalRename(
                            `Спикер ${segment.speakerIndex + 1}`,
                          );
                          setRenamingInline(false);
                        }}
                        className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors text-left"
                      >
                        ↩ Сбросить
                      </button>
                    )}
                    <button
                      data-preset-role
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setRenamingInline(false);
                      }}
                      className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
                    >
                      ✕ Отмена
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <span
            ref={speakerMenuRef}
            className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer transition-opacity ${showSpeakerMenu ? "" : "hover:opacity-80"} ${SPEAKER_COLORS[segment.speakerIndex % 5]}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onReassignSpeaker && allSpeakers && allSpeakers.length > 1) {
                setShowSpeakerMenu((prev) => !prev);
              } else {
                setInlineName(getSpeakerDisplay(segment.speaker));
                setRenamingInline(true);
              }
            }}
            title="Нажмите для переименования или переназначения"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${SPEAKER_DOT[segment.speakerIndex % 5]}`}
            />
            {getSpeakerDisplay(segment.speaker)}
            <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50" />
            {showSpeakerMenu && allSpeakers && onReassignSpeaker && (
              <div
                className="absolute top-full left-0 mt-1 z-50 border border-border rounded-lg shadow-xl p-1 min-w-[160px] max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto backdrop-blur-none"
                style={{
                  backgroundColor: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  right: "auto",
                  transform:
                    "translateX(min(0px, calc(100vw - 100% - var(--chip-left, 0px) - 1rem)))",
                }}
                ref={(el) => {
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  const overflow = rect.right - (window.innerWidth - 8);
                  if (overflow > 0) {
                    el.style.transform = `translateX(${-overflow}px)`;
                  } else {
                    el.style.transform = "";
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setShowSpeakerMenu(false);
                    setInlineName(getSpeakerDisplay(segment.speaker));
                    setRenamingInline(true);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left"
                >
                  <Pencil className="w-3 h-3" />
                  Переименовать
                </button>
                <div className="border-t border-border my-1" />
                <p className="text-[10px] text-muted-foreground px-2 py-0.5">
                  Назначить спикера:
                </p>
                {allSpeakers
                  .filter((s) => s.speaker !== segment.speaker)
                  .map((target) => (
                    <button
                      key={target.speaker}
                      onClick={() => {
                        onReassignSpeaker(
                          segment.id,
                          target.speaker,
                          target.speakerIndex,
                        );
                        setShowSpeakerMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${SPEAKER_DOT[target.speakerIndex % 5]}`}
                      />
                      {getSpeakerDisplay(target.speaker)}
                    </button>
                  ))}
              </div>
            )}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {formatTime(segment.startTime)} – {formatTime(segment.endTime)}
        </span>
        {saveState === "saving" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </span>
        )}
        {saveState === "saved" && (
          <span className="flex items-center gap-1 text-xs text-green-500 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
          </span>
        )}
        {wasEdited && saveState === "idle" && !editing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center text-green-500">
                <Check className="w-3.5 h-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Отредактировано
            </TooltipContent>
          </Tooltip>
        )}
        {onEdit && !editing && saveState === "idle" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing();
                }}
                className={`p-1 rounded transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100"}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Редактировать
            </TooltipContent>
          </Tooltip>
        )}
        {(onMerge || onMergePrev) && !editing && (
          <div
            className={`relative transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMergeMenu((prev) => !prev);
                  }}
                  className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <Merge className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Объединить фрагмент
              </TooltipContent>
            </Tooltip>
            {showMergeMenu && (
              <div
                className="absolute top-full right-0 mt-1 z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl p-1 min-w-[220px]"
                onMouseDown={(e) => e.preventDefault()}
              >
                {onMergePrev && !isFirst && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMergePrev();
                      setShowMergeMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-accent transition-colors text-left"
                  >
                    <Merge className="w-3.5 h-3.5 rotate-180" />
                    Объединить с предыдущим
                  </button>
                )}
                {onMerge && !isLast && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMerge();
                      setShowMergeMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs hover:bg-accent transition-colors text-left"
                  >
                    <Merge className="w-3.5 h-3.5" />
                    Объединить со следующим
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMergeMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
                >
                  ✕ Отмена
                </button>
              </div>
            )}
          </div>
        )}
        {onSplit && !editing && segment.text.length > 20 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const mid = Math.floor(segment.text.length / 2);
                  const spaceAfter = segment.text.indexOf(" ", mid);
                  const spaceBefore = segment.text.lastIndexOf(" ", mid);
                  const splitAt =
                    spaceAfter >= 0
                      ? spaceAfter
                      : spaceBefore >= 0
                        ? spaceBefore
                        : mid;
                  onSplit(splitAt);
                }}
                className={`p-1 rounded transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100"}`}
              >
                <Scissors className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Разделить фрагмент
            </TooltipContent>
          </Tooltip>
        )}
        {onUndo && !editing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUndo();
                }}
                disabled={!canUndo}
                className={`p-1 rounded transition-opacity disabled:opacity-30 disabled:pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100"}`}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Отменить (Ctrl+Z)
            </TooltipContent>
          </Tooltip>
        )}
        {onRedo && !editing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRedo();
                }}
                disabled={!canRedo}
                className={`p-1 rounded transition-opacity disabled:opacity-30 disabled:pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100"}`}
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Вернуть (Ctrl+Y)
            </TooltipContent>
          </Tooltip>
        )}
        {onDelete && !editing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Удалить этот фрагмент?")) onDelete();
                }}
                className={`ml-auto p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-70 hover:!opacity-100"}`}
                aria-label="Удалить фрагмент"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Удалить фрагмент
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {editing ? (
        <div className="pl-1" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={undoEditText}
                  disabled={!canUndoEdit}
                  className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Отменить изменение текста"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Отменить правку
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={redoEditText}
                  disabled={!canRedoEdit}
                  className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Вернуть изменение текста"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Вернуть правку
              </TooltipContent>
            </Tooltip>
            {onContinuePlayback && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      saveThenNavigate("continue", onContinuePlayback);
                    }}
                    disabled={pendingNavigation !== null}
                    className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded bg-navy text-primary-foreground hover:bg-navy-light transition-colors text-xs font-medium"
                    aria-label="Продолжить непрерывное прослушивание"
                  >
                    {pendingNavigation === "continue" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <SkipForward className="w-3.5 h-3.5" />
                    )}
                    {pendingNavigation === "continue" ? "Сохранение" : "Далее"}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Продолжить прослушивание
                </TooltipContent>
              </Tooltip>
            )}
            {onNextSegment && !isLast && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      saveThenNavigate("next", onNextSegment);
                    }}
                    disabled={pendingNavigation !== null}
                    className={`${onContinuePlayback ? "" : "ml-auto"} inline-flex items-center gap-1.5 px-2 py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-xs font-medium`}
                    aria-label="Перейти к следующему фрагменту"
                  >
                    {pendingNavigation === "next" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <SkipForward className="w-3.5 h-3.5" />
                    )}
                    {pendingNavigation === "next" ? "Сохранение" : "Следующий"}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Следующий фрагмент
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => {
              const ta = e.target;
              const prevHeight = ta.style.height;
              ta.style.height = "auto";
              const newHeight = `${ta.scrollHeight}px`;
              if (newHeight !== prevHeight) {
                const topBefore = ref.current?.getBoundingClientRect().top;
                ta.style.height = newHeight;
                if (topBefore !== undefined) {
                  requestAnimationFrame(() => {
                    const topAfter = ref.current?.getBoundingClientRect().top;
                    const delta =
                      topAfter !== undefined ? topAfter - topBefore : 0;
                    if (Math.abs(delta) > 0.5)
                      window.scrollBy({ top: delta, behavior: "instant" });
                  });
                }
              } else {
                ta.style.height = prevHeight;
              }
              updateEditText(ta.value);
            }}
            onInput={(e) => {
              const inputType = (e.nativeEvent as InputEvent).inputType;
              if (inputType === "insertReplacementText") {
                const ta = textareaRef.current;
                if (ta) {
                  const pos = ta.selectionEnd;
                  requestAnimationFrame(() => {
                    ta.focus();
                    try {
                      ta.setSelectionRange(pos, pos);
                    } catch {
                      /* noop */
                    }
                  });
                }
              }
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) redoEditText();
                else undoEditText();
              }
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
                e.preventDefault();
                redoEditText();
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === "Escape") {
                setEditing(false);
                setEditText(segment.text);
              }
              if (e.code === "Space" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onTogglePlay?.();
              }
            }}
            onBlur={() => {
              const ta = textareaRef.current;
              setTimeout(() => {
                if (document.activeElement === ta) return;
                commitEdit();
              }, 50);
            }}
            className="w-full bg-background border border-border rounded-lg p-2 text-foreground leading-relaxed text-sm resize-none outline-none focus:ring-2 focus:ring-gold/50"
          />
        </div>
      ) : (
        <p
          ref={textRef}
          className="text-foreground leading-relaxed pl-1 text-justify indent-8"
        >
          {segmentReplacements &&
          segmentReplacements.length > 0 &&
          onReplacementAccept &&
          onReplacementDismiss ? (
            <InlineReplacementText
              text={segment.text}
              matches={segmentReplacements}
              onAccept={onReplacementAccept}
              onDismiss={onReplacementDismiss}
            />
          ) : (
            highlightText(segment.text, highlights)
          )}
        </p>
      )}
      {isActive && currentTime !== undefined && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="mt-3 h-3 bg-muted rounded-full overflow-hidden cursor-pointer group/bar relative"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(
              0,
              Math.min(1, (e.clientX - rect.left) / rect.width),
            );
            const seekTime =
              segment.startTime + ratio * (segment.endTime - segment.startTime);
            onSeekTo?.(seekTime);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const bar = e.currentTarget;
            bar.setPointerCapture(e.pointerId);

            const seek = (clientX: number) => {
              const rect = bar.getBoundingClientRect();
              const ratio = Math.max(
                0,
                Math.min(1, (clientX - rect.left) / rect.width),
              );
              const seekTime =
                segment.startTime +
                ratio * (segment.endTime - segment.startTime);
              onSeekTo?.(seekTime);
            };

            seek(e.clientX);

            const onMove = (ev: PointerEvent) => seek(ev.clientX);
            const onUp = (ev: PointerEvent) => {
              bar.releasePointerCapture(ev.pointerId);
              bar.removeEventListener("pointermove", onMove);
              bar.removeEventListener("pointerup", onUp);
            };
            bar.addEventListener("pointermove", onMove);
            bar.addEventListener("pointerup", onUp);
          }}
        >
          <div
            className="h-full bg-gold rounded-full pointer-events-none"
            style={{
              width: `${Math.min(100, Math.max(0, ((currentTime - segment.startTime) / (segment.endTime - segment.startTime)) * 100))}%`,
            }}
          />
        </div>
      )}
    </motion.div>
  );
};

const TranscriptionView = ({
  segments,
  speakerNames = {},
  onRenameSpeaker,
  onSeekTo,
  currentTime,
  isPlaying,
  onSegmentEdit,
  replacementMatches = [],
  onReplacementAccept,
  onReplacementDismiss,
  activeSegmentIndex,
  showNextButton,
  onNextSegment,
  onRepeatSegment,
  onMergeSegments,
  onSplitSegment,
  onDeleteSegment,
  onDeleteSegments,
  onMergeSpeakers,
  onReassignSegmentSpeaker,
  onUndoSpeakerChange,
  onRedo,
  canUndoSpeakerChange,
  canRedo,
  onEditStart,
  onTogglePlay,
  onContinuePlayback,
  transcriptionId,
}: TranscriptionViewProps) => {
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [searchHighlights, setSearchHighlights] = useState<
    Map<number, number[][]>
  >(new Map());
  const [scrollToSegment, setScrollToSegment] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummaryData | null>(null);
  const [mergingFrom, setMergingFrom] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<string>>(
    new Set(),
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(
    null,
  );
  const [forcedEdit, setForcedEdit] = useState<{
    index: number;
    token: number;
  } | null>(null);
  const userScrollingRef = useRef(false);
  const [showBackToSegment, setShowBackToSegment] = useState(false);
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);

  const handleEditingChange = useCallback((index: number, editing: boolean) => {
    setEditingSegmentIndex((current) => {
      if (editing) return index;
      return current === index ? null : current;
    });
  }, []);

  const handleNextEditSegment = useCallback(
    (targetIndex?: number, targetSegment?: TranscriptSegment) => {
      const nextIndex =
        targetIndex ??
        (editingSegmentIndex !== null ? editingSegmentIndex + 1 : -1);
      const nextSegment = targetSegment ?? segments[nextIndex];
      if (nextIndex < 0 || nextIndex >= segments.length || !nextSegment) return;
      onNextSegment?.(nextIndex, nextSegment);
      setForcedEdit({ index: nextIndex, token: Date.now() });
    },
    [editingSegmentIndex, onNextSegment, segments],
  );

  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const onManualScroll = () => {
      userScrollingRef.current = true;
      setShowBackToSegment(true);
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        userScrollingRef.current = false;
        setShowBackToSegment(false);
      }, 5000);
    };

    window.addEventListener("wheel", onManualScroll, { passive: true });
    window.addEventListener("touchmove", onManualScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", onManualScroll);
      window.removeEventListener("touchmove", onManualScroll);
      if (resumeTimer) clearTimeout(resumeTimer);
    };
  }, []);

  const handleSeekTo = useCallback(
    (seconds: number) => {
      userScrollingRef.current = false;
      setShowBackToSegment(false);
      onSeekTo?.(seconds);
    },
    [onSeekTo],
  );

  const scrollToActive = useCallback(() => {
    userScrollingRef.current = false;
    setShowBackToSegment(false);
    activeSegmentRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, []);

  const getSpeakerDisplay = (original: string) =>
    speakerNames[original] || original;

  const renamedSegments = segments.map((s) => ({
    ...s,
    speaker: getSpeakerDisplay(s.speaker),
  }));

  const handleEdit = useCallback(
    async (segmentId: string, newText: string) => {
      const ok = await updateSegmentText(segmentId, newText);
      if (ok) {
        onSegmentEdit?.(segmentId, newText);
        toast({ title: "Сохранено", description: "Текст обновлён" });
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить изменения",
          variant: "destructive",
        });
      }
    },
    [onSegmentEdit],
  );

  const copyAll = () => {
    const text = renamedSegments
      .map((s) => `[${formatTime(s.startTime)}] ${s.speaker}:\n${s.text}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast({
      title: "Скопировано",
      description: "Текст скопирован в буфер обмена",
    });
  };

  const toggleSegmentSelection = useCallback((segmentId: string) => {
    setSelectedSegmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) next.delete(segmentId);
      else next.add(segmentId);
      return next;
    });
  }, []);

  const selectedSegments = segments.filter((segment) =>
    selectedSegmentIds.has(segment.id),
  );

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedSegmentIds(new Set());
  };

  const copySelectedSegments = () => {
    if (selectedSegments.length === 0) return;
    const text = selectedSegments
      .map(
        (s) =>
          `[${formatTime(s.startTime)}] ${getSpeakerDisplay(s.speaker)}:\n${s.text}`,
      )
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast({
      title: "Скопировано",
      description: `Скопировано фрагментов: ${selectedSegments.length}`,
    });
  };

  const deleteSelectedSegments = () => {
    if (selectedSegmentIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSelectedSegments = () => {
    const selectedIndices = segments
      .map((segment, index) =>
        selectedSegmentIds.has(segment.id) ? index : -1,
      )
      .filter((index) => index >= 0);
    if (selectedIndices.length === 0) {
      setShowDeleteConfirm(false);
      return;
    }
    onDeleteSegments?.(selectedIndices);
    setShowDeleteConfirm(false);
    exitSelectionMode();
  };

  useEffect(() => {
    setSelectedSegmentIds(
      (prev) =>
        new Set(
          segments
            .filter((segment) => prev.has(segment.id))
            .map((segment) => segment.id),
        ),
    );
  }, [segments]);

  const uniqueSpeakers = [...new Set(segments.map((s) => s.speaker))];
  const allSpeakersInfo = uniqueSpeakers.map((sp) => {
    const seg = segments.find((s) => s.speaker === sp);
    return { speaker: sp, speakerIndex: seg ? seg.speakerIndex : 0 };
  });

  const startEdit = (originalName: string) => {
    setEditingSpeaker(originalName);
    setEditValue(getSpeakerDisplay(originalName));
  };

  const commitEdit = () => {
    if (editingSpeaker && editValue.trim() && onRenameSpeaker) {
      onRenameSpeaker(editingSpeaker, editValue.trim());
    }
    setEditingSpeaker(null);
  };

  return (
    <div className="w-full">
      <TranscriptionSearch
        segments={segments}
        onHighlight={setSearchHighlights}
        onActiveMatch={setScrollToSegment}
        externalOpen={searchOpen}
        onOpenChange={setSearchOpen}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-semibold text-foreground">
            Расшифровка
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {segments.length} фрагментов · {uniqueSpeakers.length} участников
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onUndoSpeakerChange && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onUndoSpeakerChange}
                  disabled={!canUndoSpeakerChange}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors text-sm font-medium disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Undo2 className="w-4 h-4" />{" "}
                  <span className="hidden sm:inline">Отменить</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Отменить последнее изменение (Ctrl+Z)
              </TooltipContent>
            </Tooltip>
          )}
          {onRedo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors text-sm font-medium disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Redo2 className="w-4 h-4" />{" "}
                  <span className="hidden sm:inline">Вернуть</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Вернуть отменённое изменение (Ctrl+Y)
              </TooltipContent>
            </Tooltip>
          )}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors text-sm font-medium"
            title="Поиск по тексту (Ctrl+F)"
          >
            <Search className="w-4 h-4" />{" "}
            <span className="hidden sm:inline">Поиск</span>
          </button>
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors text-sm font-medium"
          >
            <Copy className="w-4 h-4" />{" "}
            <span className="hidden sm:inline">Копировать</span>
          </button>
          {onDeleteSegments && (
            <button
              onClick={() => setSelectionMode(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors text-sm font-medium"
            >
              <CheckSquare className="w-4 h-4" />{" "}
              <span className="hidden sm:inline">Выбрать</span>
            </button>
          )}
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-navy text-primary-foreground hover:bg-navy-light transition-colors text-sm font-medium"
          >
            <FileDown className="w-4 h-4" />{" "}
            <span className="hidden sm:inline">Экспорт</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {uniqueSpeakers.map((speaker) => {
          const seg = segments.find((s) => s.speaker === speaker);
          const idx = seg ? seg.speakerIndex % 5 : 0;
          const isEditing = editingSpeaker === speaker;
          const isMerging = mergingFrom === speaker;

          return (
            <span
              key={speaker}
              className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${SPEAKER_COLORS[idx]}`}
            >
              <span className={`w-2 h-2 rounded-full ${SPEAKER_DOT[idx]}`} />
              {isEditing ? (
                <span className="relative inline-flex items-center">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingSpeaker(null);
                    }}
                    onBlur={(e) => {
                      const next = e.relatedTarget as HTMLElement | null;
                      if (next && next.closest("[data-speaker-suggestions]"))
                        return;
                      commitEdit();
                    }}
                    className="bg-transparent border-b border-current outline-none w-24 text-xs"
                  />
                  <div
                    data-speaker-suggestions
                    className="absolute top-full left-0 mt-1 z-50 flex flex-col gap-1.5 p-2 rounded-lg border border-border shadow-xl min-w-[240px] max-h-[280px] overflow-y-auto bg-popover text-popover-foreground"
                    style={{ backgroundColor: "hsl(var(--popover))" }}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <p className="text-[10px] text-muted-foreground">
                      Стандартные роли:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {[
                        "Судья",
                        "Истец",
                        "Ответчик",
                        "Адвокат",
                        "Свидетель",
                        "Прокурор",
                        "Секретарь",
                      ].map((role) => (
                        <button
                          key={role}
                          tabIndex={-1}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (onRenameSpeaker && editingSpeaker) {
                              onRenameSpeaker(editingSpeaker, role);
                            }
                            setEditingSpeaker(null);
                          }}
                          className="px-2 py-1 rounded-md text-xs border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                    {(() => {
                      const standardRoles = [
                        "Судья",
                        "Истец",
                        "Ответчик",
                        "Адвокат",
                        "Свидетель",
                        "Прокурор",
                        "Секретарь",
                      ];
                      const used = uniqueSpeakers
                        .map((sp) => getSpeakerDisplay(sp))
                        .filter(
                          (name) =>
                            !name.startsWith("Спикер") &&
                            !standardRoles.includes(name) &&
                            name !== getSpeakerDisplay(speaker),
                        );
                      const unique = Array.from(new Set(used));
                      if (unique.length === 0) return null;
                      return (
                        <>
                          <div className="border-t border-border my-0.5" />
                          <p className="text-[10px] text-muted-foreground">
                            В этой расшифровке:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {unique.map((name) => (
                              <button
                                key={name}
                                tabIndex={-1}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  if (onRenameSpeaker && editingSpeaker) {
                                    onRenameSpeaker(editingSpeaker, name);
                                  }
                                  setEditingSpeaker(null);
                                }}
                                className="px-2 py-1 rounded-md text-xs border border-accent/50 bg-accent/10 hover:bg-accent hover:text-accent-foreground transition-colors"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </span>
              ) : (
                <>
                  {getSpeakerDisplay(speaker)}
                  {onRenameSpeaker && (
                    <button
                      onClick={() => startEdit(speaker)}
                      className="opacity-60 hover:opacity-100 transition-opacity"
                      title="Переименовать"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {onMergeSpeakers && uniqueSpeakers.length > 1 && (
                    <button
                      onClick={() => setMergingFrom(isMerging ? null : speaker)}
                      className="opacity-60 hover:opacity-100 transition-opacity"
                      title="Объединить с другим спикером"
                    >
                      <Merge className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
              {isEditing && (
                <button
                  onClick={commitEdit}
                  className="opacity-60 hover:opacity-100"
                >
                  <Check className="w-3 h-3" />
                </button>
              )}
              {isMerging && (
                <div
                  className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl p-1 min-w-[160px] max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto backdrop-blur-none"
                  style={{ backgroundColor: "hsl(var(--popover))" }}
                  ref={(el) => {
                    if (!el) return;
                    const rect = el.getBoundingClientRect();
                    const overflow = rect.right - (window.innerWidth - 8);
                    if (overflow > 0) {
                      el.style.transform = `translateX(${-overflow}px)`;
                    } else {
                      el.style.transform = "";
                    }
                  }}
                >
                  <p className="text-[10px] text-muted-foreground px-2 py-1">
                    Объединить с:
                  </p>
                  {uniqueSpeakers
                    .filter((s) => s !== speaker)
                    .map((target) => {
                      const tSeg = segments.find((s) => s.speaker === target);
                      const tIdx = tSeg ? tSeg.speakerIndex % 5 : 0;
                      return (
                        <button
                          key={target}
                          onClick={() => {
                            onMergeSpeakers(speaker, target);
                            setMergingFrom(null);
                            toast({
                              title: "Спикеры объединены",
                              description: `${getSpeakerDisplay(speaker)} → ${getSpeakerDisplay(target)}`,
                            });
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors text-left"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${SPEAKER_DOT[tIdx]}`}
                          />
                          {getSpeakerDisplay(target)}
                        </button>
                      );
                    })}
                </div>
              )}
            </span>
          );
        })}
      </div>

      <AISummaryPanel
        segments={segments}
        speakerNames={speakerNames}
        onSummaryData={setAiSummary}
        transcriptionId={transcriptionId}
      />

      {selectionMode && (
        <div className="sticky top-[132px] z-30 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-card p-3 shadow-md">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Выбрано:{" "}
              <strong className="text-foreground">
                {selectedSegmentIds.size}
              </strong>
            </span>
            <button
              type="button"
              onClick={() =>
                setSelectedSegmentIds(
                  new Set(segments.map((segment) => segment.id)),
                )
              }
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Все
            </button>
            <button
              type="button"
              onClick={() => setSelectedSegmentIds(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Сбросить
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copySelectedSegments}
              disabled={selectedSegmentIds.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-sm hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <Copy className="w-4 h-4" /> Копировать
            </button>
            <button
              type="button"
              onClick={deleteSelectedSegments}
              disabled={selectedSegmentIds.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm hover:bg-destructive/15 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Удалить
            </button>
            <button
              type="button"
              onClick={exitSelectionMode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" /> Отмена
            </button>
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить выбранные фрагменты?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет удалено фрагментов:{" "}
              <strong>{selectedSegmentIds.size}</strong>. Это действие нельзя
              отменить — восстановить удалённые фрагменты будет невозможно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSelectedSegments}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-3">
        {segments.map((segment, i) => {
          const isActiveByTime =
            currentTime !== undefined &&
            currentTime >= segment.startTime &&
            currentTime < segment.endTime;
          const isActiveByIndex = activeSegmentIndex === i;
          const isActive = isActiveByIndex || isActiveByTime;

          return (
            <div key={segment.id}>
              <SegmentItem
                segment={segment}
                index={i}
                isActive={isActive}
                isScrollTarget={scrollToSegment === i}
                onSeekTo={handleSeekTo}
                getSpeakerDisplay={getSpeakerDisplay}
                highlights={searchHighlights.get(i)}
                onEdit={handleEdit}
                onRenameSpeaker={onRenameSpeaker}
                segmentReplacements={replacementMatches.filter(
                  (m) => m.segmentIndex === i,
                )}
                onReplacementAccept={onReplacementAccept}
                onReplacementDismiss={onReplacementDismiss}
                userScrollingRef={userScrollingRef}
                activeSegmentRef={activeSegmentRef}
                currentTime={isActive ? currentTime : undefined}
                onMerge={onMergeSegments ? () => onMergeSegments(i) : undefined}
                onMergePrev={
                  onMergeSegments && i > 0
                    ? () => onMergeSegments(i - 1)
                    : undefined
                }
                onSplit={
                  onSplitSegment ? (pos) => onSplitSegment(i, pos) : undefined
                }
                onDelete={
                  onDeleteSegment ? () => onDeleteSegment(i) : undefined
                }
                isLast={i === segments.length - 1}
                isFirst={i === 0}
                allSpeakers={allSpeakersInfo}
                onReassignSpeaker={onReassignSegmentSpeaker}
                onEditStart={onEditStart}
                onTogglePlay={onTogglePlay}
                onNextSegment={handleNextEditSegment}
                onContinuePlayback={onContinuePlayback}
                onUndo={onUndoSpeakerChange}
                onRedo={onRedo}
                canUndo={canUndoSpeakerChange}
                canRedo={canRedo}
                selectionMode={selectionMode}
                isSelected={selectedSegmentIds.has(segment.id)}
                onToggleSelected={() => toggleSegmentSelection(segment.id)}
                autoScrollLocked={
                  editingSegmentIndex !== null && editingSegmentIndex !== i
                }
                onEditingChange={handleEditingChange}
                forceEditToken={
                  forcedEdit?.index === i ? forcedEdit.token : undefined
                }
              />
              {showNextButton && activeSegmentIndex === i && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center gap-3 py-2"
                >
                  {onRepeatSegment && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={onRepeatSegment}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors text-sm font-medium shadow-md"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Повтор
                    </button>
                  )}
                  {onContinuePlayback && (
                    <button
                      onClick={onContinuePlayback}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-navy text-primary-foreground hover:bg-navy-light transition-colors text-sm font-medium shadow-md"
                    >
                      <SkipForward className="w-4 h-4" />
                      Далее
                    </button>
                  )}
                  {onNextSegment &&
                    activeSegmentIndex < segments.length - 1 && (
                      <button
                        onClick={() => {
                          const nextIndex = activeSegmentIndex + 1;
                          onNextSegment(nextIndex, segments[nextIndex]);
                        }}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors text-sm font-medium shadow-md"
                      >
                        <SkipForward className="w-4 h-4" />
                        Следующий
                      </button>
                    )}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showBackToSegment && isPlaying && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={scrollToActive}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-navy text-primary-foreground shadow-lg hover:bg-navy-light transition-colors text-sm font-medium"
          >
            <LocateFixed className="w-4 h-4" />К текущему сегменту
          </motion.button>
        )}
      </AnimatePresence>

      {showExport && (
        <ExportDialog
          segments={renamedSegments}
          onClose={() => setShowExport(false)}
          aiSummary={aiSummary}
        />
      )}
    </div>
  );
};

export default TranscriptionView;
