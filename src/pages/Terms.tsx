import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "@/lib/siteContact";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 relative">
        <div className="container max-w-3xl mx-auto flex items-center justify-between py-4 px-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Вернуться к приложению</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <MobileNav showHome={false} />
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">

        <h1 className="text-3xl font-bold font-playfair text-foreground mb-2">
          Условия использования
        </h1>
        <p className="text-muted-foreground mb-8">Последнее обновление: {new Date().toLocaleDateString('ru-RU')}</p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground font-playfair">1. Общие положения</h2>
            <p>Настоящие Условия использования (далее — «Условия») регулируют порядок использования сервиса «ПротоколЪ» (далее — «Сервис»), предназначенного для расшифровки аудиозаписей судебных заседаний, переговоров и совещаний.</p>
            <p>Используя Сервис, вы подтверждаете, что ознакомились с настоящими Условиями и принимаете их в полном объёме.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-playfair">2. Описание Сервиса</h2>
            <p>Сервис «ПротоколЪ» предоставляет следующие функции:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Расшифровка аудио- и видеозаписей с диаризацией по спикерам</li>
              <li>Указание количества спикеров для повышения точности диаризации</li>
              <li>Запись аудио через встроенный диктофон</li>
              <li>Переименование, объединение и переназначение спикеров</li>
              <li>Редактирование текста расшифровки с визуальной индикацией сохранения</li>
              <li>Автоматическая замена слов по настраиваемым правилам</li>
              <li>Экспорт результатов в формат DOCX</li>
              <li>ИИ-анализ и формирование резюме расшифровок</li>
              <li>Хранение истории расшифровок с воспроизведением аудио, поиском по содержимому и фильтрацией по дате</li>
              <li>Регулировка скорости воспроизведения и громкости</li>
              <li>Тарифные планы: бесплатный (3 расшифровки), базовый (30/мес), профессиональный (без ограничений)</li>
              <li>Страница преимуществ и тарифов, доступная всем посетителям без регистрации</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-playfair">3. Регистрация и учётная запись</h2>
            <p>Для использования Сервиса необходима регистрация. При регистрации пользователь даёт согласие на обработку персональных данных в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных» и <a href="/privacy" className="text-primary hover:underline">Политикой конфиденциальности</a> Сервиса.</p>
            <p>Вы обязуетесь:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Предоставить достоверные данные при регистрации</li>
              <li>Обеспечить сохранность логина и пароля</li>
              <li>Незамедлительно уведомлять о несанкционированном доступе к учётной записи</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-playfair">4. Права и обязанности пользователя</h2>
            <p><strong>Пользователь вправе:</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Использовать Сервис в соответствии с его назначением</li>
              <li>Загружать аудио- и видеофайлы для расшифровки</li>
              <li>Экспортировать и скачивать результаты расшифровки</li>
              <li>Удалить учётную запись и все свои данные</li>
              <li>Отозвать согласие на обработку персональных данных путём удаления учётной записи</li>
            </ul>
            <p className="mt-3"><strong>Пользователь обязуется:</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Не загружать материалы, нарушающие законодательство РФ</li>
              <li>Не использовать Сервис для обработки материалов, содержащих государственную тайну</li>
              <li>Не предпринимать попыток несанкционированного доступа к Сервису</li>
              <li>Иметь законные основания для обработки загружаемых аудиозаписей</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-playfair">5. Интеллектуальная собственность</h2>
            <p>Все права на Сервис, включая программный код, дизайн, товарные знаки и иные объекты интеллектуальной собственности, принадлежат правообладателю Сервиса.</p>
            <p>Результаты расшифровки принадлежат пользователю, загрузившему исходный аудиофайл.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-playfair">6. Ограничение ответственности</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Сервис предоставляется «как есть» (as is). Мы не гарантируем 100% точность расшифровки.</li>
              <li>Результаты расшифровки не являются официальным юридическим документом без соответствующего заверения.</li>
              <li>Мы не несём ответственности за содержание загруженных пользователем аудиозаписей.</li>
              <li>Мы не несём ответственности за убытки, возникшие в результате использования или невозможности использования Сервиса.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-playfair">7. Тарифные планы и оплата</h2>
            <p>Сервис может предоставляться на платной основе. Актуальные тарифы размещены на сайте Сервиса. Оператор вправе изменять тарифы, уведомив пользователей не менее чем за 14 дней.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-playfair">8. Прекращение использования</h2>
            <p>Мы оставляем за собой право приостановить или прекратить доступ пользователя к Сервису в случае нарушения настоящих Условий. Пользователь может удалить свою учётную запись в любое время. При удалении учётной записи все персональные данные уничтожаются в течение 30 дней.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-playfair">9. Применимое право</h2>
            <p>Настоящие Условия регулируются законодательством Российской Федерации. Все споры разрешаются в соответствии с действующим законодательством РФ.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground font-playfair">10. Контакты</h2>
            <p>По вопросам, связанным с использованием Сервиса: <a href={`mailto:${SUPPORT_EMAIL_MAILTO}`} className="text-primary font-medium hover:underline">{SUPPORT_EMAIL}</a></p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
