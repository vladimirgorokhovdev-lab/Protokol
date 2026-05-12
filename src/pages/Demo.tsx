import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Upload,
  Mic,
  Users,
  FileText,
  Pencil,
  Scissors,
  Merge,
  Undo2,
  RefreshCw,
  Play,
  Download,
  Search,
  History,
  Volume2,
  CheckCircle2,
  ArrowRight,
  MousePointer,
  ChevronRight,
  Sparkles,
  Calendar,
  Banknote,
  User,
  Building2,
  Folder,
  Tag,
  Inbox,
  Combine,
  Music,
  UsersRound,
  Mail,
  Crown,
  ClipboardList,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";

interface DemoStep {
  icon: React.ElementType;
  title: string;
  description: string;
  visual: React.ReactNode;
  tip?: string;
}

const MockPlayer = () => (
  <div className="rounded-xl bg-background/80 border border-border p-3 flex items-center gap-2">
    <div className="p-1.5 rounded-full bg-navy">
      <Play className="w-3 h-3 text-primary-foreground ml-0.5" />
    </div>
    <span className="text-[10px] font-mono text-muted-foreground">01:23</span>
    <div className="flex-1 h-1.5 bg-muted rounded-full">
      <div className="h-full w-[35%] bg-gold rounded-full" />
    </div>
    <span className="text-[10px] font-mono text-muted-foreground">04:15</span>
    <Volume2 className="w-3 h-3 text-muted-foreground" />
    <Download className="w-3 h-3 text-muted-foreground" />
  </div>
);

