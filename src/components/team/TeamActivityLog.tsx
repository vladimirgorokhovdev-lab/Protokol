import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  History,
  Loader2,
  Pencil,
  Mail,
  MailX,
  UserPlus,
  UserMinus,
  LogOut,
  Crown,
} from "lucide-react";

interface ActivityRow {
  id: string;
  action: string;
  description: string;
  actor_email: string | null;
  created_at: string;
}

const ACTION_ICON: Record<string, typeof History> = {
  team_created: Crown,
  team_renamed: Pencil,
  invitation_created: Mail,
  invitation_revoked: MailX,
  member_joined: UserPlus,
  member_removed: UserMinus,
  member_left: LogOut,
};

export function TeamActivityLog({ teamId }: { teamId: string }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("team_activity_log")
        .select("id, action, description, actor_email, created_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled) {
        setRows((data as ActivityRow[]) ?? []);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`team_activity_${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_activity_log",
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          setRows((prev) => [payload.new as ActivityRow, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <History className="w-5 h-5 text-gold-dark" />
          Журнал действий
        </CardTitle>
        <CardDescription>
          Последние события: переименования, приглашения, изменения состава команды.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Действий пока нет
          </p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {rows.map((r) => {
              const Icon = ACTION_ICON[r.action] ?? History;
              const date = new Date(r.created_at).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li
                  key={r.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground break-words">
                      {r.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.actor_email ?? "Система"} · {date}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
