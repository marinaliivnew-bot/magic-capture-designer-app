import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageCircleQuestion,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { deleteProject, getBrief, getDesignerProfile, getProjects } from "@/lib/api";
import { getSessionId } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { getProgressTextColor } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ProjectCard = {
  id: string;
  name: string;
  created_at: string;
  completeness_score?: number;
};

const transformations = [
  {
    before: "Разрозненные сообщения, голосовые заметки, план, Pinterest и короткое “хочу уютно, но не скучно”.",
    after: "Структурированный бриф: сценарии, зоны, хранение, стиль, табу, бюджет, сроки и критерии успеха.",
    beforeAccent: "border-l-[#B87952]",
    labelColor: "text-[#B87952]",
    afterIcon: "text-[#7A6F43]",
    afterTint: "#EEF0E6",
    afterBorder: "#7A6F43",
    sourceColor: "#B87952",
  },
  {
    before: "Клиент показывает референсы, но не всегда может объяснить, что именно в них нравится.",
    after: "Профиль вкуса клиента: доминирующие сигналы, отвергнутые элементы и внутренние противоречия.",
    beforeAccent: "border-l-[#7E4E3A]",
    labelColor: "text-[#7E4E3A]",
    afterIcon: "text-[#3F5F66]",
    afterTint: "#EAF1F2",
    afterBorder: "#3F5F66",
    sourceColor: "#7E4E3A",
  },
  {
    before: "Дизайнер держит свой стиль и правила в голове, а каждый новый проект приходится объяснять заново.",
    after: "Профиль дизайнера применяется повторно: портфолио, база знаний, визуальные оси, табу и стандарты.",
    beforeAccent: "border-l-[#425548]",
    labelColor: "text-[#425548]",
    afterIcon: "text-[#9A6A43]",
    afterTint: "#F3E9DE",
    afterBorder: "#9A6A43",
    sourceColor: "#425548",
  },
];

const workflow = [
  {
    number: "00",
    title: "Профиль дизайнера",
    text: "Один раз загружаются портфолио, мудборды, база знаний, личные табу и правила эргономики. AI формирует профиль: что видно в стиле и как применять это в проектах.",
    numberColor: "text-[#9A6A43]",
  },
  {
    number: "01",
    title: "Исходники проекта",
    text: "В проект попадают переписка, транскрипты, заметки после встречи, планы, фото объекта и ссылки на референсы. Это сырой материал, не анкета.",
    numberColor: "text-[#7E4E3A]",
  },
  {
    number: "02",
    title: "Бриф и помещения",
    text: "AI раскладывает вводные по 8 секциям брифа, извлекает помещения и размеры из текста или PDF-плана, показывает заполненность и оставляет дизайнеру ручное редактирование.",
    numberColor: "text-[#3F5F66]",
  },
  {
    number: "03",
    title: "Противоречия и вопросы",
    text: "Система ищет конфликты: бюджет против материалов, стиль против табу, размеры из разных источников, материалы против сценариев жизни. Вопросы получают приоритет и показывают, какой этап разблокируют.",
    numberColor: "text-[#B87952]",
  },
  {
    number: "04",
    title: "Вкус клиента × стиль дизайнера",
    text: "AI сопоставляет референсы клиента с вашим профилем. Совпадения идут в концепт, конфликты — подсвечиваются как вопрос к клиенту.",
    numberColor: "text-[#425548]",
  },
  {
    number: "05",
    title: "Концепт, проверка и фиксация",
    text: "Concept board собирается из атмосферы, RAL/NCS-палитры, материалов, мебели с габаритами и света. Затем добавляются эргономика, бюджет, render prompt и PDF для согласования.",
    numberColor: "text-[#8A5F3B]",
  },
];

