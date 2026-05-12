import { useState, useEffect, useCallback } from "react";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";

interface TranscriptionSearchProps {
  segments: { text: string; id?: string }[];
  onHighlight: (matches: Map<number, number[][]>) => void;
  onActiveMatch: (segmentIndex: number) => void;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TranscriptionSearch = ({
  segments,
  onHighlight,
  onActiveMatch,
  externalOpen,
  onOpenChange,
}: TranscriptionSearchProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [matchIndices, setMatchIndices] = useState<
    { segIdx: number; pos: number }[]
  >([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (externalOpen && !isOpen) {
      setIsOpen(true);
      onOpenChange?.(true);
    }
  }, [externalOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape" && isOpen) {
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    onHighlight(new Map());
    setMatchIndices([]);
    onOpenChange?.(false);
  }, [onHighlight, onOpenChange]);

  useEffect(() => {
    if (!query.trim()) {
      onHighlight(new Map());
      setMatchIndices([]);
      return;
    }
    const q = query.toLowerCase();
    const matches = new Map<number, number[][]>();
    const indices: { segIdx: number; pos: number }[] = [];

    segments.forEach((seg, segIdx) => {
      const text = seg.text.toLowerCase();
      const segMatches: number[][] = [];
      let pos = 0;
      while ((pos = text.indexOf(q, pos)) !== -1) {
        segMatches.push([pos, pos + q.length]);
        indices.push({ segIdx, pos });
        pos += 1;
      }
      if (segMatches.length > 0) {
        matches.set(segIdx, segMatches);
      }
    });

    onHighlight(matches);
    setMatchIndices(indices);
    setActiveIdx(0);
    if (indices.length > 0) {
      onActiveMatch(indices[0].segIdx);
    }
  }, [query, segments, onHighlight, onActiveMatch]);

  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (matchIndices.length === 0) return;
      const next =
        (activeIdx + dir + matchIndices.length) % matchIndices.length;
      setActiveIdx(next);
      onActiveMatch(matchIndices[next].segIdx);
    },
    [activeIdx, matchIndices, onActiveMatch],
  );

  if (!isOpen) return null;

  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border mb-4">
      <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigate(e.shiftKey ? -1 : 1);
          if (e.key === "Escape") close();
        }}
        placeholder="Поиск в тексте..."
        className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      {query && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {matchIndices.length > 0
            ? `${activeIdx + 1} / ${matchIndices.length}`
            : "0 / 0"}
        </span>
      )}
      <button
        onClick={() => navigate(-1)}
        className="p-1 rounded hover:bg-muted transition-colors"
        disabled={matchIndices.length === 0}
      >
        <ChevronUp className="w-4 h-4 text-muted-foreground" />
      </button>
      <button
        onClick={() => navigate(1)}
        className="p-1 rounded hover:bg-muted transition-colors"
        disabled={matchIndices.length === 0}
      >
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>
      <button
        onClick={close}
        className="p-1 rounded hover:bg-muted transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
};

export default TranscriptionSearch;
