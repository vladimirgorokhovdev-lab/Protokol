import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
} from "@/lib/notifications";
import { toast } from "@/hooks/use-toast";

export function NotificationToggle() {
  const [enabled, setEnabled] = useState(getNotificationsEnabled);

  const toggle = () => {
    const next = !enabled;
    setNotificationsEnabled(next);
    setEnabled(next);
    toast({
      title: next ? "Уведомления включены" : "Уведомления выключены",
      description: next
        ? "Вы получите уведомление, когда расшифровка будет готова"
        : "Уведомления о завершении расшифровки отключены",
    });
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm text-muted-foreground hover:text-foreground"
      title={enabled ? "Уведомления включены" : "Уведомления выключены"}
    >
      {enabled ? (
        <Bell className="w-4 h-4" />
      ) : (
        <BellOff className="w-4 h-4" />
      )}
    </button>
  );
}
