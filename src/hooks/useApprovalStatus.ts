import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "loading" | "none";

export const useApprovalStatus = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    if (!user?.id) {
      setIsAdmin(false);
      setAdminLoading(false);
      return;
    }

    setAdminLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.warn("admin role check failed", error);
        setIsAdmin(Boolean(data && !error));
        setAdminLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  return {
    status: user ? ("approved" as ApprovalStatus) : ("none" as ApprovalStatus),
    isAdmin,
    adminLoading,
  };
};
