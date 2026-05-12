import { useEffect, useState, useCallback } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovalStatus } from "@/hooks/useApprovalStatus";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Mail, CheckCheck, MailOpen, ArrowLeft, Home, Reply, Copy } from "lucide-react";

interface ContactMessage {
  id: string;
  created_at: string;
  name: string;
  email: string;
  message: string;
  read_at: string | null;
  user_id: string | null;
}

const AdminContact = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, status, adminLoading } = useApprovalStatus();
  const [filter, setFilter] = useState<"unread" | "all">("unread");
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
    if (filter === "unread") q = q.is("read_at", null);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setMessages((data as ContactMessage[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (authLoading || status === "loading" || adminLoading) {
    return <div className="min-h-screen flex items-center justify-center">Загрузка…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("contact_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Помечено как прочитанное");
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read_at: new Date().toISOString() } : m)));
    }
  };

  const markUnread = async (id: string) => {
    const { error } = await supabase
      .from("contact_messages")
      .update({ read_at: null })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read_at: null } : m)));
    }
  };

  const markAllRead = async () => {
    const ids = messages.filter((m) => !m.read_at).map((m) => m.id);
    if (!ids.length) return;
    const { error } = await supabase
      .from("contact_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    if (error) toast.error(error.message);
    else {
      toast.success(`Помечено как прочитано: ${ids.length}`);
      load();
    }
  };

  const unreadCount = messages.filter((m) => !m.read_at).length;

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Назад
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/"><Home className="w-4 h-4 mr-1" /> Домой</Link>
        </Button>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Сообщения с формы «Написать нам»</h1>
          <p className="text-muted-foreground">
            Входящие обращения пользователей{unreadCount > 0 && ` · непрочитанных: ${unreadCount}`}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4 mr-2" /> Прочитать все
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Обновить
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="unread">Новые</TabsTrigger>
          <TabsTrigger value="all">Все</TabsTrigger>
        </TabsList>
      </Tabs>

      {messages.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          {loading ? "Загрузка…" : "Нет сообщений"}
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => {
            const isUnread = !m.read_at;
            const subject = `Re: Ваше обращение в LexScribe`;
            const quoted = m.message
              .split("\n")
              .map((l) => `> ${l}`)
              .join("\n");
            const body = `Здравствуйте, ${m.name}!\n\nСпасибо за ваше обращение.\n\n\n\n---\n${new Date(m.created_at).toLocaleString("ru-RU")}, вы писали:\n${quoted}`;
            const mailto = `mailto:${m.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(m.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            const copyEmail = async () => {
              try {
                await navigator.clipboard.writeText(m.email);
                toast.success("Email скопирован");
              } catch {
                toast.error("Не удалось скопировать");
              }
            };
            const handleReply = () => {
              if (!isUnread) return;
              markRead(m.id);
            };
            return (
              <Card key={m.id} className={`p-4 space-y-3 ${isUnread ? "border-primary/40 bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{m.name}</span>
                      <a href={`mailto:${m.email}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {m.email}
                      </a>
                      <button
                        onClick={copyEmail}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Скопировать email"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {isUnread && <Badge variant="default">Новое</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(m.created_at).toLocaleString("ru-RU")}
                    </div>
                  </div>
                  {isUnread ? (
                    <Button size="sm" variant="outline" onClick={() => markRead(m.id)}>
                      <CheckCheck className="w-4 h-4 mr-1" /> Прочитано
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => markUnread(m.id)}>
                      <MailOpen className="w-4 h-4 mr-1" /> В непрочитанные
                    </Button>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap text-foreground border-l-2 border-muted pl-3">
                  {m.message}
                </div>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <Button size="sm" asChild onClick={handleReply}>
                    <a href={mailto}>
                      <Reply className="w-4 h-4 mr-1" /> Ответить
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" asChild onClick={handleReply}>
                    <a href={gmail} target="_blank" rel="noopener noreferrer">
                      <Mail className="w-4 h-4 mr-1" /> Ответить через Gmail
                    </a>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminContact;
