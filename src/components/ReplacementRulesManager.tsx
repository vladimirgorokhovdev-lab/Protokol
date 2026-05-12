import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Trash2,
  ArrowRight,
  Settings2,
  GripHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface Rule {
  id: string;
  find_text: string;
  replace_text: string;
}

interface ReplacementRulesManagerProps {
  onRuleAdded?: (rule: { find_text: string; replace_text: string }) => void;
}

export function ReplacementRulesManager({
  onRuleAdded,
}: ReplacementRulesManagerProps = {}) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const rect = (
      e.currentTarget.parentElement as HTMLElement
    ).getBoundingClientRect();
    const startPos = pos ?? {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: startPos.x,
      origY: startPos.y,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    if (open && user) loadRules();
  }, [open, user]);

  const loadRules = async () => {
    const { data, error } = await supabase
      .from("replacement_rules")
      .select("id, find_text, replace_text")
      .order("created_at", { ascending: true });
    if (!error && data) setRules(data);
  };

  const addRule = async () => {
    if (!findText.trim() || !replaceText.trim() || !user) return;
    setLoading(true);
    const find_text = findText.trim();
    const replace_text = replaceText.trim();
    const { error } = await supabase.from("replacement_rules").insert({
      user_id: user.id,
      find_text,
      replace_text,
    });
    if (error) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setFindText("");
      setReplaceText("");
      await loadRules();
      onRuleAdded?.({ find_text, replace_text });
    }
    setLoading(false);
  };

  const deleteRule = async (id: string) => {
    await supabase.from("replacement_rules").delete().eq("id", id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  if (!user) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-9 w-9 text-muted-foreground hover:text-foreground"
        title="Правила автозамены"
      >
        <Settings2 className="h-4 w-4" />
      </Button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
                onClick={() => setOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15 }}
                style={
                  pos
                    ? {
                        top: pos.y,
                        left: pos.x,
                        transform: "translate(-50%, -50%)",
                      }
                    : undefined
                }
                className={`fixed z-[101] w-[420px] max-h-[80vh] rounded-xl bg-card border border-border shadow-xl flex flex-col ${
                  pos
                    ? ""
                    : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                }`}
              >
                <div
                  onMouseDown={handleDragStart}
                  className="flex items-center justify-between p-5 pb-3 border-b border-border cursor-move select-none"
                >
                  <div className="flex items-center gap-2">
                    <GripHorizontal className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-serif font-semibold text-foreground">
                      Правила автозамены
                    </h3>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="p-5 pt-3 flex-1 overflow-y-auto">
                  <p className="text-xs text-muted-foreground mb-4">
                    После расшифровки система найдёт совпадения и предложит
                    заменить с подтверждением.
                  </p>

                  <div className="flex items-center gap-2 mb-4">
                    <Input
                      placeholder="Найти"
                      value={findText}
                      onChange={(e) => setFindText(e.target.value)}
                      className="text-sm h-8"
                      onKeyDown={(e) => e.key === "Enter" && addRule()}
                    />
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="Заменить на"
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      className="text-sm h-8"
                      onKeyDown={(e) => e.key === "Enter" && addRule()}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={addRule}
                      disabled={loading}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {rules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Нет правил
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 group"
                        >
                          <span className="text-sm text-foreground truncate">
                            {rule.find_text}
                          </span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm text-foreground truncate font-medium">
                            {rule.replace_text}
                          </span>
                          <button
                            onClick={() => deleteRule(rule.id)}
                            className="ml-auto p-1 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
