import { useState } from "react";
import { Folder as FolderIcon, FolderPlus, Inbox, MoreVertical, Pencil, Trash2, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Folder } from "@/lib/foldersTagsStorage";

interface FolderSidebarProps {
  folders: Folder[];
  selectedFolderId: string | null | "all";
  onSelect: (folderId: string | null | "all") => void;
  onCreate: (name: string, caseNumber: string) => Promise<void>;
  onUpdate: (id: string, name: string, caseNumber: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  counts?: Record<string, number>;
  totalCount: number;
  unfiledCount: number;
}

export const FolderSidebar = ({
  folders,
  selectedFolderId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  counts = {},
  totalCount,
  unfiledCount,
}: FolderSidebarProps) => {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCase, setNewCase] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCase, setEditCase] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreate(newName.trim(), newCase.trim());
    setNewName("");
    setNewCase("");
    setCreating(false);
  };

  const startEdit = (f: Folder) => {
    setEditingId(f.id);
    setEditName(f.name);
    setEditCase(f.case_number || "");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await onUpdate(editingId, editName.trim(), editCase.trim());
    setEditingId(null);
  };

  const baseBtn = "w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors";

  return (
    <aside className="w-full lg:w-60 flex-shrink-0 space-y-1">
      <div className="flex items-center justify-between px-2 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Папки</h3>
        <button
          onClick={() => setCreating(true)}
          className="p-1 rounded hover:bg-muted transition-colors"
          title="Новая папка"
        >
          <FolderPlus className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <button
        onClick={() => onSelect("all")}
        className={cn(baseBtn, selectedFolderId === "all" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted/50")}
      >
        <Inbox className="w-4 h-4" />
        <span className="flex-1">Все</span>
        <span className="text-xs">{totalCount}</span>
      </button>

      <button
        onClick={() => onSelect(null)}
        className={cn(baseBtn, selectedFolderId === null ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted/50")}
      >
        <FolderIcon className="w-4 h-4 opacity-50" />
        <span className="flex-1">Без папки</span>
        <span className="text-xs">{unfiledCount}</span>
      </button>

      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-2 rounded-lg bg-muted/30 border border-border space-y-2"
          >
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Название дела"
              className="w-full px-2 py-1.5 rounded bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
            <input
              type="text"
              value={newCase}
              onChange={(e) => setNewCase(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Номер дела (необязательно)"
              className="w-full px-2 py-1.5 rounded bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
            <div className="flex gap-1">
              <button onClick={handleCreate} className="flex-1 py-1 rounded bg-navy text-primary-foreground text-xs hover:bg-navy-light">
                Создать
              </button>
              <button onClick={() => setCreating(false)} className="px-2 py-1 rounded hover:bg-muted text-muted-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {folders.map((f) => (
        <div key={f.id}>
          {editingId === f.id ? (
            <div className="p-2 rounded-lg bg-muted/30 border border-border space-y-2">
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                className="w-full px-2 py-1.5 rounded bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
              />
              <input
                type="text"
                value={editCase}
                onChange={(e) => setEditCase(e.target.value)}
                placeholder="Номер дела"
                className="w-full px-2 py-1.5 rounded bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
              />
              <div className="flex gap-1">
                <button onClick={saveEdit} className="flex-1 py-1 rounded bg-navy text-primary-foreground text-xs hover:bg-navy-light flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" /> Сохранить
                </button>
                <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded hover:bg-muted text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="group relative flex items-center">
              <button
                onClick={() => onSelect(f.id)}
                className={cn(
                  baseBtn,
                  "pr-8",
                  selectedFolderId === f.id ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                <FolderIcon className="w-4 h-4 flex-shrink-0" style={{ color: f.color }} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{f.name}</div>
                  {f.case_number && <div className="text-[10px] opacity-70 truncate">№ {f.case_number}</div>}
                </div>
                <span className="text-xs flex-shrink-0">{counts[f.id] || 0}</span>
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-background transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-1" align="end">
                  <button
                    onClick={() => startEdit(f)}
                    className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Переименовать
                  </button>
                  <button
                    onClick={() => onDelete(f.id)}
                    className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-destructive/10 text-destructive flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Удалить
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      ))}
    </aside>
  );
};
