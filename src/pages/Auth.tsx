import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Scale, Mail, Lock, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

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
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          // Должен совпадать с Redirect URLs в Supabase (корень + /auth надёжнее явно указать).
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) throw error;
        toast({
          title: "Регистрация",
          description: "Аккаунт создан, можно входить через кнопку «Войти»",
        });
        setIsLogin(true);
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

  const handleGoogleAuth = async () => {
    if (!isLogin && !consent) {
      toast({
        title: "Необходимо согласие",
        description:
          "Для регистрации необходимо дать согласие на обработку персональных данных",
        variant: "destructive",
      });
      return;
    }

    const mode = import.meta.env.VITE_GOOGLE_AUTH ?? "lovable";
    setLoading(true);
    try {
      if (mode === "supabase") {
        const redirectTo = `${window.location.origin}/auth${window.location.search}`;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        if (error) throw error;
      } else {
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        if (result.error) {
          throw result.error instanceof Error
            ? result.error
            : new Error(String(result.error));
        }
        if (!result.redirected) navigate("/");
      }
    } catch (error: unknown) {
      toast({
        title: "Ошибка",
        description:
          error instanceof Error
            ? error.message
            : "Не удалось войти через Google",
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
            {isLogin ? "Войдите в аккаунт" : "Создайте аккаунт"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
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

          <button
            onClick={handleGoogleAuth}
            disabled={!isLogin && !consent}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-background hover:bg-muted transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Войти через Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-muted-foreground">или</span>
            </div>
          </div>

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
        </div>
      </div>
    </div>
  );
};

export default Auth;
