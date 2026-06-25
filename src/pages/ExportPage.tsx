import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProject, getBrief, getIssues, getQuestions, getBoardBlocks } from "@/lib/api";
import { getRooms } from "@/lib/rooms";
import { BRIEF_SECTIONS, BOARD_BLOCK_TYPES, PRIORITY_CONFIG, ROOM_TYPES } from "@/lib/constants";
import { generateFullPDF } from "@/lib/pdf-export";
import { runExportPreflight } from "@/lib/export-preflight";
import { calculateBudget, SEGMENT_LABELS } from "@/lib/budget-calculator";
import { loadBudgetSettings, toBudgetCalculationOptions } from "@/lib/budget-settings";
import {
  appendExportHistoryEntry,
  createExportHistoryEntry,
  loadExportHistory,
  type ExportHistoryEntry,
} from "@/lib/export-history";
import ProjectHeader from "@/components/ProjectHeader";
import ColorChip from "@/components/ColorChip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Download, CheckCircle, ArrowLeft, AlertTriangle, ShieldCheck } from "lucide-react";

type ProjectApprovalStatus = "draft" | "needs_review" | "approved_for_client" | "contract_ready";

type ApprovalChecklistKey =
  | "style"
  | "materials"
  | "lighting"
  | "budget"
  | "references"
  | "legal";

interface ApprovalState {
  status: ProjectApprovalStatus;
  checklist: Record<ApprovalChecklistKey, boolean>;
  approvedAt?: string;
}

const APPROVAL_CHECKLIST: Array<{ key: ApprovalChecklistKey; label: string }> = [
  { key: "style", label: "Стиль и единый визуальный язык" },
  { key: "materials", label: "Материалы и формулировки" },
  { key: "lighting", label: "Свет и сценарии освещения" },
  { key: "budget", label: "Бюджетная рамка и допущения" },
  { key: "references", label: "Связь с клиентскими референсами" },
  { key: "legal", label: "Юридическая чистота формулировок" },
];

const APPROVAL_STATUS_LABELS: Record<ProjectApprovalStatus, string> = {
  draft: "Черновик",
  needs_review: "Нужна проверка",
  approved_for_client: "Одобрено для клиента",
  contract_ready: "Готово для договора",
};

const DEFAULT_APPROVAL_STATE: ApprovalState = {
  status: "draft",
  checklist: {
    style: false,
    materials: false,
    lighting: false,
    budget: false,
    references: false,
    legal: false,
  },
};

const ExportPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvalState, setApprovalState] = useState<ApprovalState>(DEFAULT_APPROVAL_STATE);
  const [preflightOverride, setPreflightOverride] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistoryEntry[]>([]);

  useEffect(() => {
    if (!projectId) return;
    const savedState = localStorage.getItem(`project_${projectId}_approval_state`);
    const legacyApproval = localStorage.getItem(`project_${projectId}_approval`);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as ApprovalState;
        setApprovalState({
          ...DEFAULT_APPROVAL_STATE,
          ...parsed,
          checklist: { ...DEFAULT_APPROVAL_STATE.checklist, ...(parsed.checklist || {}) },
        });
      } catch {
        setApprovalState(DEFAULT_APPROVAL_STATE);
      }
    } else if (legacyApproval === "approved") {
      setApprovalState({ ...DEFAULT_APPROVAL_STATE, status: "approved_for_client" });
    }
    setExportHistory(loadExportHistory(projectId));

    const load = async () => {
      try {
        const [p, b, iss, qs, bb, rms] = await Promise.all([
          getProject(projectId),
          getBrief(projectId),
          getIssues(projectId),
          getQuestions(projectId),
          getBoardBlocks(projectId),
          getRooms(projectId),
        ]);
        setProject(p);
        setBrief(b);
        setIssues(iss || []);
        setQuestions(qs || []);
        setBlocks(bb || []);
        setRooms(rms || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const saveApprovalState = (next: ApprovalState) => {
    setApprovalState(next);
    if (!projectId) return;
    localStorage.setItem(`project_${projectId}_approval_state`, JSON.stringify(next));
  };

  const setApprovalStatus = (status: ProjectApprovalStatus) => {
    const next: ApprovalState = {
      ...approvalState,
      status,
      approvedAt: status === "contract_ready" ? new Date().toISOString() : approvalState.approvedAt,
    };
    saveApprovalState(next);
    toast.success(`Статус: ${APPROVAL_STATUS_LABELS[status]}`);
  };

  const toggleChecklistItem = (key: ApprovalChecklistKey) => {
    saveApprovalState({
      ...approvalState,
      checklist: {
        ...approvalState.checklist,
        [key]: !approvalState.checklist[key],
      },
      status: approvalState.status === "contract_ready" ? "approved_for_client" : approvalState.status,
    });
  };

  const preflight = useMemo(
    () => runExportPreflight({ project, brief, questions, blocks, rooms }),
    [project, brief, questions, blocks, rooms]
  );

  useEffect(() => {
    setPreflightOverride(false);
  }, [projectId, brief, questions, blocks]);

  const navigateToIssue = (targetPath?: string) => {
    if (!projectId || !targetPath) return;
    navigate(`/project/${projectId}${targetPath}`);
  };

  const handleExportWorkingPDF = () => {
    const entry = createExportHistoryEntry(
      { project, brief, rooms, issues, questions, blocks },
      "working",
      "draft",
      exportHistory
    );
    setExportHistory(appendExportHistoryEntry(projectId, entry));
    const ok = generateFullPDF(
      { project, brief, rooms, issues, questions, blocks },
      {
        variant: "working",
        approvalStatus: "draft",
        documentVersion: entry.versionLabel,
        generatedAt: entry.generatedAt,
        changes: entry.changes,
      }
    );
    if (!ok) toast.info("Используйте Ctrl+P / Cmd+P для сохранения в PDF");
  };

  const handleExportContractPDF = () => {
    if (approvalState.status !== "contract_ready") {
      toast.error("Переведите проект в статус «Готово для договора»");
      return;
    }

    if (preflight.blockingIssues.length > 0 && !preflightOverride) {
      toast.error("Preflight нашел P0/P1 проблемы. Исправьте их или включите override.");
      return;
    }

    const entry = createExportHistoryEntry(
      { project, brief, rooms, issues, questions, blocks },
      "contract",
      "approved",
      exportHistory
    );
    setExportHistory(appendExportHistoryEntry(projectId, entry));

    const ok = generateFullPDF(
      { project, brief, rooms, issues, questions, blocks },
      {
        variant: "contract",
        approvalStatus: "approved",
        documentVersion: entry.versionLabel,
        generatedAt: entry.generatedAt,
        changes: entry.changes,
      }
    );
    if (!ok) toast.info("Используйте Ctrl+P / Cmd+P для сохранения в PDF");
  };

  const getBlockLabel = (type: string) =>
    BOARD_BLOCK_TYPES.find((b) => b.type === type)?.label || type;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const DETAIL_KEYS = new Set(["success_criteria", "budget", "timeline", "constraints_practical"]);
  const mainBriefSections = BRIEF_SECTIONS.filter((s) => !DETAIL_KEYS.has(s.key));
  const checklistComplete = APPROVAL_CHECKLIST.every((item) => approvalState.checklist[item.key]);
  const budgetSettings = loadBudgetSettings(project?.id);
  const budgetResult = calculateBudget(
    brief || {},
    rooms || [],
    project || {},
    toBudgetCalculationOptions(budgetSettings)
  );
  const formatRub = (value: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(value))} ₽`;
  const requiredBriefFields = BRIEF_SECTIONS.map((section) => section.key);
  const filledBriefFields = requiredBriefFields.filter((key) => String(brief?.[key] || "").trim());
  const unresolvedCriticalQuestions = questions.filter(
    (q: any) => ["critical", "important"].includes(q.priority) && !String(q.answer || "").trim()
  );
  const requiredBoardBlocks = BOARD_BLOCK_TYPES.map((block) => block.type);
  const presentBoardBlocks = requiredBoardBlocks.filter((type) =>
    blocks.some((block: any) => block.block_type === type)
  );
  const preflightTargets = preflight.blockingIssues.slice(0, 6);
  const incompleteApprovalItems = APPROVAL_CHECKLIST.filter((item) => !approvalState.checklist[item.key]);
  const readinessItems = [
    {
      key: "brief",
      label: "Бриф",
      ready: filledBriefFields.length >= Math.min(requiredBriefFields.length, 7),
      detail: `${filledBriefFields.length}/${requiredBriefFields.length} полей заполнено`,
      targetPath: "/brief",
    },
    {
      key: "questions",
      label: "Вопросы",
      ready: unresolvedCriticalQuestions.length === 0,
      detail: unresolvedCriticalQuestions.length === 0
        ? "critical/important закрыты"
        : `открыто: ${unresolvedCriticalQuestions.length}`,
      targetPath: "/questions",
    },
    {
      key: "references",
      label: "Референсы",
      ready: !preflight.blockingIssues.some((item) =>
        ["low-client-reference-coverage", "missing-trace"].some((id) => item.id.includes(id))
      ),
      detail: "связь с источниками и клиентскими сигналами",
      targetPath: "/board#reference-match-matrix",
    },
    {
      key: "concept",
      label: "Концепт",
      ready: presentBoardBlocks.length === requiredBoardBlocks.length && !preflight.blockingIssues.some((item) => item.targetPath?.startsWith("/board")),
      detail: `${presentBoardBlocks.length}/${requiredBoardBlocks.length} обязательных блоков`,
      targetPath: "/board",
    },
    {
      key: "budget",
      label: "Бюджет",
      ready: !brief?.budget || budgetResult.canShowInContract,
      detail: brief?.budget ? "методика проверена" : "бюджет не указан",
      targetPath: "/brief",
    },
    {
      key: "pdf",
      label: "PDF",
      ready: preflight.blockingIssues.length === 0 && approvalState.status === "contract_ready",
      detail: approvalState.status === "contract_ready" ? "готов к договорному экспорту" : "нужно утверждение",
      targetPath: "/export",
    },
  ];
  const readinessReadyCount = readinessItems.filter((item) => item.ready).length;
  const readinessPercent = Math.round((readinessReadyCount / readinessItems.length) * 100);
  const nextActions = [
    ...preflightTargets.map((item) => ({
      id: item.id,
      label: item.title,
      detail: item.detail,
      targetPath: item.targetPath,
      severity: item.severity,
    })),
    ...incompleteApprovalItems.slice(0, Math.max(0, 6 - preflightTargets.length)).map((item) => ({
      id: `approval-${item.key}`,
      label: item.label,
      detail: "Отметьте пункт ручного утверждения дизайнером.",
      targetPath: "/export",
      severity: "P1" as const,
    })),
  ];

  return (
    <div className="min-h-screen bg-background">
      <ProjectHeader
        projectId={projectId!}
        currentStep="export"
        title="Экспорт"
        projectName={project?.name}
      >
        <div className="flex items-center gap-3">
          <Badge
            variant={approvalState.status === "contract_ready" ? "default" : "outline"}
            className="text-[11px]"
          >
            {APPROVAL_STATUS_LABELS[approvalState.status]}
          </Badge>
          <Button onClick={() => setApprovalStatus("needs_review")} variant="outline" size="sm">
            <CheckCircle className="mr-2 h-4 w-4" />
            На проверку
          </Button>
          <Button onClick={handleExportWorkingPDF} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            ↓ Рабочий отчет
          </Button>
          <Button onClick={handleExportContractPDF} size="sm">
            <Download className="mr-2 h-4 w-4" />
            ↓ Приложение к договору
          </Button>
        </div>
      </ProjectHeader>

      <div className="mx-auto max-w-content px-12 py-16 space-y-16">
        {/* Заголовок */}
        <div className="text-center">
          <h1 className="text-foreground">{project?.name}</h1>
          <p className="mt-4 caption-style">{new Date().toLocaleDateString("ru-RU")}</p>
        </div>

        <section className="border border-border bg-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="m-0 border-0 p-0 text-foreground">Готовность проекта</h2>
              <p className="mt-2 text-[14px] font-light text-muted-foreground">
                {readinessReadyCount} из {readinessItems.length} блоков готовы к передаче клиенту.
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-light text-foreground">{readinessPercent}%</p>
              <p className="caption-style text-muted-foreground">готовность</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {readinessItems.map((item) => (
              <button
                key={item.key}
                onClick={() => navigateToIssue(item.targetPath)}
                className="flex items-start gap-3 border border-border p-3 text-left transition-colors hover:border-primary"
              >
                {item.ready ? (
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" strokeWidth={1.5} />
                )}
                <span>
                  <span className="block text-[14px] font-medium text-foreground">{item.label}</span>
                  <span className="mt-1 block text-[12px] font-light text-muted-foreground">{item.detail}</span>
                </span>
              </button>
            ))}
          </div>

          {nextActions.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="label-style text-foreground">Следующие действия</p>
              <div className="mt-3 divide-y divide-border">
                {nextActions.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={item.severity === "P0" ? "destructive" : "outline"}>
                          {item.severity}
                        </Badge>
                        <span className="text-[14px] font-medium text-foreground">{item.label}</span>
                      </div>
                      <p className="mt-1 text-[12px] font-light text-muted-foreground">{item.detail}</p>
                    </div>
                    {item.targetPath && (
                      <Button variant="outline" size="sm" onClick={() => navigateToIssue(item.targetPath)}>
                        Перейти
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="border border-border bg-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                {preflight.status === "pass" ? (
                  <ShieldCheck className="h-5 w-5 text-primary" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
                <h2 className="m-0 border-0 p-0 text-foreground">Проверка перед экспортом</h2>
              </div>
              <p className="mt-2 text-[14px] font-light text-muted-foreground">
                {preflight.status === "pass"
                  ? "P0/P1 проблем не найдено. Договорный экспорт можно собирать после утверждения."
                  : `Найдено проблем: ${preflight.issues.length}. P0/P1 блокируют договорный экспорт без явного override.`}
              </p>
            </div>
            <Badge variant={preflight.status === "pass" ? "default" : "destructive"}>
              {preflight.status === "pass" ? "Готово" : "Нужна проверка"}
            </Badge>
          </div>

          {preflight.issues.length > 0 && (
            <div className="mt-6 divide-y divide-border">
              {preflight.issues.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.severity === "P0" ? "destructive" : "outline"}>
                        {item.severity}
                      </Badge>
                      <span className="text-[15px] font-medium text-foreground">{item.title}</span>
                    </div>
                    <p className="mt-1 text-[13px] font-light text-muted-foreground">{item.detail}</p>
                  </div>
                  {item.targetPath && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateToIssue(item.targetPath)}
                      className="shrink-0"
                    >
                      Перейти
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {preflight.blockingIssues.length > 0 && (
            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] font-light text-muted-foreground">
                Override фиксирует осознанное решение экспортировать договорное приложение с P0/P1 рисками.
              </p>
              <Button
                variant={preflightOverride ? "default" : "outline"}
                size="sm"
                onClick={() => setPreflightOverride((value) => !value)}
              >
                {preflightOverride ? "Override включен" : "Включить override"}
              </Button>
            </div>
          )}
        </section>

        <section className="border border-border bg-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="m-0 border-0 p-0 text-foreground">Утверждение дизайнером</h2>
              <p className="mt-2 text-[14px] font-light text-muted-foreground">
                Договорное приложение доступно только в статусе "Готово для договора".
              </p>
              {approvalState.approvedAt && (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Дата готовности: {new Date(approvalState.approvedAt).toLocaleString("ru-RU")}
                </p>
              )}
            </div>
            <Badge variant={approvalState.status === "contract_ready" ? "default" : "outline"}>
              {APPROVAL_STATUS_LABELS[approvalState.status]}
            </Badge>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {APPROVAL_CHECKLIST.map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-3 border border-border px-3 py-2 text-[14px] text-foreground"
              >
                <input
                  type="checkbox"
                  checked={approvalState.checklist[item.key]}
                  onChange={() => toggleChecklistItem(item.key)}
                  className="h-4 w-4 accent-primary"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
            <Button variant="outline" size="sm" onClick={() => setApprovalStatus("draft")}>
              Черновик
            </Button>
            <Button variant="outline" size="sm" onClick={() => setApprovalStatus("needs_review")}>
              Нужна проверка
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!checklistComplete}
              onClick={() => setApprovalStatus("approved_for_client")}
            >
              Одобрено для клиента
            </Button>
            <Button
              size="sm"
              disabled={!checklistComplete || (preflight.blockingIssues.length > 0 && !preflightOverride)}
              onClick={() => setApprovalStatus("contract_ready")}
            >
              Готово для договора
            </Button>
          </div>
        </section>

        <section className="border border-border bg-card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="m-0 border-0 p-0 text-foreground">Версии и changelog</h2>
              <p className="mt-2 text-[14px] font-light text-muted-foreground">
                История локальных экспортов: версия, статус, дата генерации и изменения относительно предыдущего PDF.
              </p>
            </div>
            {exportHistory.length > 0 && (
              <Badge variant="outline">{exportHistory[exportHistory.length - 1].versionLabel}</Badge>
            )}
          </div>

          {exportHistory.length === 0 ? (
            <p className="mt-6 text-[14px] font-light text-muted-foreground">
              Экспортов пока не было. Первый PDF будет сохранен как draft v1 или approved v1.
            </p>
          ) : (
            <div className="mt-6 divide-y divide-border">
              {[...exportHistory].reverse().slice(0, 6).map((entry) => (
                <div key={entry.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={entry.approvalStatus === "approved" ? "default" : "outline"}>
                      {entry.versionLabel}
                    </Badge>
                    <span className="text-[13px] text-muted-foreground">
                      {entry.variant === "contract" ? "Приложение" : "Рабочий отчет"}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {new Date(entry.generatedAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-[13px] font-light text-muted-foreground">
                    {entry.changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Критерии успеха — выносим наверх */}
        {brief?.success_criteria && (
          <section>
            <h2 className="mb-6 text-foreground">Критерии успеха</h2>
            <p className="text-[15px] font-light text-muted-foreground">{brief.success_criteria}</p>
          </section>
        )}

        {/* Данные проекта: бюджет / сроки / ограничения */}
        {(brief?.budget || brief?.timeline || brief?.constraints_practical) && (
          <section>
            <h2 className="mb-6 text-foreground">Данные проекта</h2>
            <div className="divide-y divide-border">
              {brief?.budget && (
                <div className="py-4">
                  <span className="label-style text-foreground">Бюджет</span>
                  <p className="mt-1 text-[15px] font-light text-muted-foreground">{brief.budget}</p>
                </div>
              )}
              {brief?.timeline && (
                <div className="py-4">
                  <span className="label-style text-foreground">Сроки</span>
                  <p className="mt-1 text-[15px] font-light text-muted-foreground">{brief.timeline}</p>
                </div>
              )}
              {brief?.constraints_practical && (
                <div className="py-4">
                  <span className="label-style text-foreground">Ограничения и табу</span>
                  <p className="mt-1 text-[15px] font-light text-muted-foreground">{brief.constraints_practical}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {brief?.budget && (
          <section>
            <h2 className="mb-6 text-foreground">Бюджетная рамка и методика</h2>
            {budgetResult.canShowInContract && budgetResult.estimateRange ? (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <span className="label-style text-foreground">Ориентир по комплектации</span>
                    <p className="mt-1 text-[15px] font-light text-muted-foreground">
                      {formatRub(budgetResult.estimateRange.min)} – {formatRub(budgetResult.estimateRange.max)}
                    </p>
                  </div>
                  <div>
                    <span className="label-style text-foreground">Сегмент</span>
                    <p className="mt-1 text-[15px] font-light text-muted-foreground">
                      {SEGMENT_LABELS[budgetResult.segment]}
                    </p>
                  </div>
                  <div>
                    <span className="label-style text-foreground">Версия методики</span>
                    <p className="mt-1 text-[15px] font-light text-muted-foreground">
                      {budgetResult.methodologyVersion} · {budgetResult.methodologyDate}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 text-[13px] font-light text-muted-foreground sm:grid-cols-3">
                  <p>Региональный коэффициент: ×{budgetResult.regionCoefficient.toFixed(2)}</p>
                  <p>Ручная корректировка: ×{budgetResult.manualRateMultiplier.toFixed(2)}</p>
                  <p>Итоговый коэффициент: ×{(budgetResult.regionCoefficient * budgetResult.manualRateMultiplier).toFixed(2)}</p>
                </div>
                <div className="grid gap-6 text-[13px] font-light text-muted-foreground sm:grid-cols-3">
                  <div>
                    <span className="label-style text-foreground">Допущения</span>
                    {budgetResult.assumptions.map((item) => <p key={item} className="mt-2">{item}</p>)}
                  </div>
                  <div>
                    <span className="label-style text-foreground">Что входит</span>
                    {budgetResult.includes.map((item) => <p key={item} className="mt-2">{item}</p>)}
                  </div>
                  <div>
                    <span className="label-style text-foreground">Что не входит</span>
                    {budgetResult.excludes.map((item) => <p key={item} className="mt-2">{item}</p>)}
                  </div>
                </div>
                {budgetResult.missingAreaRooms.length > 0 && (
                  <p className="text-[13px] text-amber-700">
                    Не учтены из-за отсутствия площади: {budgetResult.missingAreaRooms.join(", ")}.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[15px] font-light text-muted-foreground">
                Бюджет клиента зафиксирован, но для договорного ориентира не хватает площадей помещений. В приложении к договору бюджетная сумма не выводится как расчет.
              </p>
            )}
          </section>
        )}

        {/* Помещения с размерами */}
        {rooms.length > 0 && (
          <section>
            <h2 className="mb-6 text-foreground">Помещения</h2>
            <div className="divide-y divide-border">
              {rooms.map((r: any) => {
                const typeLabel = ROOM_TYPES.find((t) => t.value === r.room_type)?.label || r.room_type;
                return (
                  <div key={r.id} className="py-3 flex items-baseline justify-between gap-4">
                    <span className="text-[15px] font-light">
                      {r.name}{" "}
                      <span className="text-muted-foreground">({typeLabel})</span>
                    </span>
                    {r.dimensions_text && (
                      <span className="label-style text-muted-foreground whitespace-nowrap">
                        {r.dimensions_text}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Бриф */}
        <section>
          <h2 className="mb-6 text-foreground">Бриф</h2>
          <div className="divide-y divide-border">
            {mainBriefSections.map(({ key, label }) => (
              <div key={key} className="py-6">
                <span className="label-style text-foreground">{label}</span>
                <p className="mt-2 text-[15px] font-light text-muted-foreground">
                  {brief?.[key] || "не указано"}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Противоречия */}
        {issues.filter((i) => i.type === "contradiction").length > 0 && (
          <section>
            <h2 className="mb-6 text-foreground">Противоречия</h2>
            <div className="divide-y divide-border">
              {issues
                .filter((i) => i.type === "contradiction")
                .map((issue) => (
                  <div key={issue.id} className="py-6">
                    <h3 className="text-foreground">{issue.title}</h3>
                    {issue.evidence && (
                      <p className="mt-1 caption-style italic">«{issue.evidence}»</p>
                    )}
                    {issue.suggestion && (
                      <p className="mt-2 text-[15px] text-primary font-light">{issue.suggestion}</p>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Вопросы */}
        {questions.length > 0 && (
          <section>
            <h2 className="mb-6 text-foreground">Уточняющие вопросы</h2>
            <div className="divide-y divide-border">
              {questions.map((q) => (
                <div key={q.id} className="py-4">
                  <div className="flex items-center gap-3">
                    <span className="label-style text-muted-foreground">
                      [{PRIORITY_CONFIG[q.priority as keyof typeof PRIORITY_CONFIG]?.label || q.priority}]
                    </span>
                    <span className="text-[15px] font-light text-foreground">{q.text}</span>
                  </div>
                  {q.answer && (
                    <p className="mt-1 text-[15px] text-primary font-light">Ответ: {q.answer}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Концепт-борд */}
        {blocks.length > 0 && (
          <section>
            <h2 className="mb-6 text-foreground">Концепт-борд</h2>
            <div className="divide-y divide-border">
              {blocks.map((block) => (
                <div key={block.id} className="py-10">
                  <h3 className="mb-4 text-foreground">{getBlockLabel(block.block_type)}</h3>
                  {block.caption && (
                    <p className="mb-6 text-[15px] font-light text-muted-foreground">{block.caption}</p>
                  )}

                  {/* Палитра: цветовые чипы */}
                  {block.block_type === "palette" &&
                    Array.isArray(block.color_chips) &&
                    block.color_chips.length > 0 && (
                      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                        {block.color_chips.map((chip: any, i: number) => (
                          <ColorChip
                            key={i}
                            hex={chip.hex}
                            name={chip.name}
                            role={chip.role}
                            ral={chip.ral}
                          />
                        ))}
                      </div>
                    )}

                  {/* Освещение: зоны */}
                  {block.block_type === "lighting" &&
                    Array.isArray(block.lighting_zones) &&
                    block.lighting_zones.length > 0 && (
                      <div className="mb-6 divide-y divide-border">
                        {block.lighting_zones.map((zone: any, i: number) => (
                          <div key={i} className="flex flex-wrap gap-4 py-3 text-[13px]">
                            <span className="font-medium">{zone.zone}</span>
                            <span className="text-muted-foreground">{zone.scenario}</span>
                            <span className="text-muted-foreground">{zone.type}</span>
                            <span className="font-mono text-muted-foreground">{zone.kelvin}</span>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Изображения для остальных блоков */}
                  {block.block_type !== "palette" &&
                    block.board_images?.filter((img: any) => img.url).length > 0 && (
                      <div className="grid gap-4 sm:grid-cols-3">
                        {block.board_images
                          .filter((img: any) => img.url)
                          .map((img: any) => (
                            <div key={img.id}>
                              <img
                                src={img.url}
                                alt={img.note || ""}
                                className="aspect-[4/3] w-full object-cover"
                                loading="lazy"
                              />
                              {img.note && (
                                <p className="mt-1 text-[12px] text-muted-foreground">{img.note}</p>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Блок согласования */}
        <section className="border-t border-border pt-12">
          <h2 className="mb-8 text-foreground">Согласование</h2>
          <div className="grid grid-cols-2 gap-16">
            <div>
              <p className="label-style text-muted-foreground mb-12">Дизайнер</p>
              <div className="border-b border-foreground/30 mb-2" />
              <p className="caption-style text-muted-foreground">Подпись / дата</p>
            </div>
            <div>
              <p className="label-style text-muted-foreground mb-12">Клиент</p>
              <div className="border-b border-foreground/30 mb-2" />
              <p className="caption-style text-muted-foreground">Подпись / дата</p>
            </div>
          </div>
        </section>

        {/* Футер со статусом */}
        <p className="text-center caption-style italic">
          {approvalState.status === "contract_ready"
            ? `Утверждённая версия · Приложение к договору · ${new Date().toLocaleDateString("ru-RU")}`
            : `Draft concept, requires designer review · ${new Date().toLocaleDateString("ru-RU")}`}
        </p>

        {/* Навигация */}
        <div className="border-t border-border pt-8">
          <Button
            variant="outline"
            onClick={() => navigate(`/project/${projectId}/board`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Концепт-борд
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExportPage;
