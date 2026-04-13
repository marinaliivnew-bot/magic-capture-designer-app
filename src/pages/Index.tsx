import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjects, getBrief } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader as Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProgressTextColor } from "@/components/ui/progress";

const Index = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      if (!data || data.length === 0) {
        setProjects([]);
        return;
      }
      const projectsWithCompleteness = await Promise.all(
        data.map(async (project: any) => {
          try {
            const brief = await getBrief(project.id);
            return {
              ...project,
              completeness_score: brief?.completeness_score || 0,
            };
          } catch {
            return { ...project, completeness_score: 0 };
          }
        })
      );
      setProjects(projectsWithCompleteness);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-6 sm:px-12 py-4 flex items-center justify-between">
          <a href="/" className="font-display text-xl text-foreground hover:text-primary transition-colors duration-350">
            Brief → Concept
          </a>
          <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>
            Мои стандарты
          </Button>
        </div>
      </header>

      {/* ЗОНА 1 — HERO */}
      <section className="min-h-screen flex items-center py-12 sm:py-[80px] px-6 sm:px-12">
        <div className="mx-auto max-w-7xl w-full">
          <div className="grid grid-cols-1 md:grid-cols-[60%_40%] gap-12 items-center">
            {/* Left column */}
            <div>
              <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary mb-3">
                Для дизайнеров интерьера
              </p>
              <h1 className="font-display text-[36px] sm:text-[52px] text-[#1A1A1A] leading-[1.15] mb-5">
                Меньше итераций.
                <br />
                Быстрее согласование.
              </h1>
              <p className="font-body text-[17px] text-[#5A5248] leading-[1.6] max-w-[440px] mb-8">
                Загрузите переписку с клиентом и чертёж — получите бриф, риски и концепт-борд за минуты.
              </p>
              <Button
                onClick={() => navigate("/new")}
                className="px-10 py-[14px] h-auto"
              >
                + Новый проект
              </Button>
            </div>

            {/* Right column - decorative cards (desktop only) */}
            <div className="hidden md:block relative h-[360px]">
              <div className="absolute top-0 left-0 w-[280px] h-[360px] bg-[#E0D8D0]" />
              <div className="absolute top-3 left-3 w-[280px] h-[360px] bg-[#EDE8E2]" />
              <div className="absolute top-6 left-6 w-[280px] h-[360px] bg-[#F2EDE8]" />
            </div>
          </div>
        </div>
      </section>

      {/* ЗОНА 2 — КАК ЭТО РАБОТАЕТ */}
      <section className="border-t border-[#D0C8C0] py-20 sm:py-24 px-6 sm:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary mb-16">
            Как это работает
          </p>

          {/* Шаг 1 */}
          <div className="border-b border-[#D0C8C0] pb-12 mb-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
              <div>
                <p className="font-display text-[40px] text-primary mb-2">01</p>
                <h3 className="font-body text-[13px] uppercase tracking-[0.1em] mb-4">Ввод данных</h3>
                <p className="font-body text-[16px] text-[#5A5248] leading-[1.6]">
                  Укажите тип и параметры помещения. Вставьте переписку с клиентом, свои заметки или транскрипт голосового сообщения в любом формате. Загрузите чертёж или план — AI распознает габариты и зоны автоматически.
                </p>
              </div>
              <div className="bg-[#EDE8E2] p-6">
                <p className="font-body text-[14px] text-[#5A5248] leading-[1.6]">
                  Принимает: переписку из мессенджеров · голосовые транскрипты · заметки после встречи · ссылки на референсы · чертежи JPG / PNG / PDF
                </p>
              </div>
            </div>
          </div>

          {/* Шаг 2 */}
          <div className="border-b border-[#D0C8C0] pb-12 mb-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
              <div>
                <p className="font-display text-[40px] text-primary mb-2">02</p>
                <h3 className="font-body text-[13px] uppercase tracking-[0.1em] mb-4">Структурированный бриф</h3>
                <p className="font-body text-[16px] text-[#5A5248] leading-[1.6]">
                  Вместо бесконечной анкеты — готовый бриф по 8 блокам: пользователи, сценарии, зоны, хранение, стиль, ограничения и критерии успеха. Каждое поле редактируемо и сохраняется автоматически.
                </p>
              </div>
              <div className="bg-[#EDE8E2] p-6">
                <p className="font-body text-[14px] text-[#5A5248] leading-[1.6]">
                  8 блоков брифа · прогресс-бар заполненности · все поля редактируются · автосохранение
                </p>
              </div>
            </div>
          </div>

          {/* Шаг 3 */}
          <div className="border-b border-[#D0C8C0] pb-12 mb-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
              <div>
                <p className="font-display text-[40px] text-primary mb-2">03</p>
                <h3 className="font-body text-[13px] uppercase tracking-[0.1em] mb-4">Риски и уточняющие вопросы</h3>
                <p className="font-body text-[16px] text-[#5A5248] leading-[1.6]">
                  Забудьте про правки после первой презентации. AI находит противоречия в требованиях — бюджет vs материалы, срок vs объём — и формирует список вопросов с приоритетами. Ответы клиента автоматически обновляют бриф.
                </p>
              </div>
              <div className="bg-[#EDE8E2] p-6">
                <p className="font-body text-[14px] text-[#5A5248] leading-[1.6]">
                  Детектор противоречий · вопросы Critical / Important / Optional · ответы клиента → обновление брифа
                </p>
              </div>
            </div>
          </div>

          {/* Шаг 4 */}
          <div className="pb-0">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
              <div>
                <p className="font-display text-[40px] text-primary mb-2">04</p>
                <h3 className="font-body text-[13px] uppercase tracking-[0.1em] mb-4">Концепт-борд и PDF</h3>
                <p className="font-body text-[16px] text-[#5A5248] leading-[1.6]">
                  Черновой концепт-борд из 5 блоков с изображениями и объяснением каждого решения — уже привязан к брифу. Два формата PDF: бриф с вопросами и полный концепт с бордом. Готово к отправке клиенту.
                </p>
              </div>
              <div className="bg-[#EDE8E2] p-6">
                <p className="font-body text-[14px] text-[#5A5248] leading-[1.6]">
                  5 блоков борда · изображения Unsplash · замена вручную · PDF бриф + PDF полный концепт
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ЗОНА 3 — ПРИМЕРЫ РЕЗУЛЬТАТА */}
      <section className="border-t border-[#D0C8C0] py-20 sm:py-24 px-6 sm:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary mb-16">
            Что получается на выходе
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Карточка 1 — Бриф */}
            <div className="border border-[#D0C8C0] bg-white">
              <div className="p-6">
                <h3 className="font-display text-[22px] text-[#1A1A1A] mb-4">
                  Структурированный бриф
                </h3>
                <div className="font-body text-[14px] text-[#5A5248] leading-[1.6] space-y-3">
                  <div>
                    <p className="font-medium text-[#1A1A1A] mb-1">ПОЛЬЗОВАТЕЛИ</p>
                    <p>Семья: 2 взрослых, ребёнок 7 лет, кот</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#1A1A1A] mb-1">СЦЕНАРИИ</p>
                    <p>Совместный ужин, работа из дома, игровая зона для ребёнка</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#1A1A1A] mb-1">СТИЛЬ</p>
                    <p>Скандинавский, светлое дерево, без розового и бирюзового</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#1A1A1A] mb-1">БЮДЖЕТ</p>
                    <p>До 800 000 руб · срок 3 месяца</p>
                  </div>
                </div>
              </div>
              <div className="bg-primary px-6 py-3">
                <p className="font-body text-[12px] uppercase tracking-[0.1em] text-white text-center">
                  Заполняется автоматически из переписки
                </p>
              </div>
            </div>

            {/* Карточка 2 — Вопросы */}
            <div className="border border-[#D0C8C0] bg-white">
              <div className="p-6">
                <h3 className="font-display text-[22px] text-[#1A1A1A] mb-4">
                  Уточняющие вопросы
                </h3>
                <div className="font-body text-[14px] text-[#5A5248] leading-[1.6] space-y-3">
                  <div>
                    <p className="font-medium text-[hsl(var(--color-critical))] mb-1">КРИТИЧНО</p>
                    <p>Где будет спать ребёнок — отдельная комната или зона в гостиной?</p>
                  </div>
                  <div>
                    <p className="font-medium text-primary mb-1">ВАЖНО</p>
                    <p>Нужно ли рабочее место с дверью или достаточно открытой зоны?</p>
                  </div>
                  <div>
                    <p className="font-medium text-primary mb-1">ВАЖНО</p>
                    <p>Какой тип хранения в прихожей — открытый или закрытый?</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#888] mb-1">ОПЦИОНАЛЬНО</p>
                    <p>Есть ли предпочтения по породе дерева?</p>
                  </div>
                </div>
              </div>
              <div className="bg-primary px-6 py-3">
                <p className="font-body text-[12px] uppercase tracking-[0.1em] text-white text-center">
                  Приоритеты: критично / важно / опционально
                </p>
              </div>
            </div>

            {/* Карточка 3 — Борд */}
            <div className="border border-[#D0C8C0] bg-white">
              <div className="p-6">
                <h3 className="font-display text-[22px] text-[#1A1A1A] mb-4">
                  Концепт-борд
                </h3>
                <div className="font-body text-[14px] text-[#5A5248] leading-[1.6] space-y-3">
                  <div>
                    <p className="font-medium text-[#1A1A1A] mb-1">АТМОСФЕРА</p>
                    <p>Скандинавская простота с живым теплом натурального дерева</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#1A1A1A] mb-1">ПАЛИТРА</p>
                    <p>Льняной · дымчатый белый · тёплый серый · акцент мох</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#1A1A1A] mb-1">МАТЕРИАЛЫ</p>
                    <p>Дуб беленый · льняной текстиль · керамика ручной работы</p>
                  </div>
                  <div>
                    <p className="font-medium text-[#1A1A1A] mb-1">МЕБЕЛЬ</p>
                    <p>Мягкие формы без декора, функциональное хранение</p>
                  </div>
                </div>
              </div>
              <div className="bg-primary px-6 py-3">
                <p className="font-body text-[12px] uppercase tracking-[0.1em] text-white text-center">
                  5 блоков · изображения · объяснение каждого решения
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ЗОНА 4 — МОИ ПРОЕКТЫ */}
      {!loading && projects.length > 0 && (
        <section className="border-t border-[#D0C8C0] py-20 sm:py-24 px-6 sm:px-12">
          <div className="mx-auto max-w-7xl">
            <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary mb-16">
              Мои проекты
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((p) => {
                const completeness = (p as any).completeness_score || 0;
                return (
                  <div
                    key={p.id}
                    className="border border-[#D0C8C0] bg-white p-6 cursor-pointer hover:border-primary transition-colors duration-350"
                    onClick={() => navigate(`/project/${p.id}/edit`)}
                  >
                    <h3 className="font-display text-[20px] text-[#1A1A1A] mb-2">
                      {p.name}
                    </h3>
                    <p className="font-body text-[13px] text-[#888888] mb-4">
                      {new Date(p.created_at).toLocaleDateString("ru-RU")}
                    </p>
                    <div className="mb-2">
                      <div className="h-[2px] bg-[#EDE8E2] mb-1">
                        <div
                          className={cn("h-full transition-all duration-350", completeness <= 40 ? "bg-[hsl(var(--color-critical))]" : completeness <= 70 ? "bg-primary" : "bg-primary")}
                          style={{ width: `${completeness}%` }}
                        />
                      </div>
                      <p className={cn("font-body text-[11px] uppercase tracking-[0.1em]", getProgressTextColor(completeness))}>
                        {completeness}% заполнен
                      </p>
                    </div>
                    <button className="font-body text-[13px] uppercase tracking-[0.1em] text-primary hover:text-foreground transition-colors duration-350 mt-4">
                      Открыть →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ЗОНА 5 — НИЖНИЙ CTA */}
      <section className="border-t border-[#D0C8C0] bg-[#EDE8E2] py-20 sm:py-24 px-6 sm:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-display italic text-[28px] text-[#1A1A1A] mb-8 leading-[1.4]">
            Попробуйте на реальном проекте — это займёт 5 минут
          </p>
          <Button
            onClick={() => navigate("/new")}
            className="px-10 py-[14px] h-auto"
          >
            + Новый проект
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
