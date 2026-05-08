import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Info, Ruler } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ErgonomicsWarning, ErgonomicsSeverity } from "@/lib/ergonomics-validator";

const SEVERITY_CONFIG: Record<
  ErgonomicsSeverity,
  {
    label: string;
    sublabel: string;
    Icon: typeof AlertTriangle;
    borderClass: string;
    badgeClass: string;
    iconClass: string;
  }
> = {
  critical: {
    label: "Критично",
    sublabel: "Влияет на планировку",
    Icon: AlertTriangle,
    borderClass: "border-l-[hsl(var(--color-critical))]",
    badgeClass: "bg-[hsl(var(--color-critical)/0.1)] text-[hsl(var(--color-critical))]",
    iconClass: "text-[hsl(var(--color-critical))]",
  },
  important: {
    label: "Важно",
    sublabel: "Влияет на решение",
    Icon: AlertCircle,
    borderClass: "border-l-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    iconClass: "text-amber-500",
  },
  optional: {
    label: "Рекомендация",
    sublabel: "Улучшение комфорта",
    Icon: Info,
    borderClass: "border-l-blue-400",
    badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    iconClass: "text-blue-400",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  kitchen: "Кухня",
  passages: "Проходы",
  zoning: "Зонирование",
  storage: "Хранение",
};

interface ErgonomicsPanelProps {
  warnings: ErgonomicsWarning[];
  className?: string;
}

export default function ErgonomicsPanel({ warnings, className }: ErgonomicsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (warnings.length === 0) return null;

  const criticalCount = warnings.filter(w => w.severity === "critical").length;
  const importantCount = warnings.filter(w => w.severity === "important").length;

  const byCategory = warnings.reduce<Record<string, ErgonomicsWarning[]>>((acc, w) => {
    (acc[w.category] ??= []).push(w);
    return acc;
  }, {});

  return (
    <section className={cn("space-y-0", className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="mb-6 flex w-full items-center gap-3 text-left"
      >
        <Ruler className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        <h3 className="label-style text-foreground">Эргономика</h3>
        <div className="ml-auto flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="rounded-full bg-[hsl(var(--color-critical)/0.1)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--color-critical))]">
              {criticalCount} критичных
            </span>
          )}
          {importantCount > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              {importantCount} важных
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {warnings.length} всего
          </span>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          }
        </div>
      </button>

      {expanded && (
        <div className="space-y-8">
          {Object.entries(byCategory).map(([category, items]) => (
            <div key={category}>
              <p className="caption-style mb-4 uppercase tracking-widest text-muted-foreground">
                {CATEGORY_LABELS[category] ?? category}
              </p>
              <div className="divide-y divide-border">
                {items.map((warning) => {
                  const cfg = SEVERITY_CONFIG[warning.severity];
                  const { Icon } = cfg;

                  return (
                    <div
                      key={warning.id}
                      className={cn("py-5 border-l-[3px] pl-6", cfg.borderClass)}
                    >
                      <div className="flex items-start gap-3">
                        <Icon
                          className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.iconClass)}
                          strokeWidth={1.5}
                        />
                        <div className="flex-1 space-y-3">
                          {/* Header */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                                cfg.badgeClass,
                              )}
                            >
                              {cfg.label}: {cfg.sublabel}
                            </span>
                            <span className="text-[15px] font-light text-foreground">
                              {warning.title}
                            </span>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-muted-foreground">{warning.description}</p>

                          {/* Evidence */}
                          <div className="rounded bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground">
                            {warning.evidence}
                          </div>

                          {/* Suggestion */}
                          <div className="rounded border border-border bg-card px-3 py-2.5">
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Рекомендация
                            </p>
                            <p className="text-[13px] text-foreground">{warning.suggestion}</p>
                          </div>

                          {/* Unlocks */}
                          <p className="caption-style">
                            Разблокирует этап:{" "}
                            <span className="text-primary">{warning.unlocks}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
