import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isEmailConfirmed } from "@/lib/authEmail";
import { toast } from "sonner";

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  if (!user || isEmailConfirmed(user)) return null;

  const email = user.email ?? "";

  const handleResend = async () => {
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });
    setSending(false);
    if (error) {
      toast.error("Не удалось отправить письмо", { description: error.message });
      return;
    }
    toast.success("Письмо отправлено", {
      description: `Проверьте почту ${email} и перейдите по ссылке.`,
    });
  };

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10">
        <div className="container max-w-5xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Mail className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-sm"><p className="font-medium text-foreground">Подтвердите email, чтобы начать расшифровку</p><p className="text-muted-foreground text-xs mt-0.5">Письмо отправлено на {email}. Проверьте «Входящие» и «Спам».</p></div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleResend}
          disabled={sending}
          className="shrink-0"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Отправить снова"
          )}
        </Button>
      </div>
    </div>
  );
}
