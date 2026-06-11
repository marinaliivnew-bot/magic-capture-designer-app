import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, Download, Loader2, Navigation,
  RefreshCw, RotateCw, ShoppingCart, Sparkles, ChevronDown, ChevronUp,
  Plus, Trash2, Wand2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrief, getProject, generateFurniturePlan } from "@/lib/api";
import { getRooms } from "@/lib/rooms";
import { Button } from "@/components/ui/button";
import ProjectHeader from "@/components/ProjectHeader";
import ProjectStepNav from "@/components/ProjectStepNav";
import ProcurementModal from "@/components/ProcurementModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  type FurnitureItem,
  type FurniturePlan,
  type PlanWarning,
  type PriceSegment,
  type FurniturePreset,
  effectiveDims,
  validatePlan,
  FURNITURE_COLORS,
  PRICE_SEGMENT_LABELS,
  FINISH_OPTIONS,
  TYPE_GROUPS,
  FURNITURE_CATALOG,
  filterFurniture,
  parseRoomDimensions,
  savePlanToStorage,
  loadPlanFromStorage,
  generateFlowData,
  createFurnitureItem,
  estimateBudget,
  formatRub,
} from "@/lib/furniture-plan";
import { RAL_CLASSIC, getLuminance } from "@/lib/ral-mapping";

// Interior-focused RAL palette (curated subset ~60 colors)
const INTERIOR_RAL = RAL_CLASSIC.filter(c => {
  const num = parseInt(c.code.replace("RAL ", ""), 10);
  return (
    (num >= 1001 && num <= 1020) ||        // Beiges / yellows
    (num >= 7000 && num <= 7048) ||        // Greys (most used)
    (num >= 8001 && num <= 8029) ||        // Browns / wood tones
    (num >= 9001 && num <= 9018) ||        // Whites / blacks
    [6003, 6005, 6011, 6013, 6019, 6021,  // Greens popular in interiors
     5007, 5008, 5014, 5023, 5024,         // Blues
     3012, 3014, 3015].includes(num)       // Pinks / dusty rose
  );
});

const CANVAS_W = 680;
const CANVAS_H = 520;
const PADDING = 28;
const SNAP = 0.05;

function snapTo(val: number): number {
  return Math.round(val / SNAP) * SNAP;
}

// ─── RAL Picker popup ─────────────────────────────────────────────────────────
interface RALPickerProps {
  currentHex?: string;
  onSelect: (ral: string, hex: string) => void;
  onClose: () => void;
}

