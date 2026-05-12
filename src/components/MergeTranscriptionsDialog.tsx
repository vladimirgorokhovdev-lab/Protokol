import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, Loader2 } from "lucide-react";

export interface MergeSourceItem {
  id: string;
  file_name: string;
  duration: number;
  created_at: string;
}

interface MergeTranscriptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: MergeSourceItem[];
  defaultName?: string;
  onConfirm: (
    orderedIds: string[],
    newName: string,
    deleteSources: boolean,
  ) => Promise<void>;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export function MergeTranscriptionsDialog({
  open,
  onOpenChange,
  sources,
  defaultName,
  onConfirm,
}: MergeTranscriptionsDialogProps) {
  const [name, setName] = useState("");
  const [deleteSources, setDeleteSources] = useState(false);
  const [orderedItems, setOrderedItems] = useState<MergeSourceItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      const sorted = [...sources].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      setOrderedItems(sorted);
      setName(
        defaultName || `Объединённая расшифровка (${sorted.length} файлов)`,
      );
      setDeleteSources(false);
    }
  }, [open, sources, defaultName]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= orderedItems.length) return;
    const next = [...orderedItems];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrderedItems(next);
  };

  const handleDragStart = (i: number) => setDragIndex(i);
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i) return;
    move(dragIndex, i);
    setDragIndex(i);
  };
  const handleDragEnd = () => setDragIndex(null);

  const handleConfirm = async () => {
    if (!name.trim() || orderedItems.length < 2) return;
    setSubmitting(true);
    try {
      await onConfirm(
        orderedItems.map((i) => i.id),
        name.trim(),
        deleteSources,
      );
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Объединить расшифровки
          </DialogTitle>
          <DialogDescription>
            Расшифровки будут склеены по порядку. Спикеры с одинаковыми именами
            будут объединены автоматически.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="merge-name">Название</Label>
            <Input
              id="merge-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название объединённой расшифровки"
            />
          </div>

          <div className="space-y-2">
            <Label>Порядок ({orderedItems.length})</Label>
            <p className="text-xs text-muted-foreground">
              Перетащите, чтобы изменить порядок.
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {orderedItems.map((item, i) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-move transition-colors ${
                    dragIndex === i ? "opacity-50" : ""
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground w-5 flex-shrink-0">
                    {i + 1}.
                  </span>
                  <span className="text-sm truncate flex-1">
                    {item.file_name}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDuration(item.duration)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={deleteSources}
              onCheckedChange={(v) => setDeleteSources(v === true)}
            />
            <span className="text-sm">
              Удалить исходные расшифровки после объединения
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Отмена
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || !name.trim() || orderedItems.length < 2}
            className="bg-navy hover:bg-navy-light text-primary-foreground"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Объединить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
