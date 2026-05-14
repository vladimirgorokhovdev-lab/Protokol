import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageSquare, Filter, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUnreadFeedback } from "@/hooks/useUnreadFeedback";

const categoryLabels: Record<string, string> = {
  bug: "🐛 Ошибка",
  feature: "💡 Предложение",
  ux: "🎨 Удобство",
  general: "💬 Общее",
};

const categoryColors: Record<string, string> = {
  bug: "bg-destructive/10 text-destructive border-destructive/20",
  feature: "bg-accent/10 text-accent-foreground border-accent/20",
  ux: "bg-primary/10 text-primary border-primary/20",
  general: "bg-muted text-muted-foreground border-border",
};

interface FeedbackItem {
  id: string;
  user_id: string;
  category: string;
  message: string;
  page_url: string | null;
  created_at: string;
  user_email: string | null;
}

const Feedback = () => {
  const { user } = useAuth();
  const { markRead } = useUnreadFeedback();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    markRead();
    supabase.rpc("get_auth_user_count").then(({ data }) => {
      if (data !== null) setUserCount(data as number);
    });
  }, [markRead]);

  useEffect(() => {
    if (!user) return;
    const fetchFeedback = async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_feedback_with_email", {
        p_filter: filter,
      });
      setItems((data as any as FeedbackItem[]) || []);
      setLoading(false);
    };
    fetchFeedback();
  }, [user, filter]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("feedback" as any).delete().eq("id", id);
    if (!error) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Войдите для просмотра отзывов</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 relative">
        <div className="container max-w-3xl mx-auto flex items-center justify-between py-4 px-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Назад</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <MobileNav showHome={false} />
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold font-playfair text-foreground flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              Отзывы пользователей
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {items.length} отзыв(ов){userCount !== null && ` · 👥 ${userCount} пользовател${userCount === 1 ? 'ь' : 'ей'}`}
            </p>
          </div>

          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              <SelectItem value="bug">🐛 Ошибки</SelectItem>
              <SelectItem value="feature">💡 Предложения</SelectItem>
              <SelectItem value="ux">🎨 Удобство</SelectItem>
              <SelectItem value="general">💬 Общее</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Пока нет отзывов</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={categoryColors[item.category] || categoryColors.general}>
                        {categoryLabels[item.category] || item.category}
                      </Badge>
                      {item.page_url && (
                        <span className="text-xs text-muted-foreground">{item.page_url}</span>
                      )}
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{item.message}</p>
                    {item.user_email && (
                      <p className="text-xs text-muted-foreground mt-2">👤 {item.user_email}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded hover:bg-destructive/10 transition-colors"
                      title="Удалить отзыв"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Feedback;
