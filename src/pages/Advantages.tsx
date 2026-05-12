import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mic, Briefcase, Zap, Users, Smartphone, Video, ArrowLeft, Shield, FileText, Brain, UsersRound, History as HistoryIcon } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";

const advantages = [
  {
    icon: Mic,
    title: "Встроенный диктофон",
    desc: "Записывайте аудио прямо в приложении — единственный сервис на рынке с такой функцией. Не нужны сторонние приложения для записи.",
  },
  {
    icon: Briefcase,
    title: "Юридическая специализация",
    desc: "Автозамена юридических терминов и AI-саммари, специально настроенные для протоколов судебных заседаний и переговоров.",
  },
  {
    icon: Users,
    title: "Переименование спикеров",
    desc: "Гибкая настройка ролей участников: Судья, Истец, Ответчик, Адвокат и другие. Автоматическая диаризация по голосам.",
  },
  {
    icon: Zap,
    title: "Управление очередью",
    desc: "Параллельная обработка нескольких файлов с индивидуальным прогрессом каждого. Загружайте сразу все записи.",
  },
  {
    icon: Video,
    title: "Поддержка видео",
    desc: "Расшифровка не только аудио, но и видеофайлов — MP4, MOV, AVI, MKV. Извлечение звука происходит автоматически.",
  },
  {
    icon: Smartphone,
    title: "PWA-приложение",
    desc: "Работает как нативное приложение на телефоне, планшете и компьютере. Установите на рабочий стол одним нажатием.",
  },
  {
    icon: Brain,
    title: "AI-саммари",
    desc: "Искусственный интеллект создаёт краткое содержание расшифровки — ключевые тезисы и выводы за секунды.",
  },
  {
    icon: FileText,
    title: "Экспорт в Word",
    desc: "Скачивание готового протокола в формате .docx с оформлением — шрифт Times New Roman, нумерация, шапка документа.",
  },
  {
    icon: UsersRound,
    title: "Командная работа",
    desc: "Создайте команду, пригласите коллег по email или ссылке. Роли «Владелец/Участник», защита от удаления владельца, понятные ошибки с кнопкой повтора.",
  },
  {
    icon: HistoryIcon,
    title: "Журнал действий команды",
    desc: "Владелец видит хронологию всех изменений: переименования, приглашения, отзывы, добавления и удаления участников — с датой и автором.",
  },
  {
    icon: Shield,
    title: "Конфиденциальность",
    desc: "Ваши аудиозаписи обрабатываются безопасно. Данные защищены в соответствии с ФЗ-152 о персональных данных.",
  },
];

const Advantages = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 relative">
        <div className="container max-w-5xl mx-auto flex items-center justify-between py-4 px-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">На главную</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <MobileNav showHome={false} />
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">
            Наши <span className="text-gold-dark">преимущества</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Почему юристы выбирают ПротоколЪ для расшифровки аудиозаписей
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {advantages.map((advantage, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="p-6 rounded-xl bg-card border border-border hover:border-gold-dark/50 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-navy/10 text-gold-dark group-hover:bg-navy/20 transition-colors shrink-0">
                  <advantage.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-serif font-semibold text-foreground mb-1.5">
                    {advantage.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {advantage.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Advantages;
