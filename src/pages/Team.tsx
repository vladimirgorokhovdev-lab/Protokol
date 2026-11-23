import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/hooks/useTeam";
import { useSubscription, formatHoursFromSeconds } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Users,
  Mail,
  Trash2,
  Copy,
  LogOut,
  Crown,
  Loader2,
  Check,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { TeamActivityLog } from "@/components/team/TeamActivityLog";
import { toast } from "sonner";
import { publicAppHref } from "@/lib/appUrl";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Введите корректный email")
  .max(255);
const nameSchema = z
  .string()
  .trim()
  .min(1, "Название не может быть пустым")
  .max(64);

export default function Team() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const team = useTeam();
  const subscription = useSubscription();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  if (authLoading || team.loading || subscription.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!team.team) {
    return (
      <div className="min-h-screen bg-background">
        <Header onBack={() => navigate("/")} />
        <div className="container max-w-2xl mx-auto px-4 py-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="font-serif">
                У вас пока нет команды
              </CardTitle>
              <CardDescription>
                Командный тариф позволяет работать совместно с коллегами в одной
                организации
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => navigate("/pricing")}>
                Перейти к тарифам
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isOwner = team.role === "owner";
  const memberLimit = team.memberLimit;
  const slotsLeft = memberLimit - team.members.length - team.invitations.length;

  const showErrorWithRetry = (
    title: string,
    error: string | undefined,
    retry: () => void,
  ) => {
    toast.error(title, {
      description: error || "Попробуйте ещё раз или обновите страницу.",
      duration: 8000,
      action: { label: "Повторить", onClick: () => retry() },
    });
  };

  const handleSaveName = async () => {
    const parsed = nameSchema.safeParse(nameDraft);
    if (!parsed.success) {
      toast.error("Некорректное название", {
        description: parsed.error.issues[0].message,
      });
      return;
    }
    if (parsed.data === team.team!.name) {
      setEditingName(false);
      return;
    }
    const result = await team.renameTeam(parsed.data);
    if (result.ok) {
      toast.success("Название команды обновлено");
      setEditingName(false);
    } else {
      showErrorWithRetry(
        "Не удалось переименовать команду",
        result.error,
        handleSaveName,
      );
    }
  };

  const handleInvite = async () => {
    const parsed = emailSchema.safeParse(inviteEmail);
    if (!parsed.success) {
      toast.error("Некорректный email", {
        description: parsed.error.issues[0].message,
      });
      return;
    }
    if (slotsLeft <= 0) {
      toast.error("Лимит участников исчерпан", {
        description: `В команде уже ${memberLimit} участников (с учётом активных приглашений). Удалите кого-то или отзовите приглашение.`,
      });
      return;
    }
    setInviting(true);
    const result = await team.inviteMember(parsed.data);
    setInviting(false);
    if (result.token) {
      const link = publicAppHref(`/team/join?token=${result.token}`);
      navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Приглашение создано", {
        description:
          "Ссылка скопирована в буфер обмена. Отправьте её участнику.",
      });
      setInviteEmail("");
    } else {
      showErrorWithRetry(
        "Не удалось пригласить участника",
        result.error,
        handleInvite,
      );
    }
  };

  const handleCopyLink = (token: string) => {
    const link = publicAppHref(`/team/join?token=${token}`);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
      toast.success("Ссылка скопирована");
    });
  };

  const handleRevoke = async (id: string) => {
    const result = await team.revokeInvitation(id);
    if (result.ok) {
      toast.success("Приглашение отозвано");
    } else {
      showErrorWithRetry("Не удалось отозвать приглашение", result.error, () =>
        handleRevoke(id),
      );
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Удалить участника из команды?")) return;
    const result = await team.removeMember(userId);
    if (result.ok) {
      toast.success("Участник удалён из команды");
    } else {
      showErrorWithRetry("Не удалось удалить участника", result.error, () =>
        team.removeMember(userId).then((r) => {
          if (r.ok) toast.success("Участник удалён из команды");
        }),
      );
    }
  };

  const handleLeave = async () => {
    if (
      !confirm("Выйти из команды? Доступ к общим расшифровкам будет потерян.")
    )
      return;
    const result = await team.leaveTeam();
    if (result.ok) {
      toast.success("Вы покинули команду");
      navigate("/");
    } else {
      showErrorWithRetry(
        "Не удалось выйти из команды",
        result.error,
        handleLeave,
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onBack={() => navigate("/")} />
      <div className="container max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <div className="flex gap-2">
                    <Input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      autoFocus
                      maxLength={64}
                    />
                    <Button size="sm" onClick={handleSaveName}>
                      Сохранить
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingName(false)}
                    >
                      Отмена
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="font-serif text-2xl">
                      {team.team.name}
                    </CardTitle>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setNameDraft(team.team!.name);
                          setEditingName(true);
                        }}
                      >
                        Изменить
                      </Button>
                    )}
                  </div>
                )}
                <CardDescription className="mt-2">
                  Командный тариф · {team.members.length}/{memberLimit}{" "}
                  участников · Использовано в этом месяце:{" "}
                  {formatHoursFromSeconds(team.monthlySecondsUsed)} /{" "}
                  {team.monthlyHoursLimit} ч (общий пул команды)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Участники</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {team.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {m.role === "owner" ? (
                        <Crown className="w-4 h-4 text-primary" />
                      ) : (
                        <Users className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.user_id === user.id
                          ? "Вы"
                          : m.user_id.slice(0, 8) + "…"}
                      </p>
                      <span
                        className={
                          "inline-flex items-center gap-1 text-xs mt-0.5 px-1.5 py-0.5 rounded " +
                          (m.role === "owner"
                            ? "bg-gold/15 text-gold-dark"
                            : "bg-muted text-muted-foreground")
                        }
                      >
                        {m.role === "owner" ? (
                          <>
                            <Crown className="w-3 h-3" /> Владелец
                          </>
                        ) : (
                          "Участник"
                        )}
                      </span>
                    </div>
                  </div>
                  {isOwner && m.role !== "owner" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(m.user_id)}
                      title="Удалить из команды"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                  {isOwner && m.role === "owner" && (
                    <span
                      className="text-xs text-muted-foreground italic"
                      title="Владельца команды нельзя удалить. Чтобы передать команду, обратитесь в поддержку."
                    >
                      Нельзя удалить владельца
                    </span>
                  )}
                  {!isOwner && m.user_id === user.id && (
                    <Button size="sm" variant="ghost" onClick={handleLeave}>
                      <LogOut className="w-4 h-4 mr-1" />
                      Выйти
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif">
                Пригласить в команду
              </CardTitle>
              <CardDescription>
                Отправьте ссылку коллеге. Принимая приглашение, он получит общий
                доступ к расшифровкам команды.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  onClick={handleInvite}
                  disabled={inviting || slotsLeft <= 0}
                >
                  {inviting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Пригласить"
                  )}
                </Button>
              </div>
              {slotsLeft <= 0 && (
                <p className="text-xs text-destructive">
                  Достигнут лимит {memberLimit} участников. Удалите кого-то или
                  отзовите приглашение.
                </p>
              )}

              {team.invitations.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Активные приглашения
                  </p>
                  <div className="space-y-2">
                    {team.invitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50 border border-border"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Истекает{" "}
                            {new Date(inv.expires_at).toLocaleDateString(
                              "ru-RU",
                            )}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyLink(inv.token)}
                          title="Скопировать ссылку"
                        >
                          {copiedToken === inv.token ? (
                            <Check className="w-4 h-4 text-accent" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevoke(inv.id)}
                          title="Отозвать"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <TeamActivityLog teamId={team.team.id} />
      </div>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="container max-w-3xl mx-auto flex items-center justify-between py-4 px-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">На главную</span>
        </Button>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <MobileNav showHome={false} />
        </div>
      </div>
    </header>
  );
}
