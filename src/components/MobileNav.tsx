import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Star, CreditCard, HelpCircle, MessageSquare, LogIn, LogOut, Home, PlayCircle, ShieldCheck, User as UserIcon, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadFeedback } from "@/hooks/useUnreadFeedback";
import { useHistoryBadge } from "@/hooks/useHistoryBadge";
import { HistoryNavButton } from "@/components/HistoryNavButton";
import { useApprovalStatus } from "@/hooks/useApprovalStatus";
import { WhatsNewMenu } from "@/components/WhatsNewMenu";
import { resetCacheAndReload } from "@/lib/cacheReset";

interface MobileNavProps {
  showHome?: boolean;
}

export function MobileNav({ showHome = true }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useApprovalStatus();
  const { unreadCount: unreadFeedback, markRead: markFeedbackRead } = useUnreadFeedback();
  const { totalCount: historyCount, newCount: historyNewCount } = useHistoryBadge();

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-muted transition-colors"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 top-full overflow-hidden border-t border-border bg-card z-50"
          >
            <nav className="flex flex-col p-3 gap-1">
              {showHome && (
                <button onClick={() => go("/")} className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left">
                  <Home className="w-4 h-4 text-muted-foreground" /> На главную
                </button>
              )}
              <WhatsNewMenu variant="mobile" />
              <button onClick={() => go("/advantages")} className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left">
                <Star className="w-4 h-4 text-muted-foreground" /> Преимущества
              </button>
              <button onClick={() => go("/pricing")} className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left">
                <CreditCard className="w-4 h-4 text-muted-foreground" /> Тарифы
              </button>
              <button onClick={() => go("/demo")} className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left">
                <PlayCircle className="w-4 h-4 text-muted-foreground" /> Демо
              </button>
              <button onClick={() => go("/guide")} className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left">
                <HelpCircle className="w-4 h-4 text-muted-foreground" /> Руководство
              </button>
              {user && (
                <>
                  <button onClick={() => go("/account")} className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left">
                    <UserIcon className="w-4 h-4 text-muted-foreground" /> Личный кабинет
                  </button>
                  <HistoryNavButton
                    variant="mobile"
                    totalCount={historyCount}
                    newCount={historyNewCount}
                    onClick={() => go("/history")}
                  />
                  <button onClick={() => { markFeedbackRead(); go("/feedback"); }} className="relative flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" /> Отзывы
                    {unreadFeedback > 0 && (
                      <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold px-1">
                        {unreadFeedback > 99 ? "99+" : unreadFeedback}
                      </span>
                    )}
                  </button>
                </>
              )}
              <div className="border-t border-border my-1" />
              {user ? (
                <button onClick={() => { signOut(); setOpen(false); }} className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left">
                  <LogOut className="w-4 h-4 text-muted-foreground" /> Выйти
                </button>
              ) : (
                <button onClick={() => go("/auth")} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-navy text-primary-foreground hover:bg-navy-light transition-colors text-sm font-medium">
                  <LogIn className="w-4 h-4" /> Войти
                </button>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
