import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, User as UserIcon, Mail, Lock, Loader2, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

const nameSchema = z
  .string()
  .trim()
  .max(100, { message: "Имя должно быть не длиннее 100 символов" });

const emailSchema = z
  .string()
  .trim()
  .email({ message: "Некорректный email" })
  .max(255, { message: "Email слишком длинный" });

const passwordSchema = z
  .string()
  .min(8, { message: "Пароль должен быть не короче 8 символов" })
  .max(72, { message: "Пароль должен быть не длиннее 72 символов" });

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [fullName, setFullName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingName, setSavingName] = useState(false);

  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    let cancelled = false;
    (async () => {
      setLoadingProfile(true);
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        const name = (data?.full_name as string | null) ?? "";
        setFullName(name);
        setInitialName(name);
        setLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const handleSaveName = async () => {
    const parsed = nameSchema.safeParse(fullName);
    if (!parsed.success) {
      toast({ title: "Ошибка", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data || null })
      .eq("user_id", user.id);
    setSavingName(false);
    if (error) {
      toast({ title: "Не удалось сохранить", description: error.message, variant: "destructive" });
      return;
    }
    setInitialName(parsed.data);
    toast({ title: "Имя обновлено" });
  };

  const handleSaveEmail = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast({ title: "Ошибка", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    if (parsed.data === user.email) {
      toast({ title: "Email не изменился" });
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser(
      { email: parsed.data },
      { emailRedirectTo: `${window.location.origin}/account/profile` }
    );
    setSavingEmail(false);
    if (error) {
      toast({ title: "Не удалось изменить email", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Подтвердите смену email",
      description:
        "На старый и новый адреса отправлены письма с подтверждением. Email изменится после подтверждения.",
    });
  };

  const handleSavePassword = async () => {
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      toast({ title: "Ошибка", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Пароли не совпадают", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    setSavingPassword(false);
    if (error) {
      toast({ title: "Не удалось изменить пароль", description: error.message, variant: "destructive" });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast({ title: "Пароль обновлён" });
  };

  const nameChanged = fullName.trim() !== initialName.trim();
  const emailChanged = email.trim() !== (user.email ?? "");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto flex items-center justify-between py-4 px-4">
          <Link
            to="/account"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">В личный кабинет</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <MobileNav showHome={false} />
          </div>
        </div>
      </header>

      <div className="container max-w-3xl mx-auto px-4 py-8 sm:py-10 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-playfair text-foreground">
            Профиль
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Управляйте именем, адресом электронной почты и паролем для входа.
          </p>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-playfair text-lg flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-gold-dark" />
              Имя
            </CardTitle>
            <CardDescription>
              Отображается в приложении. Можно оставить пустым.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Полное имя</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иван Иванов"
                maxLength={100}
                disabled={loadingProfile}
                autoComplete="name"
              />
            </div>
            <div>
              <Button
                onClick={handleSaveName}
                disabled={!nameChanged || savingName || loadingProfile}
                className="bg-navy hover:bg-navy-light"
              >
                {savingName ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Сохранить имя
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-playfair text-lg flex items-center gap-2">
              <Mail className="w-5 h-5 text-gold-dark" />
              Email
            </CardTitle>
            <CardDescription>
              Используется для входа в аккаунт. Изменение требует подтверждения по почте.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Адрес электронной почты</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={255}
                autoComplete="email"
              />
            </div>
            <div>
              <Button
                onClick={handleSaveEmail}
                disabled={!emailChanged || savingEmail}
                className="bg-navy hover:bg-navy-light"
              >
                {savingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Изменить email
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-playfair text-lg flex items-center gap-2">
              <Lock className="w-5 h-5 text-gold-dark" />
              Пароль
            </CardTitle>
            <CardDescription>
              Минимум 8 символов. Используйте уникальный пароль для этого сервиса.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Новый пароль</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Повторите пароль</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Button
                onClick={handleSavePassword}
                disabled={!newPassword || !confirmPassword || savingPassword}
                className="bg-navy hover:bg-navy-light"
              >
                {savingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Изменить пароль
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
