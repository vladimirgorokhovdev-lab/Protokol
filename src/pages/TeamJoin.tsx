import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

export default function TeamJoin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setStatus("error");
      setErrorMsg("Ссылка приглашения недействительна");
      return;
    }
    if (!user) {
      sessionStorage.setItem("pending_team_invite", token);
      navigate(`/auth?redirect=/team/join?token=${encodeURIComponent(token)}`);
    }
  }, [authLoading, user, token, navigate]);

  const accept = async () => {
    if (!token) return;
    setStatus("loading");
    const { data, error } = await supabase.rpc("accept_team_invitation", { _token: token });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message || "Не удалось принять приглашение");
      return;
    }
    setStatus("success");
    toast.success("Вы присоединились к команде");
    sessionStorage.removeItem("pending_team_invite");
    setTimeout(() => navigate("/team"), 1500);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="font-serif">Приглашение в команду</CardTitle>
          <CardDescription>
            Принимая приглашение, вы получите общий доступ к расшифровкам команды
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "error" && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}
          {status === "success" && (
            <p className="text-sm text-accent">Готово! Перенаправляем…</p>
          )}
          {(status === "idle" || status === "loading") && (
            <Button onClick={accept} disabled={status === "loading"} className="w-full">
              {status === "loading" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Принимаем…</>
              ) : (
                "Принять приглашение"
              )}
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
            На главную
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
