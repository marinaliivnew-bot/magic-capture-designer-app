import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type FurniturePlan,
  effectiveDims,
  FURNITURE_COLORS,
  PRICE_SEGMENT_LABELS,
  generateProcurementCSV,
} from "@/lib/furniture-plan";
import { getLuminance } from "@/lib/ral-mapping";

interface ProcurementModalProps {
  plans: FurniturePlan[];
  onClose: () => void;
}

const SEGMENT_COLORS: Record<string, string> = {
  economy: "bg-[#E8F0E8] text-[#3A5A3A]",
  mid:     "bg-[#EEF0F8] text-[#3A3A5A]",
  premium: "bg-[#F5EEE8] text-[#5A3A2A]",
};

const ProcurementModal = ({ plans, onClose }: ProcurementModalProps) => {
  const allItems = plans.flatMap(plan =>
    plan.furniture.map(item => ({ ...item, _roomName: plan.room_name }))
  );

  const handleExportCSV = () => {
    const sep = ";";
    const headers = ["Помещение", "Предмет", "Тип", "Ш (м)", "Г (м)", "Материал", "RAL/НЦС", "Покрытие", "Кол-во", "Сегмент"];
    const rows = allItems.map(item => {
      const { w, d } = effectiveDims(item);
      return [
        item._roomName,
        item.name,
        FURNITURE_COLORS[item.type]?.label || item.type,
        w.toFixed(2),
        d.toFixed(2),
        item.material || "—",
        item.ral || "—",
        item.finish || "—",
        String(item.quantity ?? 1),
        item.price_segment ? PRICE_SEGMENT_LABELS[item.price_segment] : "—",
      ].join(sep);
    });
    const csv = [headers.join(sep), ...rows].join("\n");
    const bom = "﻿";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "procurement-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-5xl flex-col border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary">
              Закупка
            </p>
            <h2 className="font-display text-[22px] text-foreground">
              Ведомость мебели
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Скачать CSV
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#F5F0EB]">
              <tr>
                {["Помещение", "Предмет", "Тип", "Размер", "Материал", "RAL/НЦС", "Покрытие", "Кол-во", "Сегмент"].map(h => (
                  <th
                    key={h}
                    className="border-b border-border px-3 py-2.5 text-left font-body text-[10px] uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allItems.map((item, idx) => {
                const { w, d } = effectiveDims(item);
                const typeLabel = FURNITURE_COLORS[item.type]?.label || item.type;
                const defFill = FURNITURE_COLORS[item.type]?.fill || "#C0BCBA";
                const swatchHex = item.hex || defFill;
                const isDark = getLuminance(swatchHex) < 0.35;

                return (
                  <tr
                    key={`${item.id}-${idx}`}
                    className={cn(
                      "border-b border-border transition-colors hover:bg-[#FAF7F4]",
                      idx % 2 === 0 ? "bg-background" : "bg-[#FAFAF8]",
                    )}
                  >
                    <td className="px-3 py-2.5 font-body text-[12px] text-muted-foreground whitespace-nowrap">
                      {item._roomName}
                    </td>
                    <td className="px-3 py-2.5 font-body text-[13px] font-medium text-foreground">
                      {item.name}
                    </td>
                    <td className="px-3 py-2.5 font-body text-[12px] text-muted-foreground whitespace-nowrap">
                      {typeLabel}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {w.toFixed(2)}×{d.toFixed(2)} м
                    </td>
                    <td className="px-3 py-2.5 font-body text-[12px] text-foreground">
                      {item.material || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {item.ral ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-4 w-4 shrink-0 rounded-sm border border-black/10"
                            style={{ backgroundColor: swatchHex }}
                          />
                          <span className={cn(
                            "font-mono text-[11px] px-1.5 py-0.5 rounded-sm",
                            isDark ? "bg-foreground/8 text-foreground" : "text-foreground",
                          )}>
                            {item.ral}
                          </span>
                        </div>
                      ) : (
                        <span className="font-body text-[12px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-body text-[12px] text-muted-foreground capitalize">
                      {item.finish || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-[12px] text-foreground">
                      {item.quantity ?? 1}
                    </td>
                    <td className="px-3 py-2.5">
                      {item.price_segment ? (
                        <span className={cn(
                          "rounded-sm px-2 py-0.5 font-body text-[10px] uppercase tracking-[0.06em]",
                          SEGMENT_COLORS[item.price_segment] || "bg-muted text-muted-foreground",
                        )}>
                          {PRICE_SEGMENT_LABELS[item.price_segment]}
                        </span>
                      ) : (
                        <span className="font-body text-[12px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {allItems.length === 0 && (
            <div className="py-16 text-center">
              <p className="font-body text-[14px] text-muted-foreground">
                Нет мебели для отображения. Сгенерируйте расстановку.
              </p>
            </div>
          )}
        </div>

        {/* Footer summary */}
        <div className="border-t border-border px-6 py-3 flex items-center justify-between">
          <p className="font-body text-[12px] text-muted-foreground">
            Итого позиций: <span className="font-medium text-foreground">{allItems.length}</span>
            {" · "}
            Штук: <span className="font-medium text-foreground">
              {allItems.reduce((s, i) => s + (i.quantity ?? 1), 0)}
            </span>
          </p>
          <p className="font-body text-[11px] text-muted-foreground">
            Скачайте CSV для передачи в закупку или поставщику
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProcurementModal;
