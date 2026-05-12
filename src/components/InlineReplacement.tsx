import { useState, useRef } from "react";
import { Check, X } from "lucide-react";
import type { ReplacementMatch } from "@/components/ReplacementConfirm";

interface InlineReplacementProps {
  text: string;
  matches: ReplacementMatch[];
  onAccept: (match: ReplacementMatch) => void;
  onDismiss: (match: ReplacementMatch) => void;
  searchHighlights?: number[][];
}

export function InlineReplacementText({
  text,
  matches,
  onAccept,
  onDismiss,
  searchHighlights,
}: InlineReplacementProps) {
  const sorted = [...matches].sort((a, b) => a.startPos - b.startPos);

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of sorted) {
    if (match.startPos > cursor) {
      parts.push(
        <NormalText
          key={`t-${cursor}`}
          text={text.slice(cursor, match.startPos)}
        />,
      );
    }
    parts.push(
      <ReplacementWord
        key={`r-${match.startPos}`}
        word={text.slice(match.startPos, match.startPos + match.find.length)}
        replacement={match.replace}
        onAccept={() => onAccept(match)}
        onDismiss={() => onDismiss(match)}
      />,
    );
    cursor = match.startPos + match.find.length;
  }

  if (cursor < text.length) {
    parts.push(<NormalText key={`t-${cursor}`} text={text.slice(cursor)} />);
  }

  return <>{parts}</>;
}

function NormalText({ text }: { text: string }) {
  return <>{text}</>;
}

function ReplacementWord({
  word,
  replacement,
  onAccept,
  onDismiss,
}: {
  word: string;
  replacement: string;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <span className="relative inline">
      <span
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="decoration-wavy decoration-destructive/60 underline underline-offset-4 cursor-pointer hover:bg-destructive/10 rounded px-0.5 transition-colors"
        title={`Предложение: ${replacement}`}
      >
        {word}
      </span>
      {open && (
        <span
          className="absolute left-0 top-full mt-1 z-50 flex items-center gap-1 bg-popover border border-border rounded-lg shadow-lg px-2 py-1.5 whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-muted-foreground line-through mr-1">
            {word}
          </span>
          <span className="text-xs font-medium text-foreground mr-2">
            {replacement}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAccept();
              setOpen(false);
            }}
            className="p-0.5 rounded hover:bg-green-500/20 transition-colors"
            title="Заменить"
          >
            <Check className="w-3.5 h-3.5 text-green-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
              setOpen(false);
            }}
            className="p-0.5 rounded hover:bg-destructive/20 transition-colors"
            title="Пропустить"
          >
            <X className="w-3.5 h-3.5 text-destructive" />
          </button>
        </span>
      )}
    </span>
  );
}