const RALPicker = ({ currentHex, onSelect, onClose }: RALPickerProps) => (
  <div
    className="absolute z-30 right-0 top-8 w-72 border border-border bg-background shadow-xl p-3"
    onClick={e => e.stopPropagation()}
  >
    <p className="font-body text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-2">
      Выберите RAL
    </p>
    <div className="grid grid-cols-8 gap-1 max-h-52 overflow-y-auto">
      {INTERIOR_RAL.map(c => (
        <button
          key={c.code}
          title={`${c.code} — ${c.name}`}
          onClick={() => { onSelect(c.code, c.hex); onClose(); }}
          className={cn(
            "h-7 w-7 rounded-sm border transition-transform hover:scale-110",
            currentHex === c.hex ? "border-foreground ring-1 ring-foreground" : "border-black/10",
          )}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
    <button
      onClick={onClose}
      className="mt-2 w-full font-body text-[11px] text-muted-foreground hover:text-foreground transition-colors"
    >
      Закрыть
    </button>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const FurniturePlanPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoomIdx, setSelectedRoomIdx] = useState(0);
  const [plan, setPlan] = useState<FurniturePlan | null>(null);
  const [warnings, setWarnings] = useState<PlanWarning[]>([]);
  const [generating, setGenerating] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [showFlow, setShowFlow] = useState(true);

  // 6.7 state
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [ralPickerItemId, setRalPickerItemId] = useState<string | null>(null);
  const [typeGroupFilter, setTypeGroupFilter] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [showProcurement, setShowProcurement] = useState(false);

  // 6.8 state
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogGroup, setCatalogGroup] = useState(Object.keys(FURNITURE_CATALOG)[0]);
  const [aiEstimate, setAiEstimate] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const [proj, briefData, roomData] = await Promise.all([
          getProject(projectId),
          getBrief(projectId),
          getRooms(projectId),
        ]);
        setProject(proj);
        setBrief(briefData);
        setRooms(roomData || []);
      } catch {
        toast.error("Не удалось загрузить данные проекта");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  useEffect(() => {
    if (!projectId || rooms.length === 0) return;
    const room = rooms[selectedRoomIdx];
    if (!room) return;
    const saved = loadPlanFromStorage(projectId, room.name);
    setPlan(saved);
    setExpandedItemId(null);
    setRalPickerItemId(null);
    setTypeGroupFilter("");
    setSegmentFilter("");
  }, [projectId, selectedRoomIdx, rooms]);

  useEffect(() => {
    if (plan) setWarnings(validatePlan(plan));
    else setWarnings([]);
  }, [plan]);

  useEffect(() => {
    const ids = new Set<string>();
    warnings.filter(w => w.severity === "critical").forEach(w => w.itemIds?.forEach(id => ids.add(id)));
    setHighlightedIds(ids);
  }, [warnings]);

  const selectedRoom = rooms[selectedRoomIdx];
  const roomDims = selectedRoom ? parseRoomDimensions(selectedRoom.dimensions_text || "") : null;

  const scale = plan
    ? Math.min(
        (CANVAS_W - PADDING * 2) / plan.room_width,
        (CANVAS_H - PADDING * 2) / plan.room_length,
      )
    : 80;

  const planW = plan ? plan.room_width * scale : 0;
  const planH = plan ? plan.room_length * scale : 0;

  const handleGenerate = async () => {
    if (!selectedRoom || !projectId) return;
    if (!roomDims) {
      toast.error("Укажите размеры комнаты в формате «4×3» перед генерацией");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateFurniturePlan(projectId, {
        roomName: selectedRoom.name,
        roomType: selectedRoom.room_type || "other",
        roomWidth: roomDims.width,
        roomLength: roomDims.length,
        briefScenarios: brief?.scenarios || "",
        briefZones: brief?.zones || "",
        briefUsers: brief?.users_of_space || "",
      });
      setPlan(result);
      savePlanToStorage(projectId, result);
      toast.success("Расстановка сгенерирована");
    } catch (e: any) {
      toast.error(e.message || "Ошибка генерации");
    } finally {
      setGenerating(false);
    }
  };

  const updatePlan = useCallback((updater: (prev: FurniturePlan) => FurniturePlan) => {
    setPlan(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      if (projectId) savePlanToStorage(projectId, next);
      return next;
    });
  }, [projectId]);

  const updateItem = useCallback((itemId: string, patch: Partial<FurnitureItem>) => {
    updatePlan(prev => ({
      ...prev,
      furniture: prev.furniture.map(f => f.id === itemId ? { ...f, ...patch } : f),
    }));
  }, [updatePlan]);

  const handleRotate = (itemId: string) => {
    updatePlan(prev => ({
      ...prev,
      furniture: prev.furniture.map(f => {
        if (f.id !== itemId) return f;
        const newRot = (f.rotation + 90) % 360;
        const { w, d } = effectiveDims({ ...f, rotation: newRot });
        return { ...f, rotation: newRot, x: Math.min(f.x, prev.room_width - w), y: Math.min(f.y, prev.room_length - d) };
      }),
    }));
  };

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>, itemId: string) => {
    e.preventDefault();
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    if (!svgRef.current || !plan) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const roomX = (e.clientX - svgRect.left - PADDING - 20) / scale;
    const roomY = (e.clientY - svgRect.top - PADDING) / scale;
    const item = plan.furniture.find(f => f.id === itemId)!;
    dragging.current = { id: itemId, offsetX: roomX - item.x, offsetY: roomY - item.y };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current || !plan || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const rawX = (e.clientX - svgRect.left - PADDING - 20) / scale - dragging.current.offsetX;
    const rawY = (e.clientY - svgRect.top - PADDING) / scale - dragging.current.offsetY;
    const item = plan.furniture.find(f => f.id === dragging.current!.id)!;
    const { w, d } = effectiveDims(item);
    const newX = Math.max(0, Math.min(plan.room_width - w, snapTo(rawX)));
    const newY = Math.max(0, Math.min(plan.room_length - d, snapTo(rawY)));
    updatePlan(prev => ({
      ...prev,
      furniture: prev.furniture.map(f =>
        f.id === dragging.current!.id ? { ...f, x: newX, y: newY } : f
      ),
    }));
  };

  const handlePointerUp = () => { dragging.current = null; };

  const handleAddItem = (preset: FurniturePreset) => {
    if (!plan) return;
    const item = createFurnitureItem(preset, plan.room_width, plan.room_length);
    updatePlan(prev => ({ ...prev, furniture: [...prev.furniture, item] }));
    setShowCatalog(false);
    toast.success(`«${preset.name}» добавлен`);
  };

  const handleRemoveItem = (itemId: string) => {
    updatePlan(prev => ({
      ...prev,
      furniture: prev.furniture.filter(f => f.id !== itemId),
    }));
    if (expandedItemId === itemId) setExpandedItemId(null);
  };

  const handleAiEstimate = async () => {
    if (!plan) return;
    setEstimating(true);
    setAiEstimate(null);
    try {
      const budget = estimateBudget(plan.furniture);
      const itemsList = plan.furniture.map(f => {
        const seg = f.price_segment ? PRICE_SEGMENT_LABELS[f.price_segment] : 'не указан';
        return `- ${f.name} (${seg}${f.material ? ', ' + f.material : ''})`;
      }).join('\n');
      const prompt = `Ты — эксперт по интерьеру. Дизайнер расставил мебель в комнате "${plan.room_name}" (${plan.room_width}×${plan.room_length} м).

Текущий список мебели:
${itemsList}

Предварительная оценка бюджета (по ценовым сегментам):
- Минимальный: ${formatRub(budget.minTotal)}
- Максимальный: ${formatRub(budget.maxTotal)}

1. Оцени состав мебели: есть ли очевидные пробелы или лишние предметы для данного типа помещения?
2. Дай краткий комментарий по бюджету (3–4 предложения).
3. Предложи 1–2 конкретных улучшения.

Отвечай на русском, кратко и профессионально.`;

      const { data, error } = await supabase.functions.invoke("estimate-furniture", {
        body: { prompt },
      });
      if (error) {
        console.error("estimate-furniture invoke error:", error);
        toast.error("Не удалось получить оценку AI. Попробуйте ещё раз.");
        return;
      }
      const text = data?.text || "Не удалось получить ответ";
      setAiEstimate(text);
    } catch (e) {
      console.error("handleAiEstimate error:", e);
      toast.error("Ошибка при обращении к AI");
    } finally {
      setEstimating(false);
    }
  };

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan-${plan?.room_name || "room"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── SVG renderers ──────────────────────────────────────────────────────────
  const renderGrid = () => {
    if (!plan) return null;
    const lines = [];
    const step = scale;
    for (let x = 0; x <= planW; x += step)
      lines.push(<line key={`gx${x}`} x1={x} y1={0} x2={x} y2={planH} stroke="#E8E4E0" strokeWidth={0.5} />);
    for (let y = 0; y <= planH; y += step)
      lines.push(<line key={`gy${y}`} x1={0} y1={y} x2={planW} y2={y} stroke="#E8E4E0" strokeWidth={0.5} />);
    return <g>{lines}</g>;
  };

  const renderItem = (item: FurnitureItem) => {
    const { w, d } = effectiveDims(item);
    const defaults = FURNITURE_COLORS[item.type] || FURNITURE_COLORS.other;
    // Use item's hex if available, fall back to default palette
    const fill = item.hex || defaults.fill;
    const stroke = item.hex
      ? `color-mix(in srgb, ${item.hex} 60%, #333 40%)`
      : defaults.stroke;
    const sx = item.x * scale;
    const sy = item.y * scale;
    const sw = w * scale;
    const sd = d * scale;
    const isBad = highlightedIds.has(item.id);
    const fontSize = Math.max(8, Math.min(11, sw / Math.max(item.name.length, 4) * 1.6));
    const textColor = isBad ? "#8B0000" : (getLuminance(fill) < 0.4 ? "#F0EDE8" : "#3A3530");

    return (
      <g
        key={item.id}
        style={{ cursor: "grab", touchAction: "none" }}
        onPointerDown={e => handlePointerDown(e, item.id)}
      >
        <rect
          x={sx} y={sy} width={sw} height={sd}
          fill={fill}
          stroke={isBad ? "#D94040" : defaults.stroke}
          strokeWidth={isBad ? 2 : 1}
          rx={2}
        />
        {sw > 32 && sd > 18 && (
          <text
            x={sx + sw / 2} y={sy + sd / 2 - (sw > 50 && sd > 28 ? 5 : 0)}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={fontSize} fill={textColor}
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {item.name.length > 16 ? item.name.slice(0, 14) + "…" : item.name}
          </text>
        )}
        {sw > 50 && sd > 28 && (
          <text
            x={sx + sw / 2} y={sy + sd / 2 + 9}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={8} fill={textColor} opacity={0.7}
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {w.toFixed(1)}×{d.toFixed(1)}м
          </text>
        )}
      </g>
    );
  };

  const renderDimLabels = () => {
    if (!plan) return null;
    return (
      <g>
        <text x={planW / 2} y={-10} textAnchor="middle" fontSize={10} fill="#8A8078" style={{ userSelect: "none" }}>
          {plan.room_width.toFixed(1)} м
        </text>
        <text x={-10} y={planH / 2} textAnchor="middle" fontSize={10} fill="#8A8078"
          transform={`rotate(-90, -10, ${planH / 2})`} style={{ userSelect: "none" }}>
          {plan.room_length.toFixed(1)} м
        </text>
      </g>
    );
  };

  const renderFlowOverlay = () => {
    if (!plan) return null;
    const flow = generateFlowData(plan);
    if (flow.routes.length === 0) return null;
    const pt = ([x, y]: [number, number]): [number, number] => [x * scale, y * scale];
    const curvePath = (from: [number, number], to: [number, number]): string => {
      const [x1, y1] = pt(from); const [x2, y2] = pt(to);
      const dx = x2 - x1, dy = y2 - y1; const len = Math.hypot(dx, dy);
      if (len < 2) return `M${x1},${y1} L${x2},${y2}`;
      const px = -dy / len, py = dx / len; const offset = Math.min(len * 0.14, 22);
      return `M${x1},${y1} Q${(x1 + x2) / 2 + px * offset},${(y1 + y2) / 2 + py * offset} ${x2},${y2}`;
    };
    const [ex, ey] = pt(flow.entry);
    return (
      <>
        <defs>
          <marker id="flow-arrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
            <polygon points="0,0 7,3.5 0,7" fill="#4A7FA5" opacity="0.9" />
          </marker>
        </defs>
        <circle cx={ex} cy={ey} r={8} fill="#4A7FA5" opacity={0.18} />
        <circle cx={ex} cy={ey} r={4} fill="#4A7FA5" opacity={0.7} />
        <text x={ex} y={ey + 14} textAnchor="middle" fontSize={8} fill="#4A7FA5" style={{ userSelect: "none" }}>вход</text>
        {flow.routes.map(route => (
          <path key={route.id} d={curvePath(route.from, route.to)}
            fill="none" stroke="#4A7FA5" strokeWidth={1.5} strokeDasharray="7,4"
            strokeLinecap="round" markerEnd="url(#flow-arrow)" opacity={0.65} />
        ))}
        {flow.zones.map(zone => {
          const [zx, zy] = pt(zone.center);
          return (
            <g key={zone.type}>
              <circle cx={zx} cy={zy} r={5} fill="#4A7FA5" opacity={0.22} />
              <circle cx={zx} cy={zy} r={2.5} fill="#4A7FA5" opacity={0.55} />
              <text x={zx} y={zy - 9} textAnchor="middle" fontSize={8} fill="#4A7FA5" style={{ userSelect: "none" }}>{zone.label}</text>
            </g>
          );
        })}
      </>
    );
  };

  // ─── Sidebar: item editor ───────────────────────────────────────────────────
  const renderItemEditor = (item: FurnitureItem) => {
    const isExpanded = expandedItemId === item.id;
    const ralOpen = ralPickerItemId === item.id;
    const { w, d } = effectiveDims(item);
    const defaults = FURNITURE_COLORS[item.type] || FURNITURE_COLORS.other;
    const swatchHex = item.hex || defaults.fill;
    const isBad = highlightedIds.has(item.id);

    return (
      <div key={item.id} className={cn(
        "border transition-colors",
        isBad ? "border-[hsl(var(--color-critical))]/40 bg-[hsl(var(--color-critical))]/5" : "border-border",
      )}>
        {/* Item row */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Color swatch — click to open RAL picker */}
            <div className="relative shrink-0">
              <button
                title="Изменить цвет (RAL)"
                onClick={() => setRalPickerItemId(ralOpen ? null : item.id)}
                className="h-5 w-5 rounded-sm border border-black/15 shadow-sm hover:scale-110 transition-transform"
                style={{ background: swatchHex }}
              />
              {ralOpen && (
                <RALPicker
                  currentHex={item.hex}
                  onSelect={(ral, hex) => updateItem(item.id, { ral, hex })}
                  onClose={() => setRalPickerItemId(null)}
                />
              )}
            </div>
            <span className="font-body text-[12px] text-foreground truncate">{item.name}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <span className="font-mono text-[11px] text-muted-foreground">{w.toFixed(1)}×{d.toFixed(1)}</span>
            <button onClick={() => handleRotate(item.id)} title="Повернуть на 90°"
              className="text-muted-foreground hover:text-foreground transition-colors">
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
              className="text-muted-foreground hover:text-foreground transition-colors">
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => handleRemoveItem(item.id)}
              title="Удалить предмет"
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Expanded editor */}
        {isExpanded && (
          <div className="border-t border-border bg-[#FAFAF8] px-3 py-3 space-y-2.5">
            {/* RAL display */}
            {item.ral && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-sm border border-black/10" style={{ backgroundColor: item.hex || swatchHex }} />
                <span className="font-mono text-[11px] text-foreground">{item.ral}</span>
                <button
                  onClick={() => setRalPickerItemId(item.id)}
                  className="font-body text-[10px] text-primary underline underline-offset-2"
                >
                  Изменить
                </button>
              </div>
            )}
            {!item.ral && (
              <button
                onClick={() => setRalPickerItemId(item.id)}
                className="font-body text-[11px] text-primary underline underline-offset-2"
              >
                + Назначить RAL-цвет
              </button>
            )}

            {/* Material */}
            <div>
              <label className="font-body text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Материал
              </label>
              <input
                type="text"
                value={item.material || ""}
                onChange={e => updateItem(item.id, { material: e.target.value })}
                placeholder="Дуб беленый, МДФ покрашенный…"
                className="mt-1 w-full border border-border bg-background px-2 py-1 font-body text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Finish */}
            <div>
              <label className="font-body text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Покрытие
              </label>
              <select
                value={item.finish || ""}
                onChange={e => updateItem(item.id, { finish: e.target.value })}
                className="mt-1 w-full border border-border bg-background px-2 py-1 font-body text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Не указано</option>
                {FINISH_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Price segment + quantity row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-body text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Сегмент
                </label>
                <select
                  value={item.price_segment || ""}
                  onChange={e => updateItem(item.id, { price_segment: e.target.value as PriceSegment || undefined })}
                  className="mt-1 w-full border border-border bg-background px-2 py-1 font-body text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">—</option>
                  <option value="economy">Эконом</option>
                  <option value="mid">Средний</option>
                  <option value="premium">Премиум</option>
                </select>
              </div>
              <div>
                <label className="font-body text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Кол-во
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={item.quantity ?? 1}
                  onChange={e => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="mt-1 w-full border border-border bg-background px-2 py-1 font-mono text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const criticalCount = warnings.filter(w => w.severity === "critical").length;
  const importantCount = warnings.filter(w => w.severity === "important").length;
  const filteredFurniture = plan
    ? filterFurniture(plan.furniture, typeGroupFilter, segmentFilter)
    : [];

  return (
    <div className="min-h-screen bg-background">
      <ProjectHeader project={project} />

      <div className="border-b border-border bg-background px-6 py-3">
        <ProjectStepNav projectId={projectId!} currentStep="furniture-plan" />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Page title */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="font-body text-[11px] uppercase tracking-[0.15em] text-primary mb-1">
              Расстановка мебели
            </p>
            <h1 className="font-display text-[28px] text-foreground">Furniture Plan</h1>
            <p className="font-body text-[14px] text-muted-foreground mt-1">
              AI генерирует черновую расстановку — дизайнер корректирует перетаскиванием
            </p>
          </div>
          {plan && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setShowProcurement(true)}
                className="gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                Передать в закупку
              </Button>
              <Button
                variant={showFlow ? "default" : "outline"} size="sm"
                onClick={() => setShowFlow(v => !v)}
                className="gap-2"
                title="Показать / скрыть маршруты движения"
              >
                <Navigation className="h-4 w-4" />
                Маршруты
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportSVG} className="gap-2">
                <Download className="h-4 w-4" />
                Экспорт SVG
              </Button>
            </div>
          )}
        </div>

        {/* Room selector */}
        {rooms.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {rooms.map((room, idx) => {
              const dims = parseRoomDimensions(room.dimensions_text || "");
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomIdx(idx)}
                  className={cn(
                    "rounded-none border px-4 py-2 font-body text-[12px] uppercase tracking-[0.08em] transition-colors duration-200",
                    idx === selectedRoomIdx
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                  )}
                >
                  {room.name}
                  {dims && <span className="ml-2 opacity-60">{dims.width.toFixed(0)}×{dims.length.toFixed(0)} м</span>}
                </button>
              );
            })}
          </div>
        )}

        {rooms.length === 0 && (
          <div className="mb-6 border border-[#D0C8C0] bg-[#F5F0EB] p-4">
            <p className="font-body text-[14px] text-[#5A5248]">
              Добавьте помещения в разделе{" "}
              <button className="text-primary underline underline-offset-2"
                onClick={() => navigate(`/project/${projectId}/edit`)}>
                Ввод данных
              </button>
              , затем вернитесь сюда.
            </p>
          </div>
        )}

        {/* Generate button */}
        {selectedRoom && (
          <div className="mb-6 flex items-center gap-4">
            <Button onClick={handleGenerate} disabled={generating || !roomDims} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" />
                : plan ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {plan ? "Перегенерировать" : "Сгенерировать расстановку"}
            </Button>
            {!roomDims && (
              <p className="font-body text-[13px] text-muted-foreground">
                Укажите размеры «{selectedRoom.name}» в формате <span className="font-mono">4×3</span>
              </p>
            )}
          </div>
        )}

        {/* Main layout */}
        {plan && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
            {/* SVG Canvas */}
            <div>
              <div
                className="relative overflow-auto rounded-none border border-[#D0C8C0] bg-[#FAFAF8]"
                style={{ minHeight: CANVAS_H + 20 }}
                onClick={() => { setExpandedItemId(null); setRalPickerItemId(null); }}
              >
                <svg
                  ref={svgRef}
                  width={planW + PADDING * 2 + 20}
                  height={planH + PADDING * 2 + 20}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  style={{ display: "block", touchAction: "none" }}
                >
                  <g transform={`translate(${PADDING + 20}, ${PADDING})`}>
                    {renderDimLabels()}
                    <rect x={0} y={0} width={planW} height={planH} fill="#F0EBE4" stroke="#A09888" strokeWidth={2} />
                    {renderGrid()}
                    {showFlow && renderFlowOverlay()}
                    {plan.furniture.map(renderItem)}
                    <text x={planW - 6} y={planH - 6} textAnchor="end" fontSize={9} fill="#C0B8B0" style={{ userSelect: "none" }}>
                      ↑ С
                    </text>
                  </g>
                </svg>
                <p className="absolute bottom-3 right-4 font-body text-[11px] text-muted-foreground">
                  Перетащите предметы · двойной клик → повернуть
                </p>
              </div>

              {plan.notes && (
                <div className="mt-4 border-l-2 border-primary/30 pl-4">
                  <p className="font-body text-[13px] text-muted-foreground leading-relaxed">
                    <span className="text-primary font-medium">Логика расстановки: </span>
                    {plan.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Validation */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="font-body text-[11px] uppercase tracking-[0.1em] text-foreground">
                    Проверка проходов
                  </p>
                  {warnings.length === 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-body text-[10px] uppercase tracking-[0.08em] text-primary">OK</span>
                  )}
                </div>
                {warnings.length === 0 ? (
                  <p className="font-body text-[13px] text-muted-foreground">
                    Все проходы в норме.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {criticalCount > 0 && (
                      <div className="flex items-center gap-1.5 font-body text-[11px] text-[hsl(var(--color-critical))]">
                        <AlertTriangle className="h-3.5 w-3.5" />Критично: {criticalCount}
                      </div>
                    )}
                    {importantCount > 0 && (
                      <div className="flex items-center gap-1.5 font-body text-[11px] text-primary">
                        <AlertTriangle className="h-3.5 w-3.5" />Важно: {importantCount}
                      </div>
                    )}
                    {warnings.map(w => (
                      <div
                        key={w.id}
                        className={cn(
                          "border p-3",
                          w.severity === "critical"
                            ? "border-[hsl(var(--color-critical))]/30 bg-[hsl(var(--color-critical))]/5"
                            : "border-primary/20 bg-primary/5",
                        )}
                        onMouseEnter={() => { if (w.itemIds) setHighlightedIds(new Set(w.itemIds)); }}
                        onMouseLeave={() => {
                          const ids = new Set<string>();
                          warnings.filter(x => x.severity === "critical").forEach(x => x.itemIds?.forEach(id => ids.add(id)));
                          setHighlightedIds(ids);
                        }}
                      >
                        <p className={cn("font-body text-[12px] font-medium mb-0.5",
                          w.severity === "critical" ? "text-[hsl(var(--color-critical))]" : "text-primary")}>
                          {w.title}
                        </p>
                        <p className="font-body text-[12px] text-muted-foreground leading-relaxed">{w.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ─── Budget meter ────────────────────────────────────────── */}
              {(() => {
                const budget = estimateBudget(plan.furniture);
                const hasData = budget.minTotal > 0;
                return (
                  <div>
                    <p className="font-body text-[11px] uppercase tracking-[0.1em] text-foreground mb-2">
                      Оценка бюджета
                    </p>
                    {hasData ? (
                      <div className="space-y-2">
                        <div className="flex justify-between font-body text-[12px]">
                          <span className="text-muted-foreground">Диапазон:</span>
                          <span className="text-foreground font-medium">
                            {formatRub(budget.minTotal)} — {formatRub(budget.maxTotal)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {(Object.entries(budget.bySegment) as [PriceSegment, any][])
                            .filter(([, v]) => v.count > 0)
                            .map(([seg, v]) => (
                              <div key={seg} className="flex justify-between font-body text-[11px]">
                                <span className="text-muted-foreground">
                                  {PRICE_SEGMENT_LABELS[seg]} ({v.count} шт.):
                                </span>
                                <span className="text-foreground">
                                  {formatRub(v.min)} — {formatRub(v.max)}
                                </span>
                              </div>
                            ))}
                          {budget.unassigned > 0 && (
                            <p className="font-body text-[10px] text-muted-foreground/70">
                              {budget.unassigned} шт. без сегмента (не учтены)
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="font-body text-[12px] text-muted-foreground">
                        Назначьте ценовой сегмент предметам
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* ─── AI estimate ─────────────────────────────────────────── */}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleAiEstimate}
                  disabled={estimating}
                >
                  {estimating
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Wand2 className="h-3.5 w-3.5" />}
                  Пересчитать смету
                </Button>
                {aiEstimate && (
                  <div className="mt-3 border border-primary/20 bg-primary/5 p-3 relative">
                    <button
                      onClick={() => setAiEstimate(null)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <p className="font-body text-[12px] text-foreground leading-relaxed whitespace-pre-line pr-4">
                      {aiEstimate}
                    </p>
                  </div>
                )}
              </div>

              {/* ─── Filter bar ─────────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-body text-[11px] uppercase tracking-[0.1em] text-foreground">
                    Список мебели
                  </p>
                  <button
                    onClick={() => setShowCatalog(v => !v)}
                    className={cn(
                      "flex items-center gap-1 rounded-none border px-2 py-0.5 font-body text-[10px] uppercase tracking-[0.07em] transition-colors",
                      showCatalog
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                    )}
                  >
                    <Plus className="h-3 w-3" />
                    Добавить
                  </button>
                </div>

                {/* Catalog panel */}
                {showCatalog && (
                  <div className="mb-3 border border-primary/30 bg-primary/5 p-3">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {Object.entries(FURNITURE_CATALOG).map(([key, g]) => (
                        <button
                          key={key}
                          onClick={() => setCatalogGroup(key)}
                          className={cn(
                            "rounded-none border px-2 py-0.5 font-body text-[10px] uppercase tracking-[0.06em] transition-colors",
                            catalogGroup === key
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                          )}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {FURNITURE_CATALOG[catalogGroup]?.items.map((preset, i) => (
                        <button
                          key={i}
                          onClick={() => handleAddItem(preset)}
                          className="flex w-full items-center justify-between rounded-none border border-border bg-background px-2.5 py-1.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
                        >
                          <span className="font-body text-[12px] text-foreground">{preset.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {preset.width.toFixed(1)}×{preset.depth.toFixed(1)} м
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}


                {/* Type group filter */}
                <div className="flex flex-wrap gap-1 mb-2">
                  <button
                    onClick={() => setTypeGroupFilter("")}
                    className={cn(
                      "rounded-none border px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.07em] transition-colors",
                      typeGroupFilter === ""
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                    )}
                  >
                    Все
                  </button>
                  {Object.entries(TYPE_GROUPS).map(([key, g]) => {
                    const hasItems = plan.furniture.some(f => (g.types as string[]).includes(f.type));
                    if (!hasItems) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => setTypeGroupFilter(typeGroupFilter === key ? "" : key)}
                        className={cn(
                          "rounded-none border px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.07em] transition-colors",
                          typeGroupFilter === key
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                        )}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>

                {/* Price segment filter */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {[
                    { key: "", label: "Все сегменты" },
                    { key: "economy", label: "Эконом" },
                    { key: "mid", label: "Средний" },
                    { key: "premium", label: "Премиум" },
                  ].map(s => {
                    const hasItems = s.key === "" || plan.furniture.some(f => f.price_segment === s.key);
                    if (s.key !== "" && !hasItems) return null;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setSegmentFilter(segmentFilter === s.key ? "" : s.key)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 font-body text-[10px] transition-colors",
                          segmentFilter === s.key && s.key !== ""
                            ? "border-primary bg-primary/10 text-primary"
                            : s.key === "" && segmentFilter === ""
                            ? "border-muted bg-muted text-muted-foreground"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {filteredFurniture.length === 0 ? (
                    <p className="font-body text-[12px] text-muted-foreground py-3 text-center">
                      Нет мебели по выбранным фильтрам
                    </p>
                  ) : (
                    filteredFurniture.map(item => renderItemEditor(item))
                  )}
                </div>

                {/* Item count */}
                {plan.furniture.length > 0 && (
                  <p className="mt-2 font-body text-[11px] text-muted-foreground">
                    Показано {filteredFurniture.length} из {plan.furniture.length}
                  </p>
                )}
              </div>

              {/* Procurement button */}
              <div className="border-t border-border pt-4">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShowProcurement(true)}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Передать в закупку
                </Button>
                <p className="mt-1.5 font-body text-[11px] text-muted-foreground text-center">
                  Ведомость со всеми атрибутами · экспорт CSV
                </p>
              </div>

              {/* Legend */}
              <div>
                <p className="font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-1">
                  Сетка: 1 м · Привязка: 5 см
                </p>
                <p className="font-body text-[11px] text-muted-foreground">
                  Цветной кружок → RAL-пикер · <RotateCw className="inline h-3 w-3" /> → поворот 90°
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!plan && !generating && selectedRoom && roomDims && (
          <div className="flex flex-col items-center justify-center border border-dashed border-[#D0C8C0] py-20 text-center">
            <p className="font-display text-[20px] text-[#1A1A1A] mb-3">
              Расстановка ещё не сгенерирована
            </p>
            <p className="font-body text-[14px] text-muted-foreground max-w-[380px]">
              AI расставит мебель с учётом размеров, сценариев брифа, норм проходов и назначит RAL-цвета материалам.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-12 flex justify-between border-t border-border pt-8">
          <Button variant="outline" onClick={() => navigate(`/project/${projectId}/board`)}>
            ← Концепт-борд
          </Button>
          <Button onClick={() => navigate(`/project/${projectId}/export`)}>
            Экспорт PDF →
          </Button>
        </div>
      </div>

      {/* Procurement modal */}
      {showProcurement && plan && (
        <ProcurementModal
          plans={[plan]}
          onClose={() => setShowProcurement(false)}
        />
      )}
    </div>
  );
};

export default FurniturePlanPage;