const artifacts = [
  {
    title: "Профиль дизайнера",
    icon: SlidersHorizontal,
    purpose: "Один раз загружаете портфолио, мудборды, свои табу и правила. AI запоминает ваш стиль и логику — и каждый следующий бриф собирается уже от вашего лица, а не усреднённо.",
    use: "",
    iconColor: "text-[#7E4E3A]",
    accent: "#7E4E3A",
    tint: "#F4E8E2",
  },
  {
    title: "Проектный бриф",
    icon: ClipboardList,
    purpose: "Чтобы договориться о задаче до того, как начинается визуальная часть.",
    use: "Редактируется дизайнером и становится базой для вопросов, концепта, бюджета и PDF.",
    iconColor: "text-[#3F5F66]",
    accent: "#3F5F66",
    tint: "#EAF1F2",
  },
  {
    title: "Карта вопросов",
    icon: MessageCircleQuestion,
    purpose: "Чтобы не приносить на презентацию то, что клиент ещё не решил.",
    use: "Вопросы можно отправить клиенту, ответы возвращаются в бриф и обновляют проект.",
    iconColor: "text-[#B87952]",
    accent: "#B87952",
    tint: "#F6ECE5",
  },
  {
    title: "Согласованный стиль",
    icon: ShieldCheck,
    purpose: "Чтобы соединить вкус клиента с профессиональными стандартами дизайнера.",
    use: "Фиксирует совпадения, конфликты и разрешённые альтернативы перед concept board.",
    iconColor: "text-[#425548]",
    accent: "#425548",
    tint: "#EAF0E8",
  },
  {
    title: "Concept board",
    icon: Palette,
    purpose: "Чтобы показать не набор красивых картинок, а логику будущего решения.",
    use: "5 блоков: атмосфера, палитра RAL/NCS, материалы, мебель с габаритами, освещение.",
    iconColor: "text-[#9A6A43]",
    accent: "#9A6A43",
    tint: "#F3E9DE",
  },
  {
    title: "PDF и render prompt",
    icon: FileText,
    purpose: "Чтобы перейти от черновой идеи к согласованию и визуализации.",
    use: "PDF можно приложить к договору, prompt передать в визуализацию без потери логики проекта.",
    iconColor: "text-[#6B5F4A]",
    accent: "#6B5F4A",
    tint: "#EEEAE1",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [hasDesignerProfile, setHasDesignerProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      const [data, profile] = await Promise.all([
        getProjects(),
        getDesignerProfile(getSessionId()),
      ]);

      setHasDesignerProfile(
        Boolean(
          profile &&
            (profile.style_description?.trim().length ||
              profile.custom_ergonomics_text?.trim().length ||
              (Array.isArray(profile.style_refs) && profile.style_refs.length > 0)),
        ),
      );

      if (!data || data.length === 0) {
        setProjects([]);
        return;
      }

      const projectsWithCompleteness = await Promise.all(
        data.map(async (project: ProjectCard) => {
          try {
            const brief = await getBrief(project.id);
            return {
              ...project,
              completeness_score: brief?.completeness_score || 0,
            };
          } catch {
            return { ...project, completeness_score: 0 };
          }
        }),
      );
      setProjects(projectsWithCompleteness);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    setDeleteConfirmId(null);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F3EA] text-[#171512]">
      <header
        className="sticky top-0 z-50 border-b border-white/20 shadow-[0_18px_60px_rgba(23,21,18,0.14)] backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(90deg, rgba(247,243,234,0.78) 0%, rgba(183,157,126,0.9) 24%, rgba(126,96,68,0.92) 58%, rgba(183,162,136,0.9) 84%, rgba(247,243,234,0.78) 100%)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-10">
          <div className="flex items-center gap-12">
            <a href="/" className="font-display text-[26px] leading-none tracking-[0.03em] text-[#2C2722]">
              Magic Capture
            </a>
            <nav className="hidden items-center gap-8 text-[14px] uppercase tracking-[0.14em] text-[#2C2722]/86 md:flex">
              <button onClick={() => navigate("/new")} className="transition-colors hover:text-[#F7F3EA]">
                Исходники
              </button>
              <button onClick={() => navigate("/profile")} className="transition-colors hover:text-[#F7F3EA]">
                Профиль дизайнера
              </button>
            </nav>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => navigate("/new")}
              className="border border-[#F7F3EA]/80 bg-white/6 px-8 py-4 text-[12px] tracking-[0.12em] text-white shadow-[0_14px_34px_rgba(23,21,18,0.12)] hover:bg-white/16"
            >
              Загрузить исходники
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-[#D8CDBE] px-5 py-12 sm:px-10 sm:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-[920px] text-center">
              <div className="mb-5 flex items-center justify-center gap-3">
                <div className="flex overflow-hidden border border-[#D8CDBE]">
                  <span className="block h-4 w-7" style={{ backgroundColor: "#9A6A43" }} />
                  <span className="block h-4 w-7" style={{ backgroundColor: "#425548" }} />
                  <span className="block h-4 w-7" style={{ backgroundColor: "#B87952" }} />
                  <span className="block h-4 w-7" style={{ backgroundColor: "#3F5F66" }} />
                </div>
                <p className="text-[12px] uppercase tracking-[0.18em] text-[#9A6A43]">
                  ATELIER ДЛЯ ИНТЕРЬЕРНЫХ ДИЗАЙНЕРОВ
                </p>
              </div>
              <h1 className="font-display text-[34px] leading-[1.08] text-[#171512] sm:text-[48px] lg:text-[58px]">
                Авторский стиль дизайнера превращается в понятный путь проекта.
              </h1>
              <p className="mx-auto mt-6 max-w-[720px] text-[17px] leading-[1.85] text-[#5C554B]">
                Загрузите своё портфолио — и AI собирает бриф, риски и концепт в вашем стиле. Не усреднённо. Авторски.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button onClick={() => navigate("/new")} className="px-8 py-4">
                  Начать с проекта
                  <ArrowRight />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/profile")}
                  className="border-[#B9AA98] px-8 py-4 text-[#171512]"
                >
                  Создать профиль дизайнера
                </Button>
              </div>
            </div>

            <div className="mt-12 overflow-hidden border border-[#D8CDBE] bg-[#EAE0D1]">
              <div className="grid h-2 grid-cols-4">
                <span style={{ backgroundColor: "#9A6A43" }} />
                <span style={{ backgroundColor: "#425548" }} />
                <span style={{ backgroundColor: "#B87952" }} />
                <span style={{ backgroundColor: "#3F5F66" }} />
              </div>
              <img
                src="/images/atelier-hero.png"
                alt="Материалы, план и образцы для интерьерной концепции"
                className="h-[320px] w-full object-cover object-center sm:h-[500px] lg:h-[610px]"
              />
            </div>

            <div className="mt-8 grid gap-5 border-y border-[#D8CDBE] py-6 text-[15px] leading-[1.75] text-[#3F3830] md:grid-cols-3">
              <p className="border-l-4 border-[#9A6A43] pl-4">Дизайнер загружает портфолио, мудборды и правила один раз — этот профиль дальше применяется к каждому проекту.</p>
              <p className="border-l-4 border-[#425548] pl-4">Клиентские референсы не копируются буквально: инструмент ищет, что за ними стоит и где это совпадает со стилем дизайнера.</p>
              <p className="border-l-4 border-[#3F5F66] pl-4">Итоговые материалы помогают не просто “показать красиво”, а объяснить, почему решение подходит именно этому проекту.</p>
            </div>
          </div>
        </section>

        <section className="border-b border-[#D8CDBE] px-5 py-16 sm:px-10 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <p className="mb-5 text-[12px] uppercase tracking-[0.16em] text-[#9A6A43]">было / стало</p>
              <h2 className="font-display text-[34px] leading-[1.1] sm:text-[48px]">
                Разрозненные вводные становятся брифом, вопросами и основой концепта.
              </h2>
            </div>

            <div className="grid gap-px bg-[#D8CDBE] md:grid-cols-2">
              <article className="bg-[#FBF8F1] p-6 sm:p-8">
                <p className="mb-7 text-[11px] uppercase tracking-[0.14em] text-[#9A6A43]">было</p>
                <div className="space-y-4">
                  {transformations.map((item, index) => (
                    <div key={item.before} className={cn("border border-l-4 border-[#E5DBCE] bg-[#F7F3EA] p-4", item.beforeAccent)}>
                      <div className="mb-3 flex items-center gap-3">
                        <span className="h-3 w-3" style={{ backgroundColor: item.sourceColor }} />
                        <p className={cn("text-[11px] uppercase tracking-[0.12em]", item.labelColor)}>
                          источник {index + 1}
                        </p>
                      </div>
                      <p className="text-[15px] leading-[1.65] text-[#5C554B]">{item.before}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="bg-[#F7F3EA] p-6 sm:p-8">
                <p className="mb-7 text-[11px] uppercase tracking-[0.14em] text-[#425548]">стало</p>
                <div className="relative">
                  <div className="overflow-hidden border border-[#B9AA98] bg-[#FFF9F0]">
                    <div className="grid h-2 grid-cols-3">
                      {transformations.map((item) => (
                        <span key={item.after} style={{ backgroundColor: item.afterBorder }} />
                      ))}
                    </div>
                    <div className="p-5">
                    <div className="mb-5 flex items-center justify-between border-b border-[#E5DBCE] pb-4">
                      <p className="font-display text-[28px] leading-none">Проектная карта</p>
                      <Sparkles className="h-4 w-4 text-[#9A6A43]" />
                    </div>
                    <div className="space-y-3">
                      {transformations.map((item) => (
                        <div key={item.after} className="flex items-start gap-3 text-[15px] leading-[1.65] text-[#3F3932]">
                          <span
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border"
                            style={{ backgroundColor: item.afterTint, borderColor: item.afterBorder }}
                          >
                            <CheckCircle2 className={cn("h-3.5 w-3.5", item.afterIcon)} />
                          </span>
                          <p>{item.after}</p>
                        </div>
                      ))}
                    </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] uppercase tracking-[0.12em] text-[#5C554B]">
                    <div className="border border-[#9A6A43]/35 bg-[#F6EFE6] px-2 py-3 text-[#8A5F3B]">brief</div>
                    <div className="border border-[#425548]/35 bg-[#EEF2EA] px-2 py-3 text-[#425548]">style</div>
                    <div className="border border-[#3F5F66]/35 bg-[#EEF3F4] px-2 py-3 text-[#3F5F66]">PDF</div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="border-b border-[#D8CDBE] bg-[#FBF8F1] px-5 py-16 sm:px-10 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="mb-5 text-[12px] uppercase tracking-[0.16em] text-[#9A6A43]">как проходит проект</p>
              <h2 className="font-display text-[36px] leading-[1.08] sm:text-[52px]">
                От авторского метода до клиентского PDF.
              </h2>
              <p className="mt-6 max-w-[520px] text-[16px] leading-[1.85] text-[#5C554B]">
                Дизайнер остаётся автором решения. Magic Capture работает как аккуратный ассистент: собирает, сравнивает, подсвечивает риски и готовит материалы для следующего шага.
              </p>
            </div>

            <div className="border-t border-[#D8CDBE]">
              {workflow.map((step) => (
                <article key={step.number} className="grid gap-5 border-b border-[#D8CDBE] py-8 sm:grid-cols-[84px_0.65fr_1fr]">
                  <p className={cn("font-display text-[30px] leading-none", step.numberColor)}>{step.number}</p>
                  <h3 className="font-display text-[28px] leading-[1.08]">{step.title}</h3>
                  <p className="text-[15px] leading-[1.8] text-[#5C554B]">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#D8CDBE] px-5 py-16 sm:px-10 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 max-w-[760px]">
              <p className="mb-5 text-[12px] uppercase tracking-[0.16em] text-[#9A6A43]">что создаётся в итоге</p>
              <h2 className="font-display text-[36px] leading-[1.08] sm:text-[52px]">
                Каждый артефакт нужен не для отчётности, а для решения конкретной задачи.
              </h2>
            </div>

            <div className="grid gap-px bg-[#D8CDBE] md:grid-cols-2 lg:grid-cols-3">
              {artifacts.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="bg-[#F7F3EA] p-7 sm:p-8">
                    <div className="mb-8 h-1.5 w-20" style={{ backgroundColor: item.accent }} />
                    <div
                      className="mb-8 flex h-11 w-11 items-center justify-center border"
                      style={{ backgroundColor: item.tint, borderColor: item.accent }}
                    >
                      <Icon className={cn("h-5 w-5", item.iconColor)} />
                    </div>
                    <h3 className="font-display text-[32px] leading-none">{item.title}</h3>
                    <div className="mt-7 space-y-5 text-[15px] leading-[1.75] text-[#5C554B]">
                      <p>
                        <span className="text-[#171512]">Зачем: </span>
                        {item.purpose}
                      </p>
                      {item.use && (
                        <p>
                          <span className="text-[#171512]">Как использовать: </span>
                          {item.use}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {!loading && projects.length > 0 && (
          <section className="border-b border-[#D8CDBE] bg-[#FBF8F1] px-5 py-16 sm:px-10 sm:py-24">
            <div className="mx-auto max-w-7xl">
              <div className="mb-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="mb-4 text-[12px] uppercase tracking-[0.16em] text-[#9A6A43]">мои проекты</p>
                  <h2 className="font-display text-[40px] leading-none">Продолжить работу</h2>
                </div>
                <Button onClick={() => navigate("/new")}>Новый проект</Button>
              </div>

              <div className="grid grid-cols-1 gap-px bg-[#D8CDBE] md:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => {
                  const completeness = p.completeness_score || 0;
                  return (
                    <div
                      key={p.id}
                      className="cursor-pointer bg-[#F7F3EA] p-6 transition-colors duration-350 hover:bg-[#FFF9F0]"
                      onClick={() => navigate(`/project/${p.id}/edit`)}
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-[26px] text-[#171512]">{p.name}</h3>
                        {hasDesignerProfile && (
                          <span className="border border-[#9A6A43]/30 bg-[#9A6A43]/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#8A5F3B]">
                            Стиль применён
                          </span>
                        )}
                      </div>
                      <p className="mb-6 text-[13px] text-[#756A5E]">
                        {new Date(p.created_at).toLocaleDateString("ru-RU")}
                      </p>
                      <div className="mb-2">
                        <div className="mb-2 h-[2px] bg-[#E6DCD1]">
                          <div
                            className={cn(
                              "h-full transition-all duration-350",
                              completeness <= 40 ? "bg-[hsl(var(--color-critical))]" : "bg-[#9A6A43]",
                            )}
                            style={{ width: `${completeness}%` }}
                          />
                        </div>
                        <p className={cn("text-[11px] uppercase tracking-[0.1em]", getProgressTextColor(completeness))}>
                          {completeness}% заполнен
                        </p>
                      </div>
                      <div className="mt-6 flex items-center justify-between">
                        <button className="text-[13px] uppercase tracking-[0.1em] text-[#9A6A43] transition-colors duration-350 hover:text-[#171512]">
                          Открыть
                        </button>
                        {deleteConfirmId === p.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleDelete(e, p.id)}
                              className="text-[10px] uppercase tracking-[0.08em] text-red-600 transition-colors hover:text-red-800"
                            >
                              Удалить
                            </button>
                            <span className="text-[#B9AA98]">/</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(null);
                              }}
                              className="text-[10px] uppercase tracking-[0.08em] text-[#756A5E] transition-colors hover:text-[#171512]"
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <button onClick={(e) => handleDelete(e, p.id)} title="Удалить проект">
                            <Trash2 className="h-3.5 w-3.5 text-[#B9AA98] transition-colors hover:text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section className="border-y border-[#D8CDBE] bg-[#EAE0D1] px-5 py-16 text-[#171512] sm:px-10 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-end">
            <div>
              <p className="mb-5 text-[12px] uppercase tracking-[0.16em] text-[#9A6A43]">начать работу</p>
              <h2 className="font-display text-[36px] leading-[1.08] sm:text-[54px]">
                Сначала сохраните свой стиль. Затем загрузите первый проект.
              </h2>
            </div>
            <div>
              <p className="mb-8 text-[16px] leading-[1.8] text-[#5C554B]">
                Так инструмент будет не просто анализировать клиента, а постоянно держать в фокусе профессиональный язык дизайнера.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button onClick={() => navigate("/profile")} className="bg-[#C8A57A] px-9 py-5 text-[#171512] shadow-[0_18px_45px_rgba(154,106,67,0.18)] hover:bg-[#D9B88A]">
                  Профиль дизайнера
                  <Sparkles />
                </Button>
                <Button
                  onClick={() => navigate("/new")}
                  className="bg-[#3F5F66] px-8 py-5 text-[12px] text-[#F7F3EA] shadow-[0_18px_45px_rgba(63,95,102,0.2)] hover:bg-[#4D727A]"
                >
                  Загрузить исходники
                  <ArrowRight />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
