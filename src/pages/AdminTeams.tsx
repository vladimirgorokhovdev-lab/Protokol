import { useEffect, useState, useCallback } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovalStatus } from "@/hooks/useApprovalStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";

type TeamRow = {
  id: string;
  name: string;
  created_at: string;
  owner_id: string;
  owner_email: string | null;
  members_count: number;
  invitations_count: number;
  tier: string | null;
  sub_status: string | null;
  period_end: string | null;
  monthly_seconds: number | null;
  total_seconds: number | null;
};

type TeamDetail = {
  team: { id: string; name: string; created_at: string; owner_id: string };
  owner_email: string | null;
  subscription: { tier: string; status: string; auto_renew: boolean; current_period_end: string | null } | null;
  usage: { monthly_count: number; total_count: number; monthly_seconds: number; total_seconds: number } | null;
  members: Array<{ user_id: string; role: string; joined_at: string; email: string | null }>;
  invitations: Array<{ id: string; email: string; created_at: string; expires_at: string; accepted_at: string | null }>;
  activity: Array<{ id: string; action: string; description: string; actor_email: string | null; created_at: string }>;
};

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("ru-RU") : "—";
const fmtDt = (d: string | null) => d ? new Date(d).toLocaleString("ru-RU") : "—";
const hours = (s: number | null) => `${((s ?? 0) / 3600).toFixed(1)} ч`;

const AdminTeams = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, status, adminLoading } = useApprovalStatus();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_teams");
    if (error) toast.error(error.message);
    else setTeams((data as unknown as TeamRow[]) ?? []);
    setLoading(false);
  }, []);

  const openTeam = async (id: string) => {
    setOpenId(id);
    setDetail(null);
    setLoadingDetail(true);
    const { data, error } = await supabase.rpc("admin_team_detail", { p_team_id: id });
    if (error) toast.error(error.message);
    else setDetail(data as unknown as TeamDetail);
    setLoadingDetail(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (authLoading || status === "loading" || adminLoading) {
    return <div className="min-h-screen flex items-center justify-center">Загрузка…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto flex items-center justify-between py-4 px-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> На главную
          </Link>
          <h1 className="font-serif text-xl">Команды (админ)</h1>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Обновить
          </Button>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-4">
        <p className="text-sm text-muted-foreground">Всего команд: {teams.length}</p>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Название</th>
                  <th className="text-left p-3">Владелец</th>
                  <th className="text-left p-3">Тариф</th>
                  <th className="text-right p-3">Участников</th>
                  <th className="text-right p-3">Часов / мес</th>
                  <th className="text-left p-3">Период до</th>
                  <th className="text-left p-3">Создана</th>
                </tr>
              </thead>
              <tbody>
                {teams.length === 0 && !loading && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Команд пока нет</td></tr>
                )}
                {teams.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => openTeam(t.id)}>
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3 text-muted-foreground">{t.owner_email ?? "—"}</td>
                    <td className="p-3">
                      {t.tier
                        ? <Badge variant={t.sub_status === "active" ? "default" : "outline"}>{t.tier} · {t.sub_status}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-right">
                      {t.members_count}
                      {t.invitations_count > 0 && <span className="text-muted-foreground"> +{t.invitations_count} пригл.</span>}
                    </td>
                    <td className="p-3 text-right">{hours(t.monthly_seconds)}</td>
                    <td className="p-3">{fmt(t.period_end)}</td>
                    <td className="p-3 text-muted-foreground">{fmt(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!openId} onOpenChange={(o) => { if (!o) { setOpenId(null); setDetail(null); } }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.team?.name ?? "Команда"}</DialogTitle>
            <DialogDescription>
              {detail ? `Создана ${fmt(detail.team.created_at)} · владелец ${detail.owner_email ?? "—"}` : ""}
            </DialogDescription>
          </DialogHeader>

          {loadingDetail || !detail ? (
            <p className="text-center text-muted-foreground py-8">Загрузка…</p>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Подписка и использование</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-muted-foreground">Тариф</p><p className="font-semibold">{detail.subscription?.tier ?? "—"} · {detail.subscription?.status ?? "—"}</p></div>
                  <div><p className="text-muted-foreground">Автопродление</p><p className="font-semibold">{detail.subscription?.auto_renew ? "Да" : "Нет"}</p></div>
                  <div><p className="text-muted-foreground">Период до</p><p className="font-semibold">{fmt(detail.subscription?.current_period_end ?? null)}</p></div>
                  <div><p className="text-muted-foreground">Часов всего / мес</p><p className="font-semibold">{hours(detail.usage?.total_seconds ?? 0)} / {hours(detail.usage?.monthly_seconds ?? 0)}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Участники ({detail.members.length})</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {detail.members.map((m) => (
                    <div key={m.user_id} className="flex justify-between border-b border-border py-1.5">
                      <span>{m.email ?? m.user_id}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant={m.role === "owner" ? "default" : "outline"}>{m.role === "owner" ? "владелец" : "участник"}</Badge>
                        <span className="text-muted-foreground text-xs">с {fmt(m.joined_at)}</span>
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {detail.invitations.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Приглашения ({detail.invitations.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    {detail.invitations.map((i) => (
                      <div key={i.id} className="flex justify-between border-b border-border py-1.5">
                        <span>{i.email}</span>
                        <span className="text-muted-foreground text-xs">
                          {i.accepted_at ? `принято ${fmt(i.accepted_at)}` : `до ${fmt(i.expires_at)}`}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-base">Активность ({detail.activity.length})</CardTitle></CardHeader>
                <CardContent className="text-xs space-y-1 max-h-72 overflow-y-auto">
                  {detail.activity.length === 0 ? <p className="text-muted-foreground">Нет событий</p> :
                    detail.activity.map((a) => (
                      <div key={a.id} className="flex justify-between gap-2 border-b border-border/50 py-1">
                        <span><span className="text-muted-foreground">{fmtDt(a.created_at)}</span> · {a.description}</span>
                        <span className="text-muted-foreground truncate max-w-[30%]">{a.actor_email}</span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTeams;
