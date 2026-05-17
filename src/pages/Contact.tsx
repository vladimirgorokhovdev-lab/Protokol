import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "@/lib/siteContact";

const Contact = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Заполните все поля");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("contact_messages").insert({
      user_id: user?.id ?? null,
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error("Не удалось отправить сообщение. Попробуйте ещё раз.");
      return;
    }
    setSent(true);
    setMessage("");
    toast.success("Сообщение отправлено!");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <MobileNav />
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground mb-3">
            Написать нам
          </h1>
          <p className="text-muted-foreground">
            Опишите ваш вопрос — мы ответим на указанный email.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL_MAILTO}`}
            className="inline-flex items-center gap-1.5 mt-3 text-sm text-accent hover:underline"
          >
            <Mail className="w-4 h-4" />
            {SUPPORT_EMAIL}
          </a>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-accent mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Сообщение отправлено
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Спасибо! Мы свяжемся с вами в ближайшее время.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" onClick={() => setSent(false)}>
                Отправить ещё одно
              </Button>
              <Button asChild>
                <Link to="/">На главную</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-border bg-card p-6 space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="contact-name">Имя</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как к вам обращаться"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email для ответа</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">Сообщение</Label>
              <Textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Опишите ваш вопрос…"
                rows={6}
                required
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button type="submit" disabled={submitting} className="gap-2">
                <Send className="w-4 h-4" />
                {submitting ? "Отправка…" : "Отправить"}
              </Button>
              <Button asChild variant="outline">
                <Link to="/">На главную</Link>
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};

export default Contact;
