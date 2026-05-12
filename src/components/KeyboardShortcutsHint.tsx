import { useState, useEffect } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const shortcuts = [
  { keys: ["Ctrl", "O"], description: "Открыть файл" },
  { keys: ["Ctrl", "R"], description: "Записать / остановить запись" },
  { keys: ["Esc"], description: "Закрыть диктофон" },
  { keys: ["Space"], description: "Пауза / воспроизведение" },
  { keys: ["←"], description: "Перемотка назад" },
  { keys: ["→"], description: "Перемотка вперёд" },
  {
    keys: ["Ctrl", "Space"],
    description: "Пауза при редактировании фрагмента",
  },
];

export function KeyboardShortcutsHint() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-9 w-9 text-muted-foreground hover:text-foreground"
        title="Горячие клавиши"
      >
        <Keyboard className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[340px] p-5">
          <DialogHeader>
            <DialogTitle className="font-serif">Горячие клавиши</DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5 mt-2">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {s.description}
                </span>
                <div className="flex items-center gap-1">
                  {s.keys.map((key) => (
                    <kbd
                      key={key}
                      className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md bg-muted border border-border text-[11px] font-mono text-foreground"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-4 text-center">
            На Mac используйте ⌘ вместо Ctrl
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
