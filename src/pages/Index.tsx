import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { requestNotificationPermission } from "@/lib/notifications";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale,
  Shield,
  LogIn,
  LogOut,
  MessageSquare,
  HelpCircle,
  CreditCard,
  Star,
  Menu,
  X,
  PlayCircle,
  ShieldCheck,
  User as UserIcon,
  RotateCcw,
  Inbox,
  BarChart3,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletteSwitcher } from "@/components/PaletteSwitcher";
import { KeyboardShortcutsHint } from "@/components/KeyboardShortcutsHint";
import { NotificationToggle } from "@/components/NotificationToggle";
import { WhatsNewMenu } from "@/components/WhatsNewMenu";
import { useUnreadFeedback } from "@/hooks/useUnreadFeedback";
import { useUnreadContact } from "@/hooks/useUnreadContact";
import { useApprovalStatus } from "@/hooks/useApprovalStatus";
import { resetCacheAndReload } from "@/lib/cacheReset";
import { probeMediaDuration } from "@/lib/probeMediaDuration";

import AudioDropZone from "@/components/AudioDropZone";

import AudioRecorder from "@/components/AudioRecorder";
import FileQueueItem from "@/components/FileQueueItem";
import { useSharedTranscriptionQueue } from "@/hooks/useSharedTranscriptionQueue";
import { SupportSection } from "@/components/SupportSection";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { isEmailConfirmed } from "@/lib/authEmail";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { HistoryNavButton } from "@/components/HistoryNavButton";
import { SavedToHistoryCard } from "@/components/SavedToHistoryCard";
import { useHistoryBadge } from "@/hooks/useHistoryBadge";

