import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale,
  ArrowLeft,
  Trash2,
  Clock,
  Users,
  FileText,
  ChevronRight,
  ChevronUp,
  Search,
  SortAsc,
  SortDesc,
  CalendarIcon,
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Keyboard,
  Home,
  Loader2,
  Download,
  Folder as FolderIcon,
  FolderInput,
  CheckSquare,
  Square,
  Combine,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useSharedTranscriptionQueue } from "@/hooks/useSharedTranscriptionQueue";
import {
  applyAudioRetentionPolicy,
  getAudioStorageStats,
} from "@/lib/audioRetention";
import { formatAudioStorageUsage } from "@/lib/tierLimits";
import {
  loadTranscriptions,
  loadTranscriptionSegments,
  deleteTranscription,
  deleteTranscriptionAudio,
  getAudioUrl,
  updateSpeakerNames,
  mergeSpeakersInDb,
  reassignSegmentSpeaker,
  updateSegmentText,
  deleteSegment,
  mergeTranscriptions,
  splitSegmentInDb,
  mergeSegmentsInDb,
  restoreSegmentInDb,
} from "@/lib/transcriptionStorage";
import { supabase } from "@/integrations/supabase/client";
import {
  loadFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  loadTags,
  createTag,
  setTranscriptionFolder,
  loadAllTranscriptionTagsMap,
  loadTranscriptionTags,
  addTranscriptionTag,
  removeTranscriptionTag,
  searchTranscriptionsAdvanced,
  type Folder,
  type Tag,
  type SearchResult,
} from "@/lib/foldersTagsStorage";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import TranscriptionView from "@/components/TranscriptionView";
import { toast } from "@/hooks/use-toast";
import type { TranscriptSegment } from "@/lib/transcript";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FolderSidebar } from "@/components/FolderSidebar";
import { TagManager } from "@/components/TagManager";
import { StalledJobsPanel } from "@/components/StalledJobsPanel";
import { ActiveJobsPanel } from "@/components/ActiveJobsPanel";

function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
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
}
import { ReplacementRulesManager } from "@/components/ReplacementRulesManager";
import { findMatches, applyReplacements } from "@/lib/replacementEngine";
import { PlayPauseOverlay } from "@/components/PlayPauseOverlay";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MergeTranscriptionsDialog } from "@/components/MergeTranscriptionsDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { VolumeControl } from "@/components/VolumeControl";

