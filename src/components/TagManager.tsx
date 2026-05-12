import { useState } from "react";
import { Tag as TagIcon, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Tag } from "@/lib/foldersTagsStorage";

interface TagManagerProps {
  allTags: Tag[];
  selectedTags: Tag[];
  onAdd: (tag: Tag) => Promise<void>;
  onRemove: (tagId: string) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag | null>;
  compact?: boolean;
}

export const TagManager = ({ allTags, selectedTags, onAdd, onRemove, onCreateTag, compact }: TagManagerProps) => {
  const [newTag, setNewTag] = useState("");
  const selectedIds = new Set(selectedTags.map((t) => t.id));
  const available = allTags.filter((t) => !selectedIds.has(t.id));

  const handleCreate = async () => {
    const name = newTag.trim();
    if (!name) return;
    const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selectedIds.has(existing.id)) await onAdd(existing);
    } else {
      const created = await onCreateTag(name);
      if (created) await onAdd(created);
    }
    setNewTag("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
          style={{
            backgroundColor: `${tag.color}20`,
            color: tag.color,
            borderColor: `${tag.color}50`,
          }}
        >
          {tag.name}
          <button onClick={() => onRemove(tag.id)} className="hover:opacity-70" aria-label="Удалить тег">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <TagIcon className="w-3 h-3" />
            {compact ? "" : "Тег"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1 mb-2">
            <input
              autoFocus
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder="Новый тег..."
              className="flex-1 px-2 py-1 rounded bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
            <button onClick={handleCreate} className="p-1 rounded hover:bg-muted text-muted-foreground">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {available.length > 0 ? (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {available.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => onAdd(tag)}
                  className="w-full text-left px-2 py-1 rounded hover:bg-muted text-xs flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">Нет доступных тегов</p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};
