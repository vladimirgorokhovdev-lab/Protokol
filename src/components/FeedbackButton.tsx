import { forwardRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquarePlus, Send, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const categories = [
  { value: "bug", label: "🐛 Ошибка" },
  { value: "feature", label: "💡 Предложение" },
  { value: "ux", label: "🎨 Удобство" },
  { value: "general", label: "💬 Общее" },
];

const FeedbackButton = forwardRef<HTMLDivElement>((_, ref) => {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const isHistoryPage = location.pathname === "/history";

  if (!user) return null;

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    const { error } = await supabase.from("feedback" as any).insert({
      user_id: user.id,
      category,
      message: message.trim().slice(0, 2000),
      page_url: window.location.pathname,
    } as any);

    setSending(false);
    if (error) {
      toast.error("Не удалось отправить отзыв");
      return;
    }
    setSent(true);
    setTimeout(() => {
      setOpen(false);
      setSent(false);
      setMessage("");
      setCategory("general");
    }, 1500);
  };

  return (
    <div ref={ref}>
      <button
        onClick={() => setOpen(true)}
        className={`fixed ${isHistoryPage ? "bottom-20" : "bottom-5"} right-5 z-50 bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:scale-105 transition-transform`}
        title="Оставить отзыв"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold font-playfair text-foreground">
                Обратная связь
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {sent ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <Check className="w-10 h-10 text-green-500" />
                <p className="text-foreground font-medium">Спасибо за отзыв!</p>
              </div>
            ) : (
              <>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Textarea
                  placeholder="Опишите замечание или предложение..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="resize-none"
                />

                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {message.length}/2000
                  </span>
                  <Button
                    onClick={handleSubmit}
                    disabled={!message.trim() || sending}
                    className="gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? "Отправка..." : "Отправить"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

FeedbackButton.displayName = "FeedbackButton";

export default FeedbackButton;