const MockSegment = ({
  speaker,
  text,
  active,
  edited,
  time,
}: {
  speaker: string;
  text: string;
  active?: boolean;
  edited?: boolean;
  time: string;
}) => (
  <div
    className={`rounded-lg border p-2.5 text-xs transition-all ${active ? "border-gold/50 bg-gold/5 ring-1 ring-gold/20" : "border-border bg-card"}`}
  >
    <div className="flex items-center gap-2 mb-1">
      <span className="px-1.5 py-0.5 rounded bg-navy/10 text-navy dark:bg-navy/30 dark:text-blue-300 font-medium text-[10px]">
        {speaker}
      </span>
      <span className="text-[10px] text-gold/70 font-mono cursor-pointer hover:text-gold">
        {time}
      </span>
      {edited && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
    </div>
    <p className="text-muted-foreground leading-relaxed text-[11px]">{text}</p>
  </div>
);

const MockDropZone = () => (
  <div className="rounded-xl border-2 border-dashed border-gold/30 bg-gold/5 p-6 flex flex-col items-center gap-2">
    <Upload className="w-8 h-8 text-gold/60" />
    <p className="text-xs text-muted-foreground">
      Перетащите аудио- или видеофайл
    </p>
    <div className="flex gap-1.5 mt-1">
      {["MP3", "WAV", "MP4", "MOV", "MKV"].map((f) => (
        <span
          key={f}
          className="px-1.5 py-0.5 rounded bg-muted text-[9px] text-muted-foreground font-mono"
        >
          {f}
        </span>
      ))}
    </div>
  </div>
);

const MockRecorder = () => (
  <div className="rounded-xl bg-card border border-border p-4 flex items-center gap-3">
    <div className="w-10 h-10 rounded-full bg-destructive/10 border-2 border-destructive flex items-center justify-center animate-pulse">
      <Mic className="w-4 h-4 text-destructive" />
    </div>
    <div className="flex-1">
      <p className="text-xs font-medium text-foreground">Запись…</p>
      <p className="text-[10px] text-muted-foreground font-mono">00:12</p>
    </div>
    <div className="flex gap-0.5">
      {[3, 5, 8, 6, 4, 7, 9, 5, 3, 6, 8, 4].map((h, i) => (
        <div
          key={i}
          className="w-0.5 bg-destructive/60 rounded-full"
          style={{ height: `${h * 2}px` }}
        />
      ))}
    </div>
  </div>
);

const MockSpeakerLegend = () => (
  <div className="rounded-xl bg-card border border-border p-3 flex flex-wrap gap-2">
    {[
      { name: "Судья", color: "bg-blue-500" },
      { name: "Истец", color: "bg-emerald-500" },
      { name: "Ответчик", color: "bg-amber-500" },
    ].map((s) => (
      <div
        key={s.name}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted text-xs"
      >
        <div className={`w-2 h-2 rounded-full ${s.color}`} />
        <span className="text-foreground font-medium">{s.name}</span>
        <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
      </div>
    ))}
    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50 text-[10px] text-muted-foreground">
      <Merge className="w-2.5 h-2.5" /> Объединить
    </div>
  </div>
);

const MockUndoRedo = () => (
  <div className="flex items-center gap-1.5">
    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground">
      <Undo2 className="w-3 h-3" /> Отменить
    </button>
    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-muted-foreground">
      <ArrowRight className="w-3 h-3" /> Вернуть
    </button>
  </div>
);

const MockSearchBar = () => (
  <div className="rounded-xl bg-card border border-border p-2 flex items-center gap-2">
    <Search className="w-3.5 h-3.5 text-muted-foreground" />
    <span className="text-xs text-muted-foreground">юрисдикция</span>
    <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
      <span className="px-1.5 py-0.5 rounded bg-gold/20 text-gold font-medium">
        3 / 12
      </span>
    </div>
  </div>
);

const MockExportButtons = () => (
  <div className="flex gap-2">
    {[{ label: ".docx", desc: "Протокол Word" }].map((b) => (
      <div
        key={b.label}
        className="flex-1 rounded-lg bg-card border border-border p-2.5 text-center"
      >
        <FileText className="w-4 h-4 text-gold mx-auto mb-1" />
        <p className="text-[10px] font-medium text-foreground">{b.label}</p>
        <p className="text-[9px] text-muted-foreground">{b.desc}</p>
      </div>
    ))}
  </div>
);

const MockAISummary = () => (
  <div className="rounded-xl border border-gold/30 bg-gradient-to-br from-gold/5 to-transparent overflow-hidden">
    <div className="p-3 border-b border-gold/20 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-gold" />
        <span className="font-serif font-semibold text-foreground text-xs">
          AI-анализ
        </span>
        <span className="text-[10px] text-muted-foreground">
          · Нейтральный тон
        </span>
      </div>
    </div>
    <div className="p-3 space-y-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed text-justify indent-6">
        Судебное заседание по гражданскому делу №4521. Обсуждалось ходатайство
        истца о приобщении дополнительных документов. Ответчик возражал против
        их принятия...
      </p>
      <div>
        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Ключевые моменты (3)
        </p>
        <ul className="space-y-1">
          {[
            "Ходатайство истца о приобщении документов",
            "Возражение ответчика по процедурным основаниям",
            "Назначение допроса свидетеля на следующее заседание",
          ].map((p, i) => (
            <li
              key={i}
              className="flex gap-1.5 text-[10px] text-muted-foreground"
            >
              <span className="text-gold mt-0.5">•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Задачи и поручения (2)
        </p>
        <ul className="space-y-1">
          {[
            {
              task: "Подготовить письменную позицию по ходатайству",
              assignee: "Ответчик",
            },
            {
              task: "Обеспечить явку свидетеля на следующее заседание",
              assignee: "Истец",
            },
          ].map((a, i) => (
            <li
              key={i}
              className="flex gap-1.5 text-[10px] text-muted-foreground"
            >
              <CheckCircle2 className="w-3 h-3 text-gold mt-0.5 flex-shrink-0" />
              <span>
                {a.task}{" "}
                <span className="text-muted-foreground/70">— {a.assignee}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

const MockNextButton = () => (
  <div className="flex items-center gap-2 rounded-lg bg-gold/10 border border-gold/30 px-3 py-2">
    <Play className="w-3 h-3 text-gold" />
    <span className="text-xs text-foreground font-medium">Далее</span>
    <span className="text-[10px] text-muted-foreground">
      → непрерывное воспроизведение
    </span>
  </div>
);

const demoSteps: DemoStep[] = [
  {
    icon: Upload,
    title: "1. Загрузите файл",
    description:
      "Перетащите аудио/видеофайл в зону загрузки или выберите его с устройства. Поддерживаются MP3, WAV, OGG, MP4, MOV, AVI и другие форматы. Ограничений на размер нет.",
    visual: <MockDropZone />,
    tip: "Видео можно загрузить файлом — звук будет извлечён автоматически",
  },
  {
    icon: Mic,
    title: "2. Или запишите голос",
    description:
      "Нажмите кнопку записи или Ctrl+R для диктовки прямо в браузере. Запись автоматически отправляется на расшифровку.",
    visual: <MockRecorder />,
  },
  {
    icon: Users,
    title: "3. Автоматическая диаризация",
    description:
      "Система определяет участников разговора и разделяет текст по спикерам. Укажите число спикеров перед загрузкой для повышения точности.",
    visual: (
      <div className="space-y-2">
        <MockSpeakerLegend />
        <MockSegment
          speaker="Судья"
          text="Слушание по делу номер 4521 объявляется открытым."
          time="00:05"
        />
        <MockSegment
          speaker="Истец"
          text="Ваша честь, прошу приобщить к материалам дела документы..."
          time="00:18"
          active
        />
      </div>
    ),
  },
  {
    icon: Pencil,
    title: "4. Редактируйте расшифровку",
    description:
      "Нажмите на текст фрагмента для редактирования. Бейдж спикера в шапке переименовывает его глобально (для всех фрагментов), а бейдж внутри окна редактирования — переназначает только текущий фрагмент. Отредактированные фрагменты отмечаются зелёной галочкой.",
    visual: (
      <div className="space-y-2">
        <MockSegment
          speaker="Судья"
          text="Слушание по делу номер 4521 объявляется открытым."
          time="00:05"
          edited
        />
        <MockSegment
          speaker="Истец"
          text="Ваша честь, прошу приобщить к материалам дела документы, подтверждающие..."
          time="00:18"
        />
        <MockUndoRedo />
      </div>
    ),
    tip: "Шапка = глобально, окно редактирования = только этот фрагмент",
  },
  {
    icon: Scissors,
    title: "5. Разделяйте и объединяйте",
    description:
      "Разделите длинный фрагмент ножницами ✂ или объедините соседние кнопкой ⎇. Переназначьте фрагмент другому спикеру через клик на бейдж.",
    visual: (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 rounded-lg border border-dashed border-gold/40 bg-gold/5 p-2 text-[10px] text-muted-foreground">
            Фрагмент A
          </div>
          <Scissors className="w-3.5 h-3.5 text-gold flex-shrink-0" />
          <div className="flex-1 rounded-lg border border-dashed border-gold/40 bg-gold/5 p-2 text-[10px] text-muted-foreground">
            Фрагмент B
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 rounded-lg border border-border bg-card p-2 text-[10px] text-muted-foreground">
            Фрагмент 1
          </div>
          <Merge className="w-3.5 h-3.5 text-gold flex-shrink-0" />
          <div className="flex-1 rounded-lg border border-border bg-card p-2 text-[10px] text-muted-foreground">
            Фрагмент 2
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 rounded-lg border border-gold/30 bg-gold/5 p-2 text-[10px] text-gold font-medium">
            Объединённый
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Volume2,
    title: "6. Слушайте с синхронизацией",
    description:
      "Нажмите на таймкод — плеер воспроизведёт этот фрагмент и остановится. Нажмите «Далее» для перехода в непрерывный режим. Расшифровка прокручивается синхронно.",
    visual: (
      <div className="space-y-2">
        <MockPlayer />
        <MockSegment
          speaker="Судья"
          text="Принимается. Переходим к допросу свидетеля."
          time="02:41"
          active
        />
        <MockNextButton />
      </div>
    ),
    tip: "Пробел — пауза/воспроизведение, ← → — перемотка 5 сек",
  },
  {
    icon: RefreshCw,
    title: "7. Автозамена слов",
    description:
      "Настройте правила замены: исправляйте типичные ошибки распознавания или заменяйте сокращения. Каждое новое правило срабатывает в открытой расшифровке сразу после добавления — система предложит принять или отклонить каждую замену.",
    visual: (
      <div className="rounded-xl bg-card border border-border p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-destructive/10 text-destructive line-through">
            истец
          </span>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600">
            Истец Иванов А.А.
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-destructive/10 text-destructive line-through">
            суд
          </span>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600">
            Арбитражный суд
          </span>
        </div>
      </div>
    ),
  },
  {
    icon: Search,
    title: "8. Поиск по тексту и истории",
    description:
      "Ctrl+F мгновенно подсветит совпадения внутри расшифровки. На странице «История» поиск работает сразу по тексту всех ваших записей — рядом с каждой показано количество совпадений и сниппет с найденной фразой.",
    visual: (
      <div className="space-y-2">
        <MockSearchBar />
        <div className="rounded-lg border border-border bg-card p-2.5">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] font-medium text-foreground truncate flex-1">
              Заседание_12.04.mp3
            </span>
            <span className="px-1.5 py-0.5 rounded bg-gold/20 text-gold text-[9px] font-medium">
              5 совп.
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground italic line-clamp-2">
            «…вопрос о{" "}
            <span className="bg-gold/30 text-foreground rounded px-0.5">
              юрисдикции
            </span>{" "}
            рассматривается в порядке…»
          </p>
        </div>
      </div>
    ),
    tip: "Можно искать по спикеру, номеру дела, тегам или диапазону дат",
  },
  {
    icon: Sparkles,
    title: "9. AI-резюме и анализ",
    description:
      "Получите краткое содержание расшифровки с выделением ключевых моментов, упоминаемых лиц, дат и сумм. AI определяет тон разговора и формирует список задач.",
    visual: <MockAISummary />,
    tip: "AI-резюме можно скопировать и включить в экспорт",
  },
  {
    icon: FileText,
    title: "10. Экспорт протокола",
    description:
      "Скачайте расшифровку в Word (.docx) — оформленную как официальный протокол, или в текстовом формате.",
    visual: <MockExportButtons />,
  },
  {
    icon: Combine,
    title: "11. Объединение нескольких расшифровок",
    description:
      "В разделе «История» отметьте 2 и более записей чекбоксами и нажмите «Объединить» — они склеятся в один протокол с сохранением порядка. Спикеры с одинаковыми именами объединяются автоматически.",
    visual: (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2 items-center">
          <div className="rounded-lg border border-gold/40 bg-gold/5 p-2 text-center">
            <FileText className="w-3.5 h-3.5 text-gold mx-auto mb-1" />
            <p className="text-[10px] text-foreground font-medium truncate">
              Засед_1.mp3
            </p>
            <p className="text-[9px] text-muted-foreground">12:35</p>
          </div>
          <div className="rounded-lg border border-gold/40 bg-gold/5 p-2 text-center">
            <FileText className="w-3.5 h-3.5 text-gold mx-auto mb-1" />
            <p className="text-[10px] text-foreground font-medium truncate">
              Засед_2.mp3
            </p>
            <p className="text-[9px] text-muted-foreground">08:42</p>
          </div>
          <div className="rounded-lg border border-gold/40 bg-gold/5 p-2 text-center">
            <FileText className="w-3.5 h-3.5 text-gold mx-auto mb-1" />
            <p className="text-[10px] text-foreground font-medium truncate">
              Засед_3.mp3
            </p>
            <p className="text-[9px] text-muted-foreground">15:08</p>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-primary-foreground text-[11px] font-medium">
            <Combine className="w-3 h-3" /> Объединить (3)
          </div>
        </div>
        <div className="rounded-lg border border-gold/40 bg-gold/10 p-2 text-center">
          <p className="text-[10px] text-foreground font-medium">
            Объединённый протокол · 36:25
          </p>
        </div>
      </div>
    ),
    tip: "После склейки можно сразу пересобрать AI-резюме для всего протокола",
  },
  {
    icon: Music,
    title: "12. Склейка аудио объединённой расшифровки",
    description:
      "В шапке объединённой расшифровки отображается панель исходных аудиофайлов. Нажмите «Объединить аудио» — сервер склеит файлы одного формата в один трек, доступный в плеере и для скачивания.",
    visual: (
      <div className="space-y-2">
        <div className="rounded-xl bg-card border border-border p-2.5 space-y-1.5">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Исходные аудио (3)
          </p>
          {["Засед_1.mp3", "Засед_2.mp3", "Засед_3.mp3"].map((f) => (
            <div
              key={f}
              className="flex items-center gap-2 px-2 py-1 rounded bg-muted/50"
            >
              <Music className="w-3 h-3 text-gold" />
              <span className="text-[10px] text-foreground flex-1 truncate">
                {f}
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">
                MP3
              </span>
            </div>
          ))}
          <button className="w-full mt-1.5 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-gold/10 border border-gold/30 text-[10px] text-gold font-medium">
            <Combine className="w-3 h-3" /> Объединить аудио
          </button>
        </div>
        <MockPlayer />
      </div>
    ),
    tip: "Работает для файлов одного формата (все MP3 или все WAV)",
  },
  {
    icon: History,
    title: "13. История, папки и теги",
    description:
      "Все расшифровки сохраняются в аккаунте. Организуйте записи по делам в папках с номерами дел, помечайте тегами («Арбитраж», «Допрос», «Срочно») и быстро находите нужное через сайдбар или фильтры.",
    visual: (
      <div className="flex gap-2">
        <div className="w-28 flex-shrink-0 space-y-1">
          <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
            Папки
          </p>
          <div className="px-2 py-1 rounded bg-muted text-[10px] text-foreground font-medium flex items-center gap-1.5">
            <Inbox className="w-3 h-3" /> Все{" "}
            <span className="ml-auto">12</span>
          </div>
          <div className="px-2 py-1 rounded text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Folder className="w-3 h-3 text-blue-500" />{" "}
            <span className="truncate">Дело №4521</span>
          </div>
          <div className="px-2 py-1 rounded text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Folder className="w-3 h-3 text-emerald-500" />{" "}
            <span className="truncate">Иванов А.А.</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {[
            {
              name: "Заседание_12.04.mp3",
              time: "12:35",
              folder: "Дело №4521",
              folderColor: "text-blue-500",
              tags: [{ n: "Арбитраж", c: "#d4af37" }],
            },
            {
              name: "Допрос_свидетеля.wav",
              time: "45:12",
              folder: "Иванов А.А.",
              folderColor: "text-emerald-500",
              tags: [
                { n: "Допрос", c: "#3b82f6" },
                { n: "Срочно", c: "#ef4444" },
              ],
            },
          ].map((r) => (
            <div
              key={r.name}
              className="rounded-lg bg-card border border-border p-2"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">
                    {r.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-muted-foreground">
                      {r.time}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-[9px] ${r.folderColor}`}
                    >
                      <Folder className="w-2.5 h-2.5" /> {r.folder}
                    </span>
                  </div>
                </div>
                <Download className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {r.tags.map((t) => (
                  <span
                    key={t.n}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-medium border"
                    style={{
                      backgroundColor: `${t.c}20`,
                      color: t.c,
                      borderColor: `${t.c}50`,
                    }}
                  >
                    {t.n}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    tip: "Папка может содержать номер дела — он используется при поиске",
  },
  {
    icon: UsersRound,
    title: "14. Команда и совместная работа",
    description:
      "Создайте команду, переименуйте её и пригласите коллег по email или одноразовой ссылке. Роли участников помечены бейджами «Владелец/Участник». Владельца удалить нельзя — система предупредит. Активные приглашения можно отозвать одной кнопкой, дубликаты блокируются автоматически.",
    visual: (
      <div className="space-y-2">
        <div className="rounded-xl bg-card border border-border p-3 space-y-1.5">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Участники
          </p>
          {[
            { name: "Анна Петрова", email: "anna@law.ru", role: "owner" },
            { name: "Иван Сидоров", email: "ivan@law.ru", role: "member" },
            { name: "Мария Козлова", email: "maria@law.ru", role: "member" },
          ].map((m) => (
            <div
              key={m.email}
              className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-foreground font-medium truncate">
                  {m.name}
                </p>
                <p className="text-[9px] text-muted-foreground truncate">
                  {m.email}
                </p>
              </div>
              {m.role === "owner" ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold/15 text-[9px] text-gold-dark font-medium">
                  <Crown className="w-2.5 h-2.5" /> Владелец
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[9px] text-muted-foreground font-medium">
                  Участник
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-card border border-border p-3 space-y-1.5">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Активные приглашения
          </p>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/50">
            <Mail className="w-3 h-3 text-gold" />
            <span className="text-[10px] text-foreground flex-1 truncate">
              novyy@law.ru
            </span>
            <button className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[9px] font-medium">
              <X className="w-2.5 h-2.5" /> Отозвать
            </button>
          </div>
        </div>
      </div>
    ),
    tip: "Повторное приглашение того же email блокируется, если он уже в команде",
  },
  {
    icon: ClipboardList,
    title: "15. Журнал действий команды",
    description:
      "Владельцу доступна хронология всех изменений: переименования, приглашения, отзывы, добавления и удаления участников. Каждая запись содержит дату, автора и описание. Журнал обновляется в реальном времени.",
    visual: (
      <div className="rounded-xl bg-card border border-border p-3 space-y-2">
        {[
          {
            icon: Mail,
            text: "Анна Петрова пригласила novyy@law.ru",
            time: "5 мин назад",
          },
          {
            icon: UsersRound,
            text: "Иван Сидоров присоединился к команде",
            time: "2 ч назад",
          },
          {
            icon: Pencil,
            text: "Анна Петрова переименовала команду в «Юр. бюро Петрова»",
            time: "вчера",
          },
          { icon: Crown, text: "Команда создана", time: "3 дня назад" },
        ].map((e, i) => (
          <div
            key={i}
            className="flex items-start gap-2 px-2 py-1.5 rounded bg-muted/30"
          >
            <e.icon className="w-3 h-3 text-gold mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-foreground leading-snug">
                {e.text}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {e.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    ),
    tip: "Ошибки приглашения и удаления показывают понятную причину с кнопкой «Повторить»",
  },
];

const Demo = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 relative">
        <div className="container max-w-5xl mx-auto flex items-center justify-between py-4 px-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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

      <main className="container max-w-3xl mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground mb-3">
            Как работает Протокол<span className="text-gold">Ъ</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Пошаговая демонстрация всех возможностей сервиса — от загрузки аудио
            до готового протокола
          </p>
        </motion.div>

        <div className="space-y-8">
          {demoSteps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-2xl bg-card border border-border overflow-hidden"
            >
              <div className="p-5 pb-3 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy/10 dark:bg-navy/30 flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-5 h-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-serif font-semibold text-foreground text-lg mb-1">
                    {step.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-4">
                <div className="rounded-xl bg-muted/30 border border-border/50 p-3">
                  {step.visual}
                </div>
              </div>

              {step.tip && (
                <div className="px-5 pb-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gold/5 border border-gold/20">
                    <MousePointer className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                    <span className="text-xs text-gold/90">{step.tip}</span>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12 space-y-4"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-navy text-primary-foreground hover:bg-navy-light transition-colors font-medium"
          >
            Попробовать <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-sm text-muted-foreground">
            <Link to="/guide" className="text-gold hover:underline">
              Подробное руководство
            </Link>
            {" · "}
            <Link to="/pricing" className="text-gold hover:underline">
              Тарифы
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default Demo;
