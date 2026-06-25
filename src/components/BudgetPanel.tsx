import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Info, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calculateBudget,
  type BriefBudgetInput,
  type BudgetRegion,
  type BudgetSegment,
  type ProjectBudgetInput,
  type RoomBudgetInput,
} from "@/lib/budget-calculator";
import { loadBudgetSettings, saveBudgetSettings } from "@/lib/budget-settings";
import { ROOM_TYPES } from "@/lib/constants";

const SEGMENT_CONFIG: Record<BudgetSegment, { label: string; hint: string }> = {
  economy: { label: "Эконом", hint: "масс-маркет" },
  middle:  { label: "Средний", hint: "европейский" },
  premium: { label: "Премиум", hint: "натуральные" },
};

const REGION_CONFIG: Record<BudgetRegion, { label: string; hint: string }> = {
  regions: { label: "Регионы", hint: "×1.00" },
  moscow: { label: "Москва", hint: "×1.18" },
  custom: { label: "Ручной", hint: "по ставкам" },
};

const ROOM_TYPE_LABELS = Object.fromEntries(ROOM_TYPES.map(r => [r.value, r.label]));

function fmtRub(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
}

interface BudgetPanelProps {
  brief: BriefBudgetInput;
  rooms: RoomBudgetInput[];
  project: ProjectBudgetInput;
  className?: string;
}

