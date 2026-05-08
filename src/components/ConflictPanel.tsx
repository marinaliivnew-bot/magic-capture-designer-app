import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConflictItem, ConflictSeverity } from "@/lib/conflict-detector";

const SEVERITY_CONFIG: Record<
  ConflictSeverity,
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
    sublabel: "Влияет на бюджет",
    Icon: AlertCircle,
    borderClass: "border-l-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    iconClass: "text-amber-500",
  },
  optional: {
    label: "Опционально",
    sublabel: "Детализация",
    Icon: Info,
    borderClass: "border-l-blue-400",
    badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    iconClass: "text-blue-400",
  },
};

interface ConflictPanelProps {
  conflicts: ConflictItem[];
  className?: string;
}

export default function ConflictPanel({ conflicts, className }: ConflictPanelProps) {
  if (conflicts.length === 0) return null;

  const criticalCount = conflicts.filter(c => c.severity === "critical").length;

  return (
    <section className={cn("space-y-0", className)}>
      <div className="mb-6 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-destructive" strokeWidth={1.5} />
        <h3 className="label-style text-foreground">Конфликт данных</h3>
        <div className="ml-auto flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="rounded-full bg-[hsl(var(--color-critical)/0.1)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--color-critical))]">
              {criticalCount} критичных
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {conflicts.length} всего
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {conflicts.map((conflict) => {
          const cfg = SEVERITY_CONFIG[conflict.severity];
          const { Icon } = cfg;

          return (
            <div
              key={conflict.id}
              className={cn("py-6 border-l-[3px] pl-6", cfg.borderClass)}
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
                      {conflict.title}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground">{conflict.description}</p>

                  {/* Evidence */}
                  <div className="space-y-1 rounded bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <p className="italic">{conflict.evidence_a}</p>
                    <p className="italic">{conflict.evidence_b}</p>
                  </div>

                  {/* Question for client */}
                  <div className="rounded border border-border bg-card px-3 py-2.5">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Вопрос клиенту
                    </p>
                    <p className="text-[13px] text-foreground">{conflict.question}</p>
                  </div>

                  {/* Unlocks */}
                  <p className="caption-style">
                    Разблокирует этап:{" "}
                    <span className="text-primary">{conflict.unlocks}</span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
