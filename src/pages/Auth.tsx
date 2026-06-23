import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Scale, Mail, Lock, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isEmailConfirmed } from "@/lib/authEmail";
import { EmailOtpForm } from "@/components/EmailOtpForm";

const PENDING_CONFIRM_KEY = "pending_confirm_email";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState<string | null>(
    null,
  );
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const openConfirmScreen = (addr: string) => {
    setEmail(addr);
    setPendingConfirmEmail(addr);
    sessionStorage.setItem(PENDING_CONFIRM_KEY, addr);
  };

  const closeConfirmScreen = () => {
    setPendingConfirmEmail(null);
    sessionStorage.removeItem(PENDING_CONFIRM_KEY);
  };

  useEffect(() => {
    const confirmEmail = searchParams.get("confirm_email");
    if (confirmEmail) {
      openConfirmScreen(confirmEmail);
      return;
    }
    const stored = sessionStorage.getItem(PENDING_CONFIRM_KEY);
    if (stored) openConfirmScreen(stored);
  }, [searchParams]);

  useEffect(() => {
    if (user && isEmailConfirmed(user)) {
      closeConfirmScreen();
      navigate("/", { replace: true });
      return;
    }
    if (user?.email && !isEmailConfirmed(user)) {
      openConfirmScreen(user.email);
    }
  }, [user, navigate]);

  const handleResendConfirm = async () => {
    const addr = pendingConfirmEmail ?? email;
    if (!addr) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      toast({
        title: "Не удалось отправить",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Письмо отправлено снова",
      description: `Код и ссылка — на ${addr}`,
    });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLogin && !consent) {
      toast({
        title: "Необходимо согласие",
        description:
          "Для регистрации необходимо дать согласие на обработку персональных данных",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("email not confirmed") || msg.includes("not verified")) {
            openConfirmScreen(email);
            return;
          }
          throw error;
        }
        const { data: { user: signedIn } } = await supabase.auth.getUser();
        if (signedIn && !isEmailConfirmed(signedIn)) {
          openConfirmScreen(email);
          return;
        }
        navigate("/");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate("/");
        } else {
          openConfirmScreen(email);
        }
      }
    } catch (error: unknown) {
      toast({
        title: "Ошибка",
        description:
          error instanceof Error ? error.message : "Произошла ошибка",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: "Укажите email",
        description: "Введите адрес почты, чтобы получить ссылку для сброса пароля",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast({
        title: "Письмо отправлено",
        description: `Ссылка для сброса пароля — на ${email}`,
      });
    } catch (error: unknown) {
      toast({
        title: "Не удалось отправить",
        description:
          error instanceof Error ? error.message : "Попробуйте позже",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-navy flex items-center justify-center mx-auto mb-4">
            <Scale className="w-7 h-7 text-gold" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground">
            ПротоколЪ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingConfirmEmail
              ? "Подтвердите email"
              : isLogin
                ? "Войдите в аккаунт"
                : "Создайте аккаунт"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          {pendingConfirmEmail ? (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-foreground text-center">
                Подтвердите email
              </h2>
              <p className="text-sm text-center text-muted-foreground">
                Введите 8-значный код из письма.
              </p>
              <EmailOtpForm
                email={pendingConfirmEmail}
                onSuccess={() => {
                  closeConfirmScreen();
                  navigate("/", { replace: true });
                }}
              />
              <p className="text-xs text-center text-muted-foreground">
                Или нажмите «Перейти по ссылке» в письме.
              </p>
              <button
                type="button"
                onClick={handleResendConfirm}
                className="w-full text-sm text-gold-dark hover:underline"
              >
                Отправить письмо снова
              </button>
              <button
                type="button"
                onClick={() => {
                  closeConfirmScreen();
                  setIsLogin(true);
                }}
                className="w-full text-xs text-muted-foreground hover:underline"
              >
                Другой email / войти
              </button>
            </div>
          ) : (
            <>
          {!isLogin && (
            <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Согласие на обработку персональных данных
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Регистрируясь в сервисе «ПротоколЪ», я даю согласие на обработку
                моих персональных данных (адрес электронной почты, аудио- и
                видеозаписи, результаты расшифровок, технические данные) в
                соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О
                персональных данных» и{" "}
                <Link
                  to="/privacy"
                  className="text-gold-dark hover:underline"
                  target="_blank"
                >
                  Политикой конфиденциальности
                </Link>{" "}
                сервиса в целях предоставления услуг по расшифровке аудио- и
                видеозаписей.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Я уведомлен(а), что могу отозвать согласие в любое время путём
                удаления учётной записи. Отзыв согласия влечёт прекращение
                обработки и удаление персональных данных в течение 30 дней.
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-gold shrink-0"
                />
                <span className="text-xs font-medium text-foreground group-hover:text-gold-dark transition-colors">
                  Я даю согласие на обработку персональных данных и принимаю{" "}
                  <Link
                    to="/privacy"
                    className="text-gold-dark hover:underline"
                    target="_blank"
                  >
                    Политику конфиденциальности
                  </Link>{" "}
                  и{" "}
                  <Link
                    to="/terms"
                    className="text-gold-dark hover:underline"
                    target="_blank"
                  >
                    Условия использования
                  </Link>
                </span>
              </label>
            </div>
          )}

          {isLogin && (
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>
                Вход через Google и другие иностранные сервисы отключён. Дальше —
                только email и пароль.
              </p>
              <p>
                Если вы входили через Google — нажмите «Восстановить пароль»,
                укажите ваш email (в т.ч. Gmail). По ссылке из письма задайте
                пароль и входите как обычно.
              </p>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                  placeholder="your@email.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                  placeholder="Минимум 6 символов"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || (!isLogin && !consent)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-navy text-primary-foreground hover:bg-navy-light transition-colors font-medium text-sm disabled:opacity-50"
            >
              {loading
                ? "Загрузка..."
                : isLogin
                  ? "Войти"
                  : "Зарегистрироваться"}
              <ArrowRight className="w-4 h-4" />
            </button>
            {isLogin && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full text-sm text-gold-dark hover:underline disabled:opacity-50"
              >
                Восстановить пароль
              </button>
            )}
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setConsent(false);
              }}
              className="text-gold-dark hover:underline font-medium"
            >
              {isLogin ? "Зарегистрироваться" : "Войти"}
            </button>
          </p>

          {email.includes("@") && (
            <p className="text-center text-sm text-muted-foreground">
              Есть код из письма?{" "}
              <button
                type="button"
                onClick={() => openConfirmScreen(email)}
                className="text-gold-dark hover:underline font-medium"
              >
                Ввести код
              </button>
            </p>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