interface TranscriptionRecord {
  id: string;
  file_name: string;
  duration: number;
  speaker_count: number;
  segment_count: number;
  speaker_names: Record<string, string>;
  audio_path: string | null;
  created_at: string;
  folder_id: string | null;
  source_audio_paths?: string[] | null;
  source_file_names?: string[] | null;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const History = () => {
  const { user } = useAuth();
  const subscription = useSubscription();
  const { items: queueItems } = useSharedTranscriptionQueue();
  const activeQueueItems = queueItems.filter(
    (i) => i.status === "pending" || i.status === "processing",
  );
  const navigate = useNavigate();
  const [records, setRecords] = useState<TranscriptionRecord[]>([]);
  const [audioStorageLabel, setAudioStorageLabel] = useState("");
  const [audioRetentionDays, setAudioRetentionDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [selectedRecord, setSelectedRecord] =
    useState<TranscriptionRecord | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMissing, setAudioMissing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("lexscribe.audio.muted") === "1";
  });
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 1;
    const stored = parseFloat(
      localStorage.getItem("lexscribe.audio.volume") ?? "",
    );
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 1;
  });

  useEffect(() => {
    localStorage.setItem("lexscribe.audio.volume", String(volume));
  }, [volume]);
  useEffect(() => {
    localStorage.setItem("lexscribe.audio.muted", isMuted ? "1" : "0");
  }, [isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted, audioUrl]);
  const [showVolume, setShowVolume] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showRateMenu, setShowRateMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [playToggleTrigger, setPlayToggleTrigger] = useState(0);
  const [undoStack, setUndoStack] = useState<TranscriptSegment[][]>([]);
  const [redoStack, setRedoStack] = useState<TranscriptSegment[][]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(
    null,
  );
  const [showNextButton, setShowNextButton] = useState(false);
  const [continuousPlay, setContinuousPlay] = useState(false);
  const continuousPlayRef = useRef(false);
  const fragmentReviewRef = useRef<{
    index: number;
    startTime: number;
    endTime: number;
  } | null>(null);

  const updateContinuousPlay = useCallback((next: boolean) => {
    continuousPlayRef.current = next;
    setContinuousPlay(next);
  }, []);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagsByTranscription, setTagsByTranscription] = useState<
    Map<string, Tag[]>
  >(new Map());
  const [selectedFolderId, setSelectedFolderId] = useState<
    string | null | "all"
  >("all");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterSpeaker, setFilterSpeaker] = useState("");
  const [filterCaseNumber, setFilterCaseNumber] = useState("");
  const [searchResults, setSearchResults] = useState<Map<
    string,
    SearchResult
  > | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTranscriptionTags, setSelectedTranscriptionTags] = useState<
    Tag[]
  >([]);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(
    new Set(),
  );
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSources, setMergeSources] = useState<
    Array<{
      id: string;
      file_name: string;
      duration: number;
      created_at: string;
    }>
  >([]);
  const [merging, setMerging] = useState(false);
  const [audioMerging, setAudioMerging] = useState(false);

  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    let cancelled = false;
    Promise.allSettled([
      loadTranscriptions(),
      loadFolders(),
      loadTags(),
      loadAllTranscriptionTagsMap(),
    ]).then(async (results) => {
      if (cancelled) return;
      await applyAudioRetentionPolicy(user.id).catch(console.error);
      const recsAfterRetention = await loadTranscriptions();
      if (cancelled) return;
      const [fldR, tgsR, tMapR] = results;
      setRecords(recsAfterRetention as TranscriptionRecord[]);
      getAudioStorageStats(user.id).then((stats) => {
        if (!cancelled) {
          setAudioStorageLabel(
            formatAudioStorageUsage(stats.usedBytes, stats.limitBytes),
          );
          setAudioRetentionDays(stats.retentionDays);
        }
      });
      if (fldR.status === "fulfilled") setFolders(fldR.value);
      if (tgsR.status === "fulfilled") setAllTags(tgsR.value);
      if (tMapR.status === "fulfilled") setTagsByTranscription(tMapR.value);
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        console.warn("History: некоторые данные не загрузились", failed);
        toast({
          title: "Часть данных не загрузилась",
          description: "Проверьте подключение и потяните, чтобы обновить.",
          variant: "destructive",
        });
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedTranscriptionTags([]);
      return;
    }
    loadTranscriptionTags(selectedId).then(setSelectedTranscriptionTags);
  }, [selectedId]);

  const hasActiveFilters = useMemo(
    () =>
      !!searchQuery.trim() ||
      filterTagIds.length > 0 ||
      !!filterSpeaker.trim() ||
      !!filterCaseNumber.trim(),
    [searchQuery, filterTagIds, filterSpeaker, filterCaseNumber],
  );

  useEffect(() => {
    if (!hasActiveFilters) {
      setSearchResults(null);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      const results = await searchTranscriptionsAdvanced({
        query: searchQuery,
        tagIds: filterTagIds,
        speaker: filterSpeaker,
        caseNumber: filterCaseNumber,
      });
      const map = new Map(results.map((r) => [r.transcription_id, r]));
      setSearchResults(map);
      setSearchLoading(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [
    searchQuery,
    filterTagIds,
    filterSpeaker,
    filterCaseNumber,
    hasActiveFilters,
  ]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      if (r.folder_id) counts[r.folder_id] = (counts[r.folder_id] || 0) + 1;
    });
    return counts;
  }, [records]);

  const unfiledCount = useMemo(
    () => records.filter((r) => !r.folder_id).length,
    [records],
  );

  const filteredRecords = useMemo(() => {
    let result = records;

    if (selectedFolderId === null) {
      result = result.filter((r) => !r.folder_id);
    } else if (selectedFolderId !== "all") {
      result = result.filter((r) => r.folder_id === selectedFolderId);
    }

    if (hasActiveFilters && searchResults) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          searchResults.has(r.id) ||
          (q && r.file_name.toLowerCase().includes(q)),
      );
    }

    if (dateFrom) {
      const fromStart = new Date(dateFrom);
      fromStart.setHours(0, 0, 0, 0);
      result = result.filter((r) => new Date(r.created_at) >= fromStart);
    }
    if (dateTo) {
      const toEnd = new Date(dateTo);
      toEnd.setHours(23, 59, 59, 999);
      result = result.filter((r) => new Date(r.created_at) <= toEnd);
    }
    result = [...result].sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortOrder === "desc" ? db - da : da - db;
    });
    return result;
  }, [
    records,
    searchQuery,
    sortOrder,
    dateFrom,
    dateTo,
    selectedFolderId,
    searchResults,
    hasActiveFilters,
  ]);

  const handleCreateFolder = async (name: string, caseNumber: string) => {
    const f = await createFolder(name, caseNumber);
    if (f)
      setFolders((prev) =>
        [...prev, f].sort((a, b) => a.name.localeCompare(b.name)),
      );
  };

  const handleUpdateFolder = async (
    id: string,
    name: string,
    caseNumber: string,
  ) => {
    const ok = await updateFolder(id, {
      name,
      case_number: caseNumber || null,
    });
    if (ok)
      setFolders((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, name, case_number: caseNumber || null } : f,
        ),
      );
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Удалить папку? Расшифровки внутри останутся, но без папки."))
      return;
    const ok = await deleteFolder(id);
    if (ok) {
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setRecords((prev) =>
        prev.map((r) => (r.folder_id === id ? { ...r, folder_id: null } : r)),
      );
      if (selectedFolderId === id) setSelectedFolderId("all");
    }
  };

  const handleMoveToFolder = async (
    transcriptionId: string,
    folderId: string | null,
  ) => {
    const ok = await setTranscriptionFolder(transcriptionId, folderId);
    if (ok) {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === transcriptionId ? { ...r, folder_id: folderId } : r,
        ),
      );
      toast({
        title: "Перемещено",
        description: folderId
          ? "Расшифровка добавлена в папку"
          : "Убрано из папки",
      });
    }
  };

  const toggleSelectForMerge = (id: string) => {
    setSelectedForMerge((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedForMerge(new Set());
  };

  const openMergeDialog = (ids: string[]) => {
    if (ids.length < 2) {
      toast({
        title: "Выберите 2 или больше расшифровок",
        variant: "destructive",
      });
      return;
    }
    const items = records
      .filter((r) => ids.includes(r.id))
      .map((r) => ({
        id: r.id,
        file_name: r.file_name,
        duration: r.duration,
        created_at: r.created_at,
      }));
    setMergeSources(items);
    setMergeDialogOpen(true);
  };

  const handleMergeConfirm = async (
    orderedIds: string[],
    newName: string,
    deleteSources: boolean,
  ) => {
    setMerging(true);
    try {
      const newId = await mergeTranscriptions(orderedIds, newName, {
        deleteSources,
      });
      if (!newId) {
        toast({
          title: "Не удалось объединить расшифровки",
          variant: "destructive",
        });
        return;
      }
      const recs = await loadTranscriptions();
      setRecords(recs as TranscriptionRecord[]);
      const tMap = await loadAllTranscriptionTagsMap();
      setTagsByTranscription(tMap);
      exitSelectionMode();
      toast({
        title: "Расшифровки объединены",
        description: deleteSources
          ? "Исходные расшифровки удалены"
          : "Создана новая объединённая расшифровка",
      });
    } finally {
      setMerging(false);
    }
  };

  const handleMergeAudio = async () => {
    if (!selectedRecord) return;
    const paths = selectedRecord.source_audio_paths || [];
    if (paths.length < 2) {
      toast({
        title: "Нужно минимум 2 исходных аудиофайла",
        variant: "destructive",
      });
      return;
    }
    setAudioMerging(true);
    try {
      const { data, error } = await supabase.functions.invoke("merge-audio", {
        body: { transcription_id: selectedRecord.id },
      });
      if (error || (data as any)?.error) {
        const msg =
          (data as any)?.error ||
          error?.message ||
          "Не удалось объединить аудио";
        toast({
          title: "Ошибка склейки аудио",
          description: msg,
          variant: "destructive",
        });
        return;
      }
      const newPath = (data as any).audio_path as string;
      setSelectedRecord((prev) =>
        prev ? { ...prev, audio_path: newPath } : prev,
      );
      setRecords((prev) =>
        prev.map((r) =>
          r.id === selectedRecord.id ? { ...r, audio_path: newPath } : r,
        ),
      );
      const url = await getAudioUrl(newPath);
      setAudioUrl(url);
      toast({
        title: "Аудио объединено",
        description: `Склеено файлов: ${(data as any).parts}`,
      });
    } finally {
      setAudioMerging(false);
    }
  };
  const handleAddTag = async (transcriptionId: string, tag: Tag) => {
    const ok = await addTranscriptionTag(transcriptionId, tag.id);
    if (ok) {
      setTagsByTranscription((prev) => {
        const next = new Map(prev);
        next.set(transcriptionId, [...(next.get(transcriptionId) || []), tag]);
        return next;
      });
      if (transcriptionId === selectedId) {
        setSelectedTranscriptionTags((prev) => [...prev, tag]);
      }
    }
  };

  const handleRemoveTag = async (transcriptionId: string, tagId: string) => {
    const ok = await removeTranscriptionTag(transcriptionId, tagId);
    if (ok) {
      setTagsByTranscription((prev) => {
        const next = new Map(prev);
        next.set(
          transcriptionId,
          (next.get(transcriptionId) || []).filter((t) => t.id !== tagId),
        );
        return next;
      });
      if (transcriptionId === selectedId) {
        setSelectedTranscriptionTags((prev) =>
          prev.filter((t) => t.id !== tagId),
        );
      }
    }
  };

  const handleCreateTag = async (name: string): Promise<Tag | null> => {
    const tag = await createTag(name);
    if (tag)
      setAllTags((prev) =>
        [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)),
      );
    return tag;
  };

  const handleSelect = async (record: TranscriptionRecord) => {
    setSelectedId(record.id);
    setSelectedRecord(record);
    setCurrentTime(0);
    setIsPlaying(false);
    setActiveSegmentIndex(null);
    setShowNextButton(false);
    updateContinuousPlay(false);
    const segs = await loadTranscriptionSegments(record.id);
    setSegments(segs);

    setAudioMissing(false);
    if (record.audio_path) {
      const url = await getAudioUrl(record.audio_path);
      if (url) {
        try {
          const head = await fetch(url, { method: "HEAD" });
          if (head.ok) {
            setAudioUrl(url);
          } else {
            setAudioUrl(null);
            setAudioMissing(true);
          }
        } catch {
          setAudioUrl(url);
        }
      } else {
        setAudioUrl(null);
        setAudioMissing(true);
      }
    } else {
      setAudioUrl(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await deleteTranscription(id);
    if (ok) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setSegments([]);
        setUndoStack([]);
        setRedoStack([]);
        setSelectedRecord(null);
      }
      if (user) {
        getAudioStorageStats(user.id).then((s) =>
          setAudioStorageLabel(
            formatAudioStorageUsage(s.usedBytes, s.limitBytes),
          ),
        );
      }
      toast({ title: "Удалено", description: "Расшифровка удалена" });
    }
  };

  const handleDeleteAudio = async () => {
    if (!selectedRecord?.audio_path || !selectedId) return;
    if (
      !confirm(
        "Удалить аудиофайл? Текст расшифровки и правки останутся, но прослушивание будет недоступно.",
      )
    ) {
      return;
    }
    const ok = await deleteTranscriptionAudio(
      selectedId,
      selectedRecord.audio_path,
    );
    if (!ok) {
      toast({
        title: "Не удалось удалить аудио",
        variant: "destructive",
      });
      return;
    }
    setSelectedRecord({ ...selectedRecord, audio_path: null });
    setRecords((prev) =>
      prev.map((r) =>
        r.id === selectedId ? { ...r, audio_path: null } : r,
      ),
    );
    setAudioUrl(null);
    setAudioMissing(true);
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.pause();
    if (user) {
      getAudioStorageStats(user.id).then((s) =>
        setAudioStorageLabel(
          formatAudioStorageUsage(s.usedBytes, s.limitBytes),
        ),
      );
    }
    toast({
      title: "Аудио удалено",
      description: "Расшифровка сохранена — можно редактировать и экспортировать.",
    });
  };

  const handleBack = () => {
    if (selectedId) {
      setSelectedId(null);
      setSegments([]);
      setUndoStack([]);
      setRedoStack([]);
      setSelectedRecord(null);
      setAudioUrl(null);
      setAudioMissing(false);
      setIsPlaying(false);
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      navigate("/");
    }
  };

  const handleRenameSpeaker = (originalName: string, newName: string) => {
    if (!selectedRecord) return;
    const updated = {
      ...selectedRecord.speaker_names,
      [originalName]: newName,
    };
    setSelectedRecord({ ...selectedRecord, speaker_names: updated });
    setRecords((prev) =>
      prev.map((r) =>
        r.id === selectedRecord.id ? { ...r, speaker_names: updated } : r,
      ),
    );
    updateSpeakerNames(selectedRecord.id, updated);
  };

  const handleSegmentEdit = useCallback(
    async (segmentId: string, newText: string) => {
      pushUndo(segments);
      setSegments((prev) =>
        prev.map((s) => (s.id === segmentId ? { ...s, text: newText } : s)),
      );
      const ok = await updateSegmentText(segmentId, newText);
      if (!ok) {
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить изменения",
          variant: "destructive",
        });
      }
    },
    [segments],
  );

  const handleRuleAdded = useCallback(
    async (rule: { find_text: string; replace_text: string }) => {
      if (segments.length === 0) return;
      const matches = findMatches(segments, [rule]);
      if (matches.length === 0) {
        toast({
          title: "Совпадений не найдено",
          description: `«${rule.find_text}» не встречается в расшифровке`,
        });
        return;
      }
      pushUndo(segments);
      const updated = applyReplacements(segments, matches);
      setSegments(updated);
      const changedIdx = new Set(matches.map((m) => m.segmentIndex));
      const ops: Promise<unknown>[] = [];
      for (const idx of changedIdx) {
        const seg = updated[idx];
        if (seg?.id) ops.push(updateSegmentText(seg.id, seg.text));
      }
      await Promise.all(ops);
      toast({
        title: "Заменено",
        description: `${matches.length} совпадений: «${rule.find_text}» → «${rule.replace_text}»`,
      });
    },
    [segments],
  );

  const handleMergeSegments = useCallback(
    (index: number) => {
      pushUndo(segments);
      const current = segments[index];
      const next = segments[index + 1];
      if (!current || !next) return;
      const mergedText = current.text + " " + next.text;

      fragmentReviewRef.current = null;
      setActiveSegmentIndex(null);
      setShowNextButton(false);

      setSegments((prev) => {
        const segs = [...prev];
        if (index < 0 || index >= segs.length - 1) return prev;
        const merged: TranscriptSegment = {
          ...current,
          text: mergedText,
          endTime: next.endTime,
        };
        segs.splice(index, 2, merged);
        return segs;
      });
      toast({ title: "Объединено", description: "Два фрагмента объединены" });

      if (current.id && next.id && selectedRecord) {
        mergeSegmentsInDb(current.id, next.id, mergedText).then((ok) => {
          if (!ok) {
            toast({
              title: "Ошибка",
              description: "Не удалось сохранить объединение",
              variant: "destructive",
            });
          }
        });
      }
    },
    [segments, selectedRecord],
  );

  const handleSplitSegment = useCallback(
    async (index: number, splitPos: number) => {
      pushUndo(segments);
      const seg = segments[index];
      if (!seg) return;
      const midTime =
        seg.startTime +
        ((seg.endTime - seg.startTime) * splitPos) /
          Math.max(seg.text.length, 1);
      const firstText = seg.text.slice(0, splitPos).trim();
      const secondText = seg.text.slice(splitPos).trim();

      fragmentReviewRef.current = null;
      setActiveSegmentIndex(null);
      setShowNextButton(false);

      const tempId = crypto.randomUUID();
      setSegments((prev) => {
        const segs = [...prev];
        if (index < 0 || index >= segs.length) return prev;
        const part1: TranscriptSegment = {
          ...seg,
          text: firstText,
          endTime: midTime,
        };
        const part2: TranscriptSegment = {
          ...seg,
          id: tempId,
          text: secondText,
          startTime: midTime,
        };
        segs.splice(index, 1, part1, part2);
        return segs;
      });
      toast({ title: "Разделено", description: "Фрагмент разделён на два" });

      if (seg.id && selectedRecord) {
        const newId = await splitSegmentInDb(
          seg.id,
          firstText,
          secondText,
          midTime,
        );
        if (newId) {
          setSegments((prev) =>
            prev.map((s) => (s.id === tempId ? { ...s, id: newId } : s)),
          );
        } else {
          toast({
            title: "Ошибка",
            description: "Не удалось сохранить разделение",
            variant: "destructive",
          });
        }
      }
    },
    [segments, selectedRecord],
  );

  const handleDeleteSegment = useCallback(
    (index: number) => {
      pushUndo(segments);
      const seg = segments[index];
      if (!seg) return;
      fragmentReviewRef.current = null;
      setActiveSegmentIndex(null);
      setShowNextButton(false);
      setSegments((prev) => prev.filter((_, i) => i !== index));
      if (seg.id) deleteSegment(seg.id).catch(console.error);
      toast({ title: "Удалено", description: "Фрагмент удалён" });
    },
    [segments],
  );

  const handleMergeSpeakers = useCallback(
    (fromSpeaker: string, toSpeaker: string) => {
      if (!selectedRecord) return;
      pushUndo(segments);
      const targetSeg = segments.find((s) => s.speaker === toSpeaker);
      const targetIndex = targetSeg ? targetSeg.speakerIndex : 0;
      setSegments((prev) =>
        prev.map((s) =>
          s.speaker === fromSpeaker
            ? { ...s, speaker: toSpeaker, speakerIndex: targetIndex }
            : s,
        ),
      );
      mergeSpeakersInDb(
        selectedRecord.id,
        fromSpeaker,
        toSpeaker,
        targetIndex,
      ).catch(console.error);
      toast({
        title: "Спикеры объединены",
        description: `${fromSpeaker} → ${toSpeaker}`,
      });
    },
    [selectedRecord, segments],
  );

  const handleReassignSegmentSpeaker = useCallback(
    (segmentId: string, newSpeaker: string, newSpeakerIndex: number) => {
      pushUndo(segments);
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId
            ? { ...s, speaker: newSpeaker, speakerIndex: newSpeakerIndex }
            : s,
        ),
      );
      reassignSegmentSpeaker(segmentId, newSpeaker, newSpeakerIndex).catch(
        console.error,
      );
    },
    [segments],
  );

  const pushUndo = useCallback((currentSegments: TranscriptSegment[]) => {
    setUndoStack((prev) => [...prev, [...currentSegments]]);
    setRedoStack([]);
  }, []);

  const syncSnapshotToDb = useCallback(
    async (current: TranscriptSegment[], target: TranscriptSegment[]) => {
      const currentById = new Map(
        current.filter((s) => s.id).map((s) => [s.id, s]),
      );
      const targetById = new Map(
        target.filter((s) => s.id).map((s) => [s.id, s]),
      );

      const ops: Promise<unknown>[] = [];

      for (const [id] of currentById) {
        if (!targetById.has(id)) {
          ops.push(deleteSegment(id));
        }
      }

      for (const [id, tgt] of targetById) {
        const cur = currentById.get(id);
        if (!cur) continue;
        if (cur.text !== tgt.text) {
          ops.push(updateSegmentText(id, tgt.text));
        }
        if (
          cur.speaker !== tgt.speaker ||
          cur.speakerIndex !== tgt.speakerIndex
        ) {
          ops.push(reassignSegmentSpeaker(id, tgt.speaker, tgt.speakerIndex));
        }
      }

      if (selectedRecord) {
        target.forEach((tgt, idx) => {
          if (tgt.id && !currentById.has(tgt.id)) {
            ops.push(restoreSegmentInDb(tgt, selectedRecord.id, idx));
          }
        });
      }

      if (ops.length > 0) {
        try {
          await Promise.all(ops);
        } catch (err) {
          console.error("Failed to sync undo/redo to DB:", err);
        }
      }
    },
    [selectedRecord],
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const snapshot = newStack.pop()!;
      setRedoStack((r) => [...r, [...segments]]);
      syncSnapshotToDb(segments, snapshot);
      setSegments(snapshot);
      toast({ title: "Отменено", description: "Последнее изменение отменено" });
      return newStack;
    });
  }, [segments, syncSnapshotToDb]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const snapshot = newStack.pop()!;
      setUndoStack((u) => [...u, [...segments]]);
      syncSnapshotToDb(segments, snapshot);
      setSegments(snapshot);
      toast({ title: "Возвращено", description: "Изменение возвращено" });
      return newStack;
    });
  }, [segments, syncSnapshotToDb]);

  const handleDeleteSegments = useCallback(
    (indices: number[]) => {
      const indexSet = new Set(indices);
      const toDelete = segments.filter((_, i) => indexSet.has(i));
      if (toDelete.length === 0) return;
      pushUndo(segments);
      setSegments((prev) => prev.filter((_, i) => !indexSet.has(i)));
      Promise.all(
        toDelete.filter((seg) => seg.id).map((seg) => deleteSegment(seg.id)),
      ).catch(console.error);
      toast({
        title: "Удалено",
        description: `Удалено фрагментов: ${toDelete.length}`,
      });
    },
    [segments, pushUndo],
  );

  const togglePlayCb = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
    setPlayToggleTrigger((n) => n + 1);
  }, [isPlaying, audioUrl]);

  const skipForwardCb = useCallback(() => skip(5), [audioDuration]);
  const skipBackwardCb = useCallback(() => skip(-5), [audioDuration]);

  useKeyboardShortcuts({
    onTogglePlay: selectedId && audioUrl ? togglePlayCb : undefined,
    onSkipForward: selectedId && audioUrl ? skipForwardCb : undefined,
    onSkipBackward: selectedId && audioUrl ? skipBackwardCb : undefined,
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let rafId: number | null = null;

    const tick = () => {
      if (!audio.paused) {
        setCurrentTime(audio.currentTime);
        const t = audio.currentTime;

        const reviewSegment = fragmentReviewRef.current;

        if (continuousPlayRef.current) {
          const idx = segments.findIndex(
            (s) => t >= s.startTime && t < s.endTime,
          );
          if (idx >= 0 && idx !== activeSegmentIndex) {
            setActiveSegmentIndex(idx);
          }
        } else if (reviewSegment) {
          if (t < reviewSegment.startTime - 0.05) {
            audio.currentTime = reviewSegment.startTime;
            setCurrentTime(reviewSegment.startTime);
          } else if (t >= reviewSegment.endTime) {
            audio.pause();
            audio.currentTime = reviewSegment.endTime;
            setCurrentTime(reviewSegment.endTime);
            setIsPlaying(false);
            setShowNextButton(true);
          }
        } else if (
          activeSegmentIndex !== null &&
          segments[activeSegmentIndex]
        ) {
          const seg = segments[activeSegmentIndex];
          if (t >= seg.endTime) {
            audio.pause();
            audio.currentTime = seg.endTime;
            setCurrentTime(seg.endTime);
            setIsPlaying(false);
            setShowNextButton(true);
          }
        }

        rafId = requestAnimationFrame(tick);
      }
    };

    const onPlay = () => {
      rafId = requestAnimationFrame(tick);
    };
    const onPause = () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
    const onLoaded = () => {
      setAudioDuration(audio.duration);
      audio.playbackRate = playbackRate;
    };
    const onEnded = () => {
      setIsPlaying(false);
      setShowNextButton(false);
      setActiveSegmentIndex(null);
    };
    const onError = async () => {
      const path = selectedRecord?.audio_path;
      if (!path) return;
      console.warn("[History] Audio error, refreshing signed URL");
      const fresh = await getAudioUrl(path);
      if (fresh && fresh !== audioUrl) {
        setAudioUrl(fresh);
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    if (!audio.paused) rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [audioUrl, activeSegmentIndex, segments, selectedRecord?.audio_path]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        if (activeSegmentIndex === null || continuousPlay) {
          updateContinuousPlay(true);
          const t = audioRef.current.currentTime;
          const idx = segments.findIndex(
            (s) => t >= s.startTime && t < s.endTime,
          );
          setActiveSegmentIndex(idx >= 0 ? idx : 0);
        }
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("[History] Play failed:", err);
        setIsPlaying(false);
      }
    }
  };

  const skip = (sec: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(
      0,
      Math.min(audioDuration, audioRef.current.currentTime + sec),
    );
  };

  const safePlay = useCallback(
    async (audio: HTMLAudioElement) => {
      const tryPlay = async () => {
        await audio.play();
        setIsPlaying(true);
      };
      try {
        await tryPlay();
      } catch (err: any) {
        if (err?.name === "AbortError") {
          try {
            await tryPlay();
            return;
          } catch (e) {
            /* fallthrough */
          }
        }
        const path = selectedRecord?.audio_path;
        if (path) {
          const fresh = await getAudioUrl(path);
          if (fresh) {
            const wasTime = audio.currentTime;
            setAudioUrl(fresh);
            console.warn("[History] Refreshed signed URL after play failure");
          }
        }
        console.error("[History] Play failed:", err);
        setIsPlaying(false);
      }
    },
    [selectedRecord?.audio_path],
  );

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    let idx = segments.findIndex(
      (s) => seconds >= s.startTime - 0.01 && seconds < s.endTime,
    );
    if (idx < 0)
      idx = segments.findIndex((s) => Math.abs(s.startTime - seconds) < 0.05);
    if (idx < 0 && segments.length > 0) {
      let best = 0;
      let bestDist = Math.abs(segments[0].startTime - seconds);
      for (let i = 1; i < segments.length; i++) {
        const d = Math.abs(segments[i].startTime - seconds);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      idx = best;
    }
    const seg = idx >= 0 ? segments[idx] : null;
    fragmentReviewRef.current = seg
      ? { index: idx, startTime: seg.startTime, endTime: seg.endTime }
      : null;
    setActiveSegmentIndex(idx >= 0 ? idx : null);
    setShowNextButton(false);
    updateContinuousPlay(false);
    const target = seg
      ? Math.max(seg.startTime, Math.min(seconds, seg.endTime - 0.05))
      : seconds;
    audio.currentTime = target;
    setCurrentTime(target);
    safePlay(audio);
  };

  const playSegmentFragment = useCallback(
    (index: number, segment: TranscriptSegment) => {
      const audio = audioRef.current;
      if (!audio || !audioUrl) return;

      fragmentReviewRef.current = {
        index,
        startTime: segment.startTime,
        endTime: segment.endTime,
      };
      setActiveSegmentIndex(index);
      setShowNextButton(false);
      updateContinuousPlay(false);
      audio.currentTime = segment.startTime;
      setCurrentTime(segment.startTime);
      safePlay(audio);
    },
    [audioUrl, updateContinuousPlay, safePlay],
  );

  const playNextSegmentFragment = useCallback(
    (targetIndex?: number, targetSegment?: TranscriptSegment) => {
      const nextIdx =
        targetIndex ??
        (activeSegmentIndex !== null ? activeSegmentIndex + 1 : -1);
      const nextSegment = targetSegment ?? segments[nextIdx];
      if (nextIdx < 0 || nextIdx >= segments.length || !nextSegment) {
        setActiveSegmentIndex(null);
        setShowNextButton(false);
        return;
      }
      playSegmentFragment(nextIdx, nextSegment);
    },
    [activeSegmentIndex, playSegmentFragment, segments],
  );

  const continueSegmentPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl || segments.length === 0) return;

    const currentIndex = fragmentReviewRef.current?.index ?? activeSegmentIndex;
    const nextIndex =
      currentIndex !== null && currentIndex >= 0 ? currentIndex + 1 : 0;
    if (nextIndex >= segments.length) {
      setActiveSegmentIndex(null);
      setShowNextButton(false);
      return;
    }

    fragmentReviewRef.current = null;
    updateContinuousPlay(true);
    setActiveSegmentIndex(nextIndex);
    setShowNextButton(false);
    audio.currentTime = segments[nextIndex].startTime;
    setCurrentTime(segments[nextIndex].startTime);
    safePlay(audio);
  }, [activeSegmentIndex, audioUrl, segments, updateContinuousPlay, safePlay]);

  const formatPlayTime = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 relative">
        <div className="container max-w-5xl mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <img
              src="/icon-192.png"
              alt="ПротоколЪ"
              className="w-10 h-10 object-contain hidden sm:block"
            />
            <div>
              <h1 className="text-lg sm:text-xl font-serif font-bold text-foreground leading-tight">
                {selectedId ? "Расшифровка" : "История"}
              </h1>
              <p className="text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-none">
                {selectedId
                  ? selectedRecord?.file_name
                  : `${records.length} записей`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate("/")}
              className="p-2 rounded-lg hover:bg-muted transition-colors hidden sm:flex"
              title="На главную"
            >
              <Home className="w-4 h-4 text-muted-foreground" />
            </button>
            {selectedId && (
              <ReplacementRulesManager onRuleAdded={handleRuleAdded} />
            )}
            <ThemeToggle />
            <MobileNav />
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center text-muted-foreground py-20">
            Загрузка...
          </div>
        ) : selectedId ? (
          <div>
            {selectedRecord && (
              <div className="mb-4 flex flex-wrap items-center gap-2 p-3 rounded-xl bg-card/50 border border-border">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border border-border bg-background hover:bg-muted transition-colors">
                      <FolderIcon
                        className="w-3.5 h-3.5"
                        style={{
                          color:
                            folders.find(
                              (f) => f.id === selectedRecord.folder_id,
                            )?.color || "hsl(var(--muted-foreground))",
                        }}
                      />
                      {folders.find((f) => f.id === selectedRecord.folder_id)
                        ?.name || "Без папки"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1" align="start">
                    <button
                      onClick={() => {
                        handleMoveToFolder(selectedRecord.id, null);
                        setSelectedRecord({
                          ...selectedRecord,
                          folder_id: null,
                        });
                      }}
                      className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center gap-2 text-muted-foreground"
                    >
                      <X className="w-3.5 h-3.5" /> Без папки
                    </button>
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          handleMoveToFolder(selectedRecord.id, f.id);
                          setSelectedRecord({
                            ...selectedRecord,
                            folder_id: f.id,
                          });
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center gap-2"
                      >
                        <FolderIcon
                          className="w-3.5 h-3.5"
                          style={{ color: f.color }}
                        />
                        <span className="truncate">{f.name}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
                <TagManager
                  allTags={allTags}
                  selectedTags={selectedTranscriptionTags}
                  onAdd={(tag) => handleAddTag(selectedRecord.id, tag)}
                  onRemove={(tagId) =>
                    handleRemoveTag(selectedRecord.id, tagId)
                  }
                  onCreateTag={handleCreateTag}
                />
              </div>
            )}
            {selectedRecord?.source_audio_paths &&
              selectedRecord.source_audio_paths.length > 0 && (
                <div className="mb-4 p-3 sm:p-4 rounded-xl bg-card border border-border">
                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Combine className="w-4 h-4 text-gold" />
                      <h3 className="text-sm font-serif font-semibold text-foreground">
                        Исходные аудиофайлы (
                        {selectedRecord.source_audio_paths.length})
                      </h3>
                    </div>
                    {!selectedRecord.audio_path && (
                      <button
                        onClick={handleMergeAudio}
                        disabled={audioMerging}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-navy hover:bg-navy-light text-primary-foreground disabled:opacity-50 transition-colors"
                      >
                        {audioMerging ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Combine className="w-3.5 h-3.5" />
                        )}
                        {audioMerging ? "Склеиваем..." : "Объединить аудио"}
                      </button>
                    )}
                    {selectedRecord.audio_path && (
                      <span className="text-xs text-muted-foreground">
                        Аудио объединено ✓
                      </span>
                    )}
                  </div>
                  <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                    {(
                      selectedRecord.source_file_names ||
                      selectedRecord.source_audio_paths
                    ).map((name, i) => (
                      <li key={i} className="truncate">
                        {selectedRecord.source_file_names?.[i] ||
                          `Файл ${i + 1}`}
                      </li>
                    ))}
                  </ol>
                  {!selectedRecord.audio_path && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Простая склейка работает, если все исходные файлы одного
                      формата (например, все MP3).
                    </p>
                  )}
                </div>
              )}
            {selectedRecord && audioStorageLabel && (
              <div className="mb-4 p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
                Хранилище аудио:{" "}
                <span className="font-medium text-foreground">
                  {audioStorageLabel}
                </span>
                {subscription.tier === "team"
                  ? " (общий пул команды)"
                  : null}{" "}
                · срок хранения до{" "}
                <span className="font-medium text-foreground">
                  {audioRetentionDays} дн.
                </span>
                . Текст расшифровки без лимита — редактирование и экспорт
                всегда доступны. Освободить место: кнопка корзины у плеера.
              </div>
            )}
            {audioMissing && !audioUrl && (
              <div className="mb-4 p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-sm text-destructive">
                Аудиофайл этой расшифровки недоступен в хранилище (возможно, был
                удалён). Текст расшифровки сохранён — редактирование и экспорт
                доступны, воспроизведение невозможно.
              </div>
            )}
            {audioUrl && (
              <div className="mb-6 p-3 sm:p-4 rounded-xl bg-card border border-border overflow-visible relative sticky top-[65px] z-20 shadow-md">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => skip(-10)}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="−10 сек"
                  >
                    <SkipBack className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="p-2 rounded-full bg-navy hover:bg-navy-light transition-colors flex-shrink-0"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 text-primary-foreground" />
                    ) : (
                      <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                    )}
                  </button>
                  <button
                    onClick={() => skip(10)}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="+10 сек"
                  >
                    <SkipForward className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <span className="text-xs text-muted-foreground font-mono w-10 sm:w-14 text-center">
                    {formatPlayTime(currentTime)}
                  </span>
                  <div
                    className="flex-1 h-2 bg-muted rounded-full cursor-pointer min-w-[60px]"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(
                        0,
                        Math.min(1, (e.clientX - rect.left) / rect.width),
                      );
                      seekTo(ratio * audioDuration);
                    }}
                  >
                    <div
                      className="h-full bg-gold rounded-full transition-[width] duration-100"
                      style={{
                        width:
                          audioDuration > 0
                            ? `${(currentTime / audioDuration) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono w-10 sm:w-14 text-right">
                    {formatPlayTime(audioDuration)}
                  </span>
                  <VolumeControl
                    isPlaying={isPlaying}
                    volume={volume}
                    isMuted={isMuted}
                    onToggleMute={() => {
                      if (audioRef.current) {
                        const newMuted = !isMuted;
                        audioRef.current.muted = newMuted;
                        setIsMuted(newMuted);
                      }
                    }}
                    onChange={(val) => {
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
                    }}
                  />
                  <div className="relative hidden sm:flex items-center">
                    <button
                      onClick={() => setShowRateMenu((v) => !v)}
                      className="px-2 py-1 rounded hover:bg-muted transition-colors text-xs font-mono text-muted-foreground min-w-[2.5rem]"
                      title="Скорость воспроизведения"
                    >
                      {playbackRate}x
                    </button>
                    {showRateMenu && (
                      <div className="absolute top-full right-0 mt-2 bg-card border border-border rounded-lg shadow-lg py-1 z-50 min-w-[4rem]">
                        {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              setPlaybackRate(r);
                              if (audioRef.current)
                                audioRef.current.playbackRate = r;
                              setShowRateMenu(false);
                            }}
                            className={`w-full px-3 py-1.5 text-xs font-mono text-left hover:bg-muted transition-colors ${
                              playbackRate === r
                                ? "text-gold font-semibold"
                                : "text-foreground"
                            }`}
                          >
                            {r}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {audioUrl && (
                    <>
                      <a
                        href={audioUrl}
                        download={selectedRecord?.file_name || "audio"}
                        className="p-1.5 rounded hover:bg-muted transition-colors hidden sm:flex"
                        title="Скачать аудио"
                      >
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </a>
                      <button
                        type="button"
                        onClick={handleDeleteAudio}
                        className="p-1.5 rounded hover:bg-destructive/10 transition-colors hidden sm:flex"
                        title="Удалить аудио (текст останется)"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </>
                  )}
                </div>
                <audio ref={audioRef} key={audioUrl} className="hidden">
                  {audioUrl && (
                    <source
                      src={audioUrl}
                      type={getMimeType(
                        selectedRecord?.audio_path ||
                          selectedRecord?.file_name ||
                          "",
                      )}
                    />
                  )}
                </audio>
              </div>
            )}

            <TranscriptionView
              segments={segments}
              speakerNames={selectedRecord?.speaker_names || {}}
              fileName={selectedRecord?.file_name}
              onRenameSpeaker={handleRenameSpeaker}
              onSeekTo={audioUrl ? seekTo : undefined}
              currentTime={audioUrl ? currentTime : undefined}
              onSegmentEdit={handleSegmentEdit}
              isPlaying={isPlaying}
              activeSegmentIndex={activeSegmentIndex}
              showNextButton={showNextButton}
              onNextSegment={playNextSegmentFragment}
              onContinuePlayback={continueSegmentPlayback}
              onRepeatSegment={() => {
                if (
                  activeSegmentIndex !== null &&
                  segments[activeSegmentIndex]
                ) {
                  const seg = segments[activeSegmentIndex];
                  setShowNextButton(false);
                  if (audioRef.current) {
                    audioRef.current.currentTime = seg.startTime;
                    audioRef.current.play();
                    setIsPlaying(true);
                  }
                }
              }}
              onMergeSpeakers={handleMergeSpeakers}
              onMergeSegments={handleMergeSegments}
              onSplitSegment={handleSplitSegment}
              onDeleteSegment={handleDeleteSegment}
              onDeleteSegments={handleDeleteSegments}
              onReassignSegmentSpeaker={handleReassignSegmentSpeaker}
              onUndoSpeakerChange={handleUndo}
              onRedo={handleRedo}
              canUndoSpeakerChange={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              onEditStart={(index, segment) => {
                playSegmentFragment(index, segment);
              }}
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
              transcriptionId={selectedRecord?.id}
            />
            <PlayPauseOverlay
              isPlaying={isPlaying}
              triggerKey={playToggleTrigger}
            />
            {audioUrl && (
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/60">
                <Keyboard className="w-3.5 h-3.5" />
                Пробел — пауза/воспроизведение · ← → — перемотка 5 сек
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <FolderSidebar
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onCreate={handleCreateFolder}
              onUpdate={handleUpdateFolder}
              onDelete={handleDeleteFolder}
              counts={folderCounts}
              totalCount={records.length}
              unfiledCount={unfiledCount}
            />

            <div className="flex-1 min-w-0 space-y-4">
              <ActiveJobsPanel />
              <StalledJobsPanel />
              {records.length === 0 && activeQueueItems.length === 0 ? (
                <div className="text-center py-20">
                  <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Нет сохранённых расшифровок
                  </p>
                  <button
                    onClick={() => navigate("/")}
                    className="mt-4 px-6 py-2 rounded-xl bg-navy text-primary-foreground hover:bg-navy-light transition-colors text-sm font-medium"
                  >
                    Создать расшифровку
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
                    <div className="relative flex-1 min-w-0">
                      {searchLoading ? (
                        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                      ) : (
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      )}
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск по тексту всех расшифровок..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={cn(
                              "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-sm",
                              dateFrom
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="w-4 h-4" />
                            {dateFrom ? format(dateFrom, "dd.MM.yy") : "От"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateFrom}
                            onSelect={setDateFrom}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={cn(
                              "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-sm",
                              dateTo
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="w-4 h-4" />
                            {dateTo ? format(dateTo, "dd.MM.yy") : "До"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateTo}
                            onSelect={setDateTo}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>

                      <button
                        onClick={() => setShowFilters((s) => !s)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-colors text-sm",
                          showFilters ||
                            filterTagIds.length > 0 ||
                            filterSpeaker ||
                            filterCaseNumber
                            ? "border-gold/50 bg-gold/10 text-foreground"
                            : "border-border bg-card hover:bg-muted text-muted-foreground",
                        )}
                      >
                        Ещё фильтры
                        {filterTagIds.length +
                          (filterSpeaker ? 1 : 0) +
                          (filterCaseNumber ? 1 : 0) >
                          0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-gold text-navy text-[10px] font-bold">
                            {filterTagIds.length +
                              (filterSpeaker ? 1 : 0) +
                              (filterCaseNumber ? 1 : 0)}
                          </span>
                        )}
                      </button>

                      {(dateFrom ||
                        dateTo ||
                        filterTagIds.length > 0 ||
                        filterSpeaker ||
                        filterCaseNumber) && (
                        <button
                          onClick={() => {
                            setDateFrom(undefined);
                            setDateTo(undefined);
                            setFilterTagIds([]);
                            setFilterSpeaker("");
                            setFilterCaseNumber("");
                          }}
                          className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Сбросить фильтры"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() =>
                          setSortOrder(sortOrder === "desc" ? "asc" : "desc")
                        }
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-sm text-muted-foreground"
                        title={
                          sortOrder === "desc"
                            ? "Сначала старые"
                            : "Сначала новые"
                        }
                      >
                        {sortOrder === "desc" ? (
                          <SortDesc className="w-4 h-4" />
                        ) : (
                          <SortAsc className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Дата</span>
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {showFilters && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 rounded-xl border border-border bg-card/50 space-y-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                              Спикер
                            </label>
                            <input
                              type="text"
                              value={filterSpeaker}
                              onChange={(e) => setFilterSpeaker(e.target.value)}
                              placeholder="Например: Судья, Иванов..."
                              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                              Номер дела
                            </label>
                            <input
                              type="text"
                              value={filterCaseNumber}
                              onChange={(e) =>
                                setFilterCaseNumber(e.target.value)
                              }
                              placeholder="А40-12345/2024"
                              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
                            />
                          </div>
                          {allTags.length > 0 && (
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                Теги
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {allTags.map((tag) => {
                                  const active = filterTagIds.includes(tag.id);
                                  return (
                                    <button
                                      key={tag.id}
                                      onClick={() =>
                                        setFilterTagIds((prev) =>
                                          active
                                            ? prev.filter((id) => id !== tag.id)
                                            : [...prev, tag.id],
                                        )
                                      }
                                      className={cn(
                                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all",
                                        active
                                          ? "ring-2 ring-offset-1 ring-offset-background"
                                          : "opacity-60 hover:opacity-100",
                                      )}
                                      style={{
                                        backgroundColor: `${tag.color}20`,
                                        color: tag.color,
                                        borderColor: `${tag.color}50`,
                                      }}
                                    >
                                      {tag.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {activeQueueItems.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Обрабатываются сейчас
                      </p>
                      {activeQueueItems.map((item) => (
                        <div
                          key={item.id}
                          className="w-full text-left p-4 rounded-xl bg-card border border-gold/30 flex items-center gap-4 animate-pulse"
                        >
                          <Loader2 className="w-5 h-5 text-gold animate-spin flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate text-sm sm:text-base">
                              {item.file.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.statusMessage}
                            </p>
                            {item.uploadProgress > 0 &&
                              item.uploadProgress < 100 && (
                                <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gold rounded-full transition-all duration-300"
                                    style={{ width: `${item.uploadProgress}%` }}
                                  />
                                </div>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {filteredRecords.length >= 2 && (
                    <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border bg-card/50">
                      {!selectionMode ? (
                        <>
                          <button
                            onClick={() => setSelectionMode(true)}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <CheckSquare className="w-4 h-4" />
                            Выбрать для объединения
                          </button>
                          {selectedFolderId &&
                            selectedFolderId !== "all" &&
                            filteredRecords.length >= 2 && (
                              <button
                                onClick={() =>
                                  openMergeDialog(
                                    filteredRecords.map((r) => r.id),
                                  )
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-primary-foreground hover:bg-navy-light transition-colors text-sm font-medium"
                              >
                                <Combine className="w-4 h-4" />
                                Объединить все в папке
                              </button>
                            )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">
                              Выбрано:{" "}
                              <strong className="text-foreground">
                                {selectedForMerge.size}
                              </strong>
                            </span>
                            <button
                              onClick={() =>
                                setSelectedForMerge(
                                  new Set(filteredRecords.map((r) => r.id)),
                                )
                              }
                              className="text-xs text-muted-foreground hover:text-foreground underline"
                            >
                              Все
                            </button>
                            <button
                              onClick={() => setSelectedForMerge(new Set())}
                              className="text-xs text-muted-foreground hover:text-foreground underline"
                            >
                              Сбросить
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={exitSelectionMode}
                              className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                            >
                              Отмена
                            </button>
                            <button
                              onClick={() =>
                                openMergeDialog(Array.from(selectedForMerge))
                              }
                              disabled={selectedForMerge.size < 2}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-primary-foreground hover:bg-navy-light transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Combine className="w-4 h-4" />
                              Объединить ({selectedForMerge.size})
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {filteredRecords.length === 0 &&
                  activeQueueItems.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      Ничего не найдено
                    </div>
                  ) : (
                    filteredRecords.length > 0 && (
                      <div className="space-y-2">
                        <AnimatePresence>
                          {filteredRecords.map((record, i) => {
                            const recordTags =
                              tagsByTranscription.get(record.id) || [];
                            const searchHit = searchResults?.get(record.id);
                            const recordFolder = folders.find(
                              (f) => f.id === record.folder_id,
                            );
                            const isSelectedForMerge = selectedForMerge.has(
                              record.id,
                            );
                            return (
                              <motion.div
                                key={record.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className={`w-full p-4 rounded-xl bg-card border transition-all ${
                                  selectionMode && isSelectedForMerge
                                    ? "border-gold/60 ring-1 ring-gold/30"
                                    : "border-border hover:border-gold/30"
                                }`}
                              >
                                <div className="flex items-start gap-4">
                                  {selectionMode && (
                                    <div className="pt-1">
                                      <Checkbox
                                        checked={isSelectedForMerge}
                                        onCheckedChange={() =>
                                          toggleSelectForMerge(record.id)
                                        }
                                      />
                                    </div>
                                  )}
                                  <button
                                    onClick={() =>
                                      selectionMode
                                        ? toggleSelectForMerge(record.id)
                                        : handleSelect(record)
                                    }
                                    className="flex-1 min-w-0 text-left"
                                  >
                                    <p className="font-medium text-foreground truncate text-sm sm:text-base">
                                      {record.file_name}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDuration(record.duration)}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {record.speaker_count} спик.
                                      </span>
                                      <span className="hidden sm:inline">
                                        {record.segment_count} фрагм.
                                      </span>
                                      <span>
                                        {new Date(
                                          record.created_at,
                                        ).toLocaleDateString("ru-RU")}
                                      </span>
                                      {recordFolder && (
                                        <span
                                          className="flex items-center gap-1"
                                          style={{ color: recordFolder.color }}
                                        >
                                          <FolderIcon className="w-3 h-3" />
                                          {recordFolder.name}
                                        </span>
                                      )}
                                      {searchHit &&
                                        searchHit.match_count > 0 && (
                                          <span className="px-1.5 py-0.5 rounded bg-gold/20 text-gold font-medium">
                                            {searchHit.match_count} совп.
                                          </span>
                                        )}
                                    </div>
                                    {searchHit?.first_snippet &&
                                      searchQuery.trim() && (
                                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2 italic">
                                          «{searchHit.first_snippet}»
                                        </p>
                                      )}
                                    {recordTags.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {recordTags.map((tag) => (
                                          <span
                                            key={tag.id}
                                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
                                            style={{
                                              backgroundColor: `${tag.color}20`,
                                              color: tag.color,
                                              borderColor: `${tag.color}50`,
                                            }}
                                          >
                                            {tag.name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </button>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <TooltipProvider delayDuration={200}>
                                      <Popover>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <PopoverTrigger asChild>
                                              <button
                                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                                aria-label="Переместить в папку"
                                              >
                                                <FolderInput className="w-4 h-4" />
                                              </button>
                                            </PopoverTrigger>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            Переместить в папку
                                          </TooltipContent>
                                        </Tooltip>
                                        <PopoverContent
                                          className="w-56 p-1"
                                          align="end"
                                        >
                                          <button
                                            onClick={() =>
                                              handleMoveToFolder(
                                                record.id,
                                                null,
                                              )
                                            }
                                            className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center gap-2 text-muted-foreground"
                                          >
                                            <X className="w-3.5 h-3.5" /> Без
                                            папки
                                          </button>
                                          {folders.length === 0 && (
                                            <p className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                                              Папок ещё нет
                                            </p>
                                          )}
                                          {folders.map((f) => (
                                            <button
                                              key={f.id}
                                              onClick={() =>
                                                handleMoveToFolder(
                                                  record.id,
                                                  f.id,
                                                )
                                              }
                                              className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center gap-2"
                                            >
                                              <FolderIcon
                                                className="w-3.5 h-3.5"
                                                style={{ color: f.color }}
                                              />
                                              <span className="truncate">
                                                {f.name}
                                              </span>
                                            </button>
                                          ))}
                                        </PopoverContent>
                                      </Popover>

                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <TagManager
                                              allTags={allTags}
                                              selectedTags={recordTags}
                                              onAdd={(tag) =>
                                                handleAddTag(record.id, tag)
                                              }
                                              onRemove={(tagId) =>
                                                handleRemoveTag(
                                                  record.id,
                                                  tagId,
                                                )
                                              }
                                              onCreateTag={handleCreateTag}
                                              compact
                                            />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          Добавить или убрать тег
                                        </TooltipContent>
                                      </Tooltip>

                                      {record.audio_path && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                const url = await getAudioUrl(
                                                  record.audio_path!,
                                                );
                                                if (url) {
                                                  const a =
                                                    document.createElement("a");
                                                  a.href = url;
                                                  a.download = record.file_name;
                                                  a.click();
                                                } else {
                                                  toast({
                                                    title: "Ошибка",
                                                    description:
                                                      "Не удалось получить ссылку на аудио",
                                                    variant: "destructive",
                                                  });
                                                }
                                              }}
                                              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                              aria-label="Скачать аудио"
                                            >
                                              <Download className="w-4 h-4" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            Скачать исходное аудио
                                          </TooltipContent>
                                        </Tooltip>
                                      )}

                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            onClick={(e) =>
                                              handleDelete(record.id, e)
                                            }
                                            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                            aria-label="Удалить расшифровку"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          Удалить расшифровку
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <MergeTranscriptionsDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        sources={mergeSources}
        onConfirm={handleMergeConfirm}
      />

      <AnimatePresence>
        {showScrollTop && selectedId && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gold text-navy shadow-lg hover:shadow-xl hover:bg-gold/90 transition-all flex items-center justify-center"
            title="Вернуться в начало"
            aria-label="Вернуться в начало расшифровки"
          >
            <ChevronUp className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default History;
