import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovalStatus } from "@/hooks/useApprovalStatus";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, RefreshCw } from "lucide-react";

interface Request {
  user_id: string;
  email: string;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at: string | null;
  rejected_reason: string | null;
}

const AdminRequests = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, status, adminLoading } = useApprovalStatus();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_approval_requests", { _filter: filter });
    if (error) toast.error(error.message);
    else setRequests((data as Request[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, filter]);

  if (authLoading || status === "loading" || adminLoading) {
    return <div className="min-h-screen flex items-center justify-center">Загрузка…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const handleApprove = async (userId: string) => {
    const { error } = await supabase.rpc("approve_user", { _user_id: userId });
    if (error) toast.error(error.message);
    else {
      toast.success("Пользователь одобрен");
      load();
    }
  };

  const handleReject = async (userId: string) => {
    const reason = window.prompt("Причина отклонения (необязательно):") ?? null;
    const { error } = await supabase.rpc("reject_user", { _user_id: userId, _reason: reason });
    if (error) toast.error(error.message);
    else {
      toast.success("Пользователь отклонён");
      load();
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Заявки на доступ</h1>
          <p className="text-muted-foreground">Одобрение новых пользователей</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Обновить
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="pending">Ожидают</TabsTrigger>
          <TabsTrigger value="approved">Одобрены</TabsTrigger>
          <TabsTrigger value="rejected">Отклонены</TabsTrigger>
          <TabsTrigger value="all">Все</TabsTrigger>
        </TabsList>
      </Tabs>

      {requests.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          {loading ? "Загрузка…" : "Нет заявок"}
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.user_id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium">{r.email ?? r.user_id}</div>
                <div className="text-xs text-muted-foreground">
                  Регистрация: {new Date(r.created_at).toLocaleString("ru-RU")}
                </div>
                {r.rejected_reason && (
                  <div className="text-xs text-destructive mt-1">
                    Причина: {r.rejected_reason}
                  </div>
                )}
              </div>
              <Badge
                variant={
                  r.approval_status === "approved"
                    ? "default"
                    : r.approval_status === "rejected"
                    ? "destructive"
                    : "secondary"
                }
              >
                {r.approval_status === "pending" && "Ожидает"}
                {r.approval_status === "approved" && "Одобрен"}
                {r.approval_status === "rejected" && "Отклонён"}
              </Badge>
              {r.approval_status !== "approved" && (
                <Button size="sm" onClick={() => handleApprove(r.user_id)}>
                  <Check className="w-4 h-4 mr-1" /> Одобрить
                </Button>
              )}
              {r.approval_status !== "rejected" && (
                <Button size="sm" variant="outline" onClick={() => handleReject(r.user_id)}>
                  <X className="w-4 h-4 mr-1" /> Отклонить
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRequests;