const Index = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useApprovalStatus();
  const [showRecorder, setShowRecorder] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { items, addFiles, cancelItem, removeItem, retryItem, renameSpeaker } =
    useSharedTranscriptionQueue();
  const { unreadCount: unreadFeedback, markRead: markFeedbackRead } =
    useUnreadFeedback();
  const { unreadCount: unreadContact } = useUnreadContact();

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const { totalCount: historyCount, newCount: historyNewCount } =
    useHistoryBadge();

  const activeItems = useMemo(
    () =>
      items.filter((i) => i.status !== "done" && !dismissedIds.has(i.id)),
    [items, dismissedIds],
  );

  const savedToHistoryItems = useMemo(
    () => items.filter((i) => i.status === "done" && !dismissedIds.has(i.id)),
    [items, dismissedIds],
  );

  const hasQueueVisible = activeItems.length > 0 || savedToHistoryItems.length > 0;

  const dismissQueueItem = useCallback(
    (id: string) => {
      setDismissedIds((prev) => new Set(prev).add(id));
      removeItem(id);
    },
    [removeItem],
  );

  const openHistory = useCallback(() => {
    navigate("/history");
  }, [navigate]);

  const subscription = useSubscription();
  const emailBlocked = Boolean(user) && !isEmailConfirmed(user);
  const quotaBlocked =
    Boolean(user) &&
    !emailBlocked &&
    !subscription.loading &&
    !subscription.canTranscribe;
  const isFreeTier = !subscription.loading && subscription.tier === "free";
  const FREE_MAX_DURATION_SEC = 2 * 60 * 60;

  const guardQuota = useCallback((): boolean => {
    if (emailBlocked) {
      toast.error("Подтвердите email", {
        description:
          "Перейдите по ссылке из письма после регистрации. Кнопка «Отправить снова» — в жёлтой полосе сверху.",
      });
      return false;
    }
    if (quotaBlocked) {
      toast.error("Лимит расшифровок по вашему тарифу исчерпан", {
        description: "Оформите подписку, чтобы продолжить.",
        action: { label: "Тарифы", onClick: () => navigate("/pricing") },
      });
      return false;
    }
    return true;
  }, [emailBlocked, quotaBlocked, navigate]);

  const checkFilesAgainstQuota = useCallback(
    async (files: File[]): Promise<boolean> => {
      const durations = await Promise.all(files.map(probeMediaDuration));
      const totalSec = durations.reduce(
        (sum, d) => sum + (Number.isFinite(d) && d > 0 ? d : 0),
        0,
      );

      if (isFreeTier) {
        const idx = durations.findIndex((d) => d > FREE_MAX_DURATION_SEC);
        if (idx >= 0) {
          toast.error(`Файл «${files[idx].name}» длиннее 2 часов`, {
            description:
              "На бесплатном тарифе доступны записи до 2 часов. Оформите подписку для длинных файлов.",
            action: { label: "Тарифы", onClick: () => navigate("/pricing") },
          });
          return false;
        }
      }

      const ok = await subscription.checkCanTranscribe(totalSec);
      if (!ok) {
        toast.error("Лимит по тарифу исчерпан", {
          description:
            "Исчерпаны расшифровки или часы за месяц. Откройте тарифы.",
          action: { label: "Тарифы", onClick: () => navigate("/pricing") },
        });
        return false;
      }
      return true;
    },
    [isFreeTier, navigate, subscription],
  );

  const handleAddFiles = useCallback(
    async (files: File[], numSpeakers?: number) => {
      if (!user) {
        toast.error("Сначала войдите в аккаунт", {
          action: { label: "Войти", onClick: () => navigate("/auth") },
        });
        return;
      }
      if (!guardQuota()) return;

      const checkToast = toast.loading(
        files.length === 1
          ? "Проверка файла..."
          : `Проверка файлов (${files.length})...`,
      );
      try {
        if (!(await checkFilesAgainstQuota(files))) return;
        addFiles(files, numSpeakers);
      } finally {
        toast.dismiss(checkToast);
      }
    },
    [addFiles, guardQuota, checkFilesAgainstQuota, user, navigate],
  );

  const handleOpenRecorder = useCallback(() => {
    if (!guardQuota()) return;
    setShowRecorder(true);
  }, [guardQuota]);

  const handleRecordingComplete = useCallback(
    async (file: File) => {
      if (!(await checkFilesAgainstQuota([file]))) return;
      addFiles([file]);
    },
    [addFiles, checkFilesAgainstQuota],
  );

  useEffect(() => {
    if (hasQueueVisible) {
      requestNotificationPermission();
    }
  }, [hasQueueVisible]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        fileInputRef.current?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        setShowRecorder((prev) => !prev);
      } else if (e.key === "Escape") {
        setShowRecorder(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <img
              src="/icon-192.png"
              alt="ПротоколЪ"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-lg font-serif font-bold text-foreground leading-tight">
                Протокол<span className="text-gold">Ъ</span>
              </h1>
              <p className="text-[11px] text-foreground/70">
                Расшифровка аудио для юристов
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1 ml-4">
            <WhatsNewMenu />
            <NotificationToggle />
            <KeyboardShortcutsHint />
            <ThemeToggle />
            <PaletteSwitcher />
            <button
              onClick={() => navigate("/advantages")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-[13px] text-muted-foreground hover:text-foreground"
            >
              <Star className="w-4 h-4" />
              Преимущества
            </button>
            <button
              onClick={() => navigate("/demo")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-[13px] text-muted-foreground hover:text-foreground"
            >
              <PlayCircle className="w-4 h-4" />
              Демо
            </button>
            <button
              onClick={() => navigate("/pricing")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-[13px] text-muted-foreground hover:text-foreground"
            >
              <CreditCard className="w-4 h-4" />
              Тарифы
            </button>
            {user && (
              <>
                <button
                  onClick={() => navigate("/account")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-[13px] text-muted-foreground hover:text-foreground"
                >
                  <UserIcon className="w-4 h-4" />
                  Кабинет
                </button>
                <HistoryNavButton
                  totalCount={historyCount}
                  newCount={historyNewCount}
                  onClick={openHistory}
                />
                <button
                  onClick={() => {
                    markFeedbackRead();
                    navigate("/feedback");
                  }}
                  className="relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-[13px] text-muted-foreground hover:text-foreground"
                >
                  <MessageSquare className="w-4 h-4" />
                  Отзывы
                  {unreadFeedback > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[9px] font-bold px-0.5 animate-in zoom-in-50">
                      {unreadFeedback > 99 ? "99+" : unreadFeedback}
                    </span>
                  )}
                </button>
                {isAdmin && (
                  <div className="flex items-center gap-0.5 ml-1 pl-2 border-l border-border">
                    <button
                      onClick={() => navigate("/admin/contact")}
                      className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Входящие — сообщения с формы «Написать нам»"
                    >
                      <Inbox className="w-4 h-4" />
                      {unreadContact > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[9px] font-bold px-0.5">
                          {unreadContact > 99 ? "99+" : unreadContact}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => navigate("/admin/analytics")}
                      className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Аналитика и сегменты пользователей"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate("/admin/teams")}
                      className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Команды (админ)"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
            {user ? (
              <button
                onClick={signOut}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-[13px] text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </button>
            ) : (
              <button
                onClick={() => navigate("/auth")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-navy text-primary-foreground hover:bg-navy-light transition-colors text-[13px] font-medium"
              >
                <LogIn className="w-4 h-4" />
                Войти
              </button>
            )}
          </div>

          <div className="flex md:hidden items-center gap-1">
            <PaletteSwitcher />
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-border bg-card"
            >
              <nav className="flex flex-col p-3 gap-1">
                <button
                  onClick={() => {
                    navigate("/advantages");
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left"
                >
                  <Star className="w-4 h-4 text-muted-foreground" />{" "}
                  Преимущества
                </button>
                <button
                  onClick={() => {
                    navigate("/pricing");
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left"
                >
                  <CreditCard className="w-4 h-4 text-muted-foreground" />{" "}
                  Тарифы
                </button>
                <button
                  onClick={() => {
                    navigate("/guide");
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left"
                >
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />{" "}
                  Руководство
                </button>
                {user && (
                  <>
                    <button
                      onClick={() => {
                        navigate("/account");
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left"
                    >
                      <UserIcon className="w-4 h-4 text-muted-foreground" />{" "}
                      Личный кабинет
                    </button>
                    <HistoryNavButton
                      variant="mobile"
                      totalCount={historyCount}
                      newCount={historyNewCount}
                      onClick={() => {
                        openHistory();
                        setMobileMenuOpen(false);
                      }}
                    />
                    <button
                      onClick={() => {
                        markFeedbackRead();
                        navigate("/feedback");
                        setMobileMenuOpen(false);
                      }}
                      className="relative flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left"
                    >
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />{" "}
                      Отзывы
                      {unreadFeedback > 0 && (
                        <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold px-1">
                          {unreadFeedback > 99 ? "99+" : unreadFeedback}
                        </span>
                      )}
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => {
                            navigate("/admin/contact");
                            setMobileMenuOpen(false);
                          }}
                          className="relative flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left"
                        >
                          <Inbox className="w-4 h-4 text-muted-foreground" />{" "}
                          Входящие
                          {unreadContact > 0 && (
                            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold px-1">
                              {unreadContact > 99 ? "99+" : unreadContact}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            navigate("/admin/analytics");
                            setMobileMenuOpen(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left"
                        >
                          <BarChart3 className="w-4 h-4 text-muted-foreground" />{" "}
                          Аналитика
                        </button>
                        <button
                          onClick={() => {
                            navigate("/admin/teams");
                            setMobileMenuOpen(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left"
                        >
                          <Users className="w-4 h-4 text-muted-foreground" />{" "}
                          Команды
                        </button>
                      </>
                    )}
                  </>
                )}
                <div className="border-t border-border my-1" />
                {user ? (
                  <button
                    onClick={() => {
                      signOut();
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm text-foreground text-left"
                  >
                    <LogOut className="w-4 h-4 text-muted-foreground" /> Выйти
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      navigate("/auth");
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-navy text-primary-foreground hover:bg-navy-light transition-colors text-sm font-medium"
                  >
                    <LogIn className="w-4 h-4" /> Войти
                  </button>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <EmailVerificationBanner />
      <SubscriptionBanner />
      <main className="container max-w-5xl mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">
            Расшифровка аудио <span className="text-gold-dark">по ролям</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Загрузите аудио или видеозаписи, или запишите голос — получите
            текстовые протоколы с разделением по участникам
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-4"
        >
          <AudioDropZone
            ref={fileInputRef}
            onFilesSelect={handleAddFiles}
            onRecordClick={handleOpenRecorder}
          />
        </motion.div>

        <AnimatePresence>
          {showRecorder && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              <AudioRecorder
                onClose={() => setShowRecorder(false)}
                onRecordingComplete={handleRecordingComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {!hasQueueVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12"
          >
            {[
              {
                title: "Диаризация",
                desc: "Автоматическое определение и разделение по спикерам",
              },
              {
                title: "Точность",
                desc: "Высокая точность распознавания юридической терминологии",
              },
              {
                title: "Экспорт",
                desc: "Скачивание готового протокола в формате .docx",
              },
              {
                title: "Удобное редактирование",
                desc: "Редактируйте расшифровку по абзацам с одновременным прослушиванием",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="p-5 rounded-xl bg-card border border-border text-center"
              >
                <h3 className="font-serif font-semibold text-foreground mb-1">
                  {f.title}
                </h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </motion.div>
        )}

        {hasQueueVisible && (
          <div className="space-y-3">
            <AnimatePresence>
              {activeItems.map((item) => (
                <FileQueueItem
                  key={item.id}
                  item={item}
                  onCancel={() => cancelItem(item.id)}
                  onRemove={() => dismissQueueItem(item.id)}
                  onRetry={() => retryItem(item.id)}
                  onRenameSpeaker={(orig, newName) =>
                    renameSpeaker(item.id, orig, newName)
                  }
                />
              ))}
              {savedToHistoryItems.map((item) => (
                <SavedToHistoryCard
                  key={item.id}
                  fileName={item.file.name}
                  segmentCount={item.segments?.length}
                  onOpenHistory={() => {
                    dismissQueueItem(item.id);
                    openHistory();
                  }}
                  onDismiss={() => dismissQueueItem(item.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <SupportSection />
    </div>
  );
};

export default Index;