export default function BudgetPanel({ brief, rooms, project, className }: BudgetPanelProps) {
  const projectId = project.id;
  const savedSettings = useMemo(() => loadBudgetSettings(projectId), [projectId]);
  const [manualSegment, setManualSegment] = useState<BudgetSegment | null>(savedSettings.segment || null);
  const [region, setRegion] = useState<BudgetRegion>(savedSettings.region || "regions");
  const [ratePercent, setRatePercent] = useState(Math.round(((savedSettings.manualRateMultiplier || 1) - 1) * 100));
  const [expanded, setExpanded] = useState(false);
  const manualRateMultiplier = Math.max(0.5, Math.min(2, 1 + ratePercent / 100));

  const result = useMemo(
    () => calculateBudget(brief, rooms, project, {
      segment: manualSegment ?? undefined,
      region,
      manualRateMultiplier,
    }),
    [brief, rooms, project, manualSegment, region, manualRateMultiplier],
  );

  const persistSettings = (next: {
    segment?: BudgetSegment | null;
    region?: BudgetRegion;
    ratePercent?: number;
  }) => {
    const nextSegment = next.segment === undefined ? manualSegment : next.segment;
    const nextRegion = next.region || region;
    const nextRatePercent = next.ratePercent === undefined ? ratePercent : next.ratePercent;
    saveBudgetSettings(projectId, {
      segment: nextSegment || undefined,
      region: nextRegion,
      manualRateMultiplier: Math.max(0.5, Math.min(2, 1 + nextRatePercent / 100)),
    });
  };

  const hasBudget = result.budgetLimit !== null;
  const hasEstimate = result.totalEstimate > 0;

  // Only render when there's something to show
  if (!hasBudget && !result.hasRooms) return null;

  const fillPercent =
    hasBudget && hasEstimate
      ? Math.min((result.totalEstimate / result.budgetLimit!) * 100, 120)
      : null;

  const activeSegment = result.segment;

  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            <h3 className="label-style text-foreground">Предварительный расчёт</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Ориентир по комплектации. Не смета подрядчика.
          </p>
        </div>
        {manualSegment !== null && (
          <button
            type="button"
            onClick={() => {
              setManualSegment(null);
              setRegion("regions");
              setRatePercent(0);
              saveBudgetSettings(projectId, { region: "regions", manualRateMultiplier: 1 });
            }}
            className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Segment switcher */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        {(Object.entries(SEGMENT_CONFIG) as [BudgetSegment, { label: string; hint: string }][]).map(
          ([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setManualSegment(key);
                persistSettings({ segment: key });
              }}
              className={cn(
                "rounded border px-3 py-2.5 text-center transition-colors",
                activeSegment === key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              <p className="text-xs font-medium">{cfg.label}</p>
              <p
                className={cn(
                  "mt-0.5 text-[10px]",
                  activeSegment === key ? "opacity-60" : "opacity-50",
                )}
              >
                {result.detectedSegment === key && manualSegment === null
                  ? "из брифа"
                  : cfg.hint}
              </p>
            </button>
          ),
        )}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_140px]">
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(REGION_CONFIG) as [BudgetRegion, { label: string; hint: string }][]).map(
            ([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setRegion(key);
                  persistSettings({ region: key });
                }}
                className={cn(
                  "rounded border px-3 py-2.5 text-center transition-colors",
                  region === key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                <p className="text-xs font-medium">{cfg.label}</p>
                <p className={cn("mt-0.5 text-[10px]", region === key ? "opacity-60" : "opacity-50")}>
                  {cfg.hint}
                </p>
              </button>
            ),
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Коррекция ставок, %</span>
          <input
            type="number"
            value={ratePercent}
            min={-50}
            max={100}
            step={5}
            onChange={(event) => {
              const next = Number(event.target.value);
              const safeNext = Number.isFinite(next) ? next : 0;
              setRatePercent(safeNext);
              persistSettings({ ratePercent: safeNext });
            }}
            className="h-10 w-full rounded border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
      </div>

      {/* Totals row */}
      {hasEstimate ? (
        <div className="mb-5 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Оценка</span>
            <span
              className={cn(
                "text-[18px] font-light tabular-nums",
                result.overBudget ? "text-destructive" : "text-foreground",
              )}
            >
              {result.estimateRange
                ? `${fmtRub(result.estimateRange.min)} – ${fmtRub(result.estimateRange.max)}`
                : fmtRub(result.totalEstimate)}
            </span>
          </div>

          {hasBudget && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Лимит клиента</span>
              <span className="text-sm text-foreground">{fmtRub(result.budgetLimit!)}</span>
            </div>
          )}

          {fillPercent !== null && (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    result.overBudget ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${Math.min(fillPercent, 100)}%` }}
                />
              </div>
              <p
                className={cn(
                  "text-right text-[11px]",
                  result.overBudget ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {result.overBudget
                  ? `Превышение на ${result.overBudgetPercent}%`
                  : `${Math.round(fillPercent)}% от лимита`}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-5 rounded bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Добавьте размеры помещений для детального расчёта
        </div>
      )}

      {/* Over-budget question */}
      {result.overBudget && (
        <div className="mb-5 rounded border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              strokeWidth={1.5}
            />
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Вопрос клиенту
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-200">
                Оценка превышает бюджет на {result.overBudgetPercent}%. Рассматривает ли клиент
                снижение сегмента в части помещений, или бюджет может быть пересмотрен?
              </p>
              <p className="caption-style text-amber-700 dark:text-amber-500">
                Разблокирует этап:{" "}
                <span className="font-medium">Подбор материалов</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Functional overrides */}
      {result.functionalOverrides.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {result.functionalOverrides.map((override, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" strokeWidth={1.5} />
              <span>{override}</span>
            </div>
          ))}
        </div>
      )}

      {/* Methodology */}
      <div className="mb-4 border-t border-border pt-4">
        <p className="mb-2 text-xs font-medium text-foreground">Методика расчета</p>
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <p>Сегмент: <span className="text-foreground">{SEGMENT_CONFIG[result.segment].label}</span></p>
            <p>Регион: <span className="text-foreground">{REGION_CONFIG[result.region].label}</span></p>
            <p>Коэффициент: <span className="text-foreground">×{(result.regionCoefficient * result.manualRateMultiplier).toFixed(2)}</span></p>
            <p>Версия: <span className="text-foreground">{result.methodologyVersion}</span></p>
            <p>Дата: <span className="text-foreground">{result.methodologyDate}</span></p>
          </div>
          <div>
            {result.rateRows.map((row) => (
              <p key={row.label}>
                {row.label}:{" "}
                <span className="text-foreground">
                  {typeof row.value === "number" ? fmtRub(row.value) : row.value}
                </span>
              </p>
            ))}
          </div>
        </div>
        {expanded && (
          <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <p className="mb-1 font-medium text-foreground">Допущения</p>
              {result.assumptions.map((item) => <p key={item}>{item}</p>)}
            </div>
            <div>
              <p className="mb-1 font-medium text-foreground">Входит</p>
              {result.includes.map((item) => <p key={item}>{item}</p>)}
            </div>
            <div>
              <p className="mb-1 font-medium text-foreground">Не входит</p>
              {result.excludes.map((item) => <p key={item}>{item}</p>)}
            </div>
          </div>
        )}
      </div>

      {/* Room breakdown (expandable) */}
      {result.roomEstimates.length > 0 && (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setExpanded(prev => !prev)}
            className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
          >
            <span>Детали по помещениям ({result.roomEstimates.length})</span>
            {expanded
              ? <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} />
              : <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
            }
          </button>

          {expanded && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 text-left font-normal">Помещение</th>
                    <th className="pb-2 text-right font-normal">м²</th>
                    <th className="pb-2 text-right font-normal">Отделка</th>
                    <th className="pb-2 text-right font-normal">Мебель</th>
                    <th className="pb-2 text-right font-normal">Итого</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.roomEstimates.map(r => (
                    <tr key={r.roomName}>
                      <td className="py-2 text-foreground">
                        {r.roomName}
                        <span className="ml-1 text-muted-foreground">
                          ({ROOM_TYPE_LABELS[r.roomType] ?? r.roomType})
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {r.areaSqm.toFixed(1)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {fmtRub(r.flooring + r.walls + r.ceiling)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {fmtRub(r.furniture)}
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium text-foreground">
                        {fmtRub(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border">
                    <td colSpan={4} className="pt-2.5 text-muted-foreground">
                      Итого (без работ)
                    </td>
                    <td className="pt-2.5 text-right tabular-nums font-medium text-foreground">
                      {fmtRub(result.totalEstimate)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rooms without area data */}
      {result.missingAreaRooms.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Без площади, не учтены:{" "}
          <span className="text-foreground">{result.missingAreaRooms.join(", ")}</span>
        </p>
      )}
    </div>
  );
}
