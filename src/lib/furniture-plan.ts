export type FurnitureType =
  | 'sofa' | 'bed' | 'table' | 'dining_table' | 'coffee_table'
  | 'chair' | 'armchair' | 'wardrobe' | 'tv_unit' | 'desk'
  | 'bathtub' | 'toilet' | 'sink' | 'fridge' | 'stove' | 'other';

export type PriceSegment = 'economy' | 'mid' | 'premium';

export interface FurnitureItem {
  id: string;
  name: string;
  type: FurnitureType;
  width: number;    // meters, original width
  depth: number;    // meters, original depth
  x: number;        // left edge from left wall, meters
  y: number;        // top edge from top wall, meters
  rotation: number; // 0 or 90
  // Color & material attributes (6.7)
  ral?: string;          // e.g. "RAL 9010"
  hex?: string;          // e.g. "#F5F0E8" — overrides default swatch fill
  material?: string;     // e.g. "Дуб беленый"
  finish?: string;       // матовый / глянцевый / сатин / натуральный
  price_segment?: PriceSegment;
  quantity?: number;
}

export interface FurniturePlan {
  room_name: string;
  room_width: number;
  room_length: number;
  furniture: FurnitureItem[];
  notes: string;
}

export interface PlanWarning {
  id: string;
  severity: 'critical' | 'important';
  title: string;
  description: string;
  itemIds?: string[];
}

// Effective rendered dimensions (after applying rotation)
export function effectiveDims(item: FurnitureItem): { w: number; d: number } {
  if (item.rotation === 90 || item.rotation === 270) {
    return { w: item.depth, d: item.width };
  }
  return { w: item.width, d: item.depth };
}

type AABB = { x1: number; y1: number; x2: number; y2: number };

function aabb(item: FurnitureItem): AABB {
  const { w, d } = effectiveDims(item);
  return { x1: item.x, y1: item.y, x2: item.x + w, y2: item.y + d };
}

function intersects(a: AABB, b: AABB): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

// Gap between two AABBs along X (negative = overlapping in X)
function xGap(a: AABB, b: AABB): number {
  if (a.x2 <= b.x1) return b.x1 - a.x2;
  if (b.x2 <= a.x1) return a.x1 - b.x2;
  return -1;
}

// Gap between two AABBs along Y (negative = overlapping in Y)
function yGap(a: AABB, b: AABB): number {
  if (a.y2 <= b.y1) return b.y1 - a.y2;
  if (b.y2 <= a.y1) return a.y1 - b.y2;
  return -1;
}

function overlapInX(a: AABB, b: AABB): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2;
}

function overlapInY(a: AABB, b: AABB): boolean {
  return a.y1 < b.y2 && b.y1 < a.y2;
}

const MIN_PASSAGE = 0.60;

export function validatePlan(plan: FurniturePlan): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const items = plan.furniture;

  for (const item of items) {
    const { x1, y1, x2, y2 } = aabb(item);
    if (x1 < -0.01 || y1 < -0.01 || x2 > plan.room_width + 0.01 || y2 > plan.room_length + 0.01) {
      warnings.push({
        id: `boundary_${item.id}`,
        severity: 'critical',
        title: `«${item.name}» выходит за границы`,
        description: `Предмет выходит за пределы комнаты ${plan.room_width}×${plan.room_length} м.`,
        itemIds: [item.id],
      });
    }
  }

  const boxes = items.map(aabb);

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = boxes[i];
      const b = boxes[j];

      if (intersects(a, b)) {
        warnings.push({
          id: `overlap_${items[i].id}_${items[j].id}`,
          severity: 'critical',
          title: `«${items[i].name}» и «${items[j].name}» пересекаются`,
          description: 'Два предмета занимают одно место. Переместите один из них.',
          itemIds: [items[i].id, items[j].id],
        });
        continue;
      }

      // Items facing each other vertically (overlap in X → passage is in Y)
      if (overlapInX(a, b)) {
        const gap = yGap(a, b);
        if (gap >= 0 && gap < MIN_PASSAGE) {
          warnings.push({
            id: `passage_y_${items[i].id}_${items[j].id}`,
            severity: gap < 0.3 ? 'critical' : 'important',
            title: `Узкий проход ${Math.round(gap * 100)} см: «${items[i].name}» / «${items[j].name}»`,
            description: `Минимальный проход — 60 см. Сейчас ${Math.round(gap * 100)} см.`,
            itemIds: [items[i].id, items[j].id],
          });
        }
      }

      // Items facing each other horizontally (overlap in Y → passage is in X)
      if (overlapInY(a, b)) {
        const gap = xGap(a, b);
        if (gap >= 0 && gap < MIN_PASSAGE) {
          warnings.push({
            id: `passage_x_${items[i].id}_${items[j].id}`,
            severity: gap < 0.3 ? 'critical' : 'important',
            title: `Узкий проход ${Math.round(gap * 100)} см: «${items[i].name}» / «${items[j].name}»`,
            description: `Минимальный проход — 60 см. Сейчас ${Math.round(gap * 100)} см.`,
            itemIds: [items[i].id, items[j].id],
          });
        }
      }
    }
  }

  return warnings;
}

export const FURNITURE_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  sofa:          { fill: '#C8B4A0', stroke: '#9A8070', label: 'Диван' },
  bed:           { fill: '#A8BED4', stroke: '#7090B0', label: 'Кровать' },
  table:         { fill: '#D4C4A0', stroke: '#A09070', label: 'Стол' },
  dining_table:  { fill: '#D4C4A0', stroke: '#A09070', label: 'Обед. стол' },
  coffee_table:  { fill: '#DDD4C0', stroke: '#B0A080', label: 'Журн. стол' },
  chair:         { fill: '#D0B8A8', stroke: '#A08878', label: 'Стул' },
  armchair:      { fill: '#C8B0A0', stroke: '#988070', label: 'Кресло' },
  wardrobe:      { fill: '#B8B0A4', stroke: '#888078', label: 'Шкаф' },
  tv_unit:       { fill: '#989088', stroke: '#686058', label: 'ТВ-тумба' },
  desk:          { fill: '#C8BA98', stroke: '#988A68', label: 'Раб. стол' },
  bathtub:       { fill: '#A8C4D8', stroke: '#6898B8', label: 'Ванна' },
  toilet:        { fill: '#E0DCD8', stroke: '#A8A4A0', label: 'Унитаз' },
  sink:          { fill: '#D8DDE0', stroke: '#A0A8B0', label: 'Раковина' },
  fridge:        { fill: '#C4CDD8', stroke: '#8898A8', label: 'Холодильник' },
  stove:         { fill: '#C49090', stroke: '#986060', label: 'Плита' },
  other:         { fill: '#C0BCBA', stroke: '#888480', label: 'Мебель' },
};

// Parse "4×3" / "4x3" / "4 на 3" into { width, length }
export function parseRoomDimensions(text: string): { width: number; length: number } | null {
  if (!text?.trim()) return null;
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*[×xхна]+\s*(\d+(?:[.,]\d+)?)/i);
  if (m) {
    const a = parseFloat(m[1].replace(',', '.'));
    const b = parseFloat(m[2].replace(',', '.'));
    return { width: Math.min(a, b), length: Math.max(a, b) };
  }
  const area = text.match(/(\d+(?:[.,]\d+)?)\s*(?:кв\.?\s*м|м²)/i);
  if (area) {
    const s = Math.sqrt(parseFloat(area[1].replace(',', '.')));
    return { width: s, length: s };
  }
  return null;
}

// ─── Flow Overlay ────────────────────────────────────────────────────────────

export interface FlowZone {
  type: string;
  center: [number, number]; // meters
  label: string;
}

export interface FlowData {
  entry: [number, number];
  zones: FlowZone[];
  routes: Array<{ id: string; from: [number, number]; to: [number, number] }>;
}

const ZONE_MAP: Partial<Record<FurnitureType, { zone: string; label: string }>> = {
  sofa:         { zone: 'living',   label: 'Гостиная' },
  armchair:     { zone: 'living',   label: 'Гостиная' },
  coffee_table: { zone: 'living',   label: 'Гостиная' },
  tv_unit:      { zone: 'living',   label: 'Гостиная' },
  bed:          { zone: 'sleeping', label: 'Спальня' },
  wardrobe:     { zone: 'sleeping', label: 'Спальня' },
  desk:         { zone: 'work',     label: 'Рабочая зона' },
  fridge:       { zone: 'kitchen',  label: 'Кухня' },
  stove:        { zone: 'kitchen',  label: 'Кухня' },
  bathtub:      { zone: 'bath',     label: 'Санузел' },
  toilet:       { zone: 'bath',     label: 'Санузел' },
  sink:         { zone: 'bath',     label: 'Санузел' },
  dining_table: { zone: 'dining',   label: 'Столовая' },
  chair:        { zone: 'dining',   label: 'Столовая' },
};

function itemCenter(item: FurnitureItem): [number, number] {
  const { w, d } = effectiveDims(item);
  return [item.x + w / 2, item.y + d / 2];
}

export function generateFlowData(plan: FurniturePlan): FlowData {
  // Entry point: bottom-center wall (south side — convention for floor plans)
  const entry: [number, number] = [plan.room_width / 2, plan.room_length];

  // Group furniture into named zones
  const zoneMap = new Map<string, { items: FurnitureItem[]; label: string }>();
  for (const item of plan.furniture) {
    const zd = ZONE_MAP[item.type];
    if (!zd) continue;
    if (!zoneMap.has(zd.zone)) zoneMap.set(zd.zone, { items: [], label: zd.label });
    zoneMap.get(zd.zone)!.items.push(item);
  }

  const zones: FlowZone[] = [];
  for (const [type, { items, label }] of zoneMap) {
    const centers = items.map(itemCenter);
    const cx = centers.reduce((s, p) => s + p[0], 0) / centers.length;
    const cy = centers.reduce((s, p) => s + p[1], 0) / centers.length;
    zones.push({ type, center: [cx, cy], label });
  }

  if (zones.length === 0) return { entry, zones, routes: [] };

  // Sort zones by distance from entry (nearest first)
  zones.sort((a, b) =>
    Math.hypot(a.center[0] - entry[0], a.center[1] - entry[1]) -
    Math.hypot(b.center[0] - entry[0], b.center[1] - entry[1])
  );

  const routes: FlowData['routes'] = [];

  // entry → first (nearest) zone
  routes.push({ id: 'entry', from: entry, to: zones[0].center });

  // Connect remaining zones via nearest-neighbour traversal
  const visited = new Set([0]);
  let cur = 0;
  while (visited.size < zones.length) {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < zones.length; i++) {
      if (visited.has(i)) continue;
      const dist = Math.hypot(
        zones[i].center[0] - zones[cur].center[0],
        zones[i].center[1] - zones[cur].center[1],
      );
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    if (best === -1) break;
    routes.push({ id: `z${cur}_${best}`, from: zones[cur].center, to: zones[best].center });
    visited.add(best);
    cur = best;
  }

  return { entry, zones, routes };
}

// ─── SVG string generator (for export, no DOM required) ───────────────────────

export function generatePlanSVGString(plan: FurniturePlan, showFlow = false): string {
  const PADDING = 32;
  const TITLE_H = 28;
  const MAX_W = 680;
  const MAX_H = 500;

  const scale = Math.min(
    (MAX_W - PADDING * 2) / plan.room_width,
    (MAX_H - PADDING * 2) / plan.room_length,
  );

  const planW = plan.room_width * scale;
  const planH = plan.room_length * scale;
  const totalW = planW + PADDING * 2 + 20;
  const totalH = planH + PADDING * 2 + TITLE_H;

  // Grid (1 m)
  const step = scale;
  const gridLines: string[] = [];
  for (let x = 0; x <= planW + 0.5; x += step)
    gridLines.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${planH.toFixed(1)}" stroke="#E8E4E0" stroke-width="0.5"/>`);
  for (let y = 0; y <= planH + 0.5; y += step)
    gridLines.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${planW.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#E8E4E0" stroke-width="0.5"/>`);

  // Furniture
  const furnitureEls = plan.furniture.map(item => {
    const { w, d } = effectiveDims(item);
    const colors = FURNITURE_COLORS[item.type] || FURNITURE_COLORS.other;
    const sx = (item.x * scale).toFixed(1);
    const sy = (item.y * scale).toFixed(1);
    const sw = (w * scale).toFixed(1);
    const sd = (d * scale).toFixed(1);
    const cx = (item.x * scale + w * scale / 2).toFixed(1);
    const cyMain = (item.y * scale + d * scale / 2 - (w * scale > 50 && d * scale > 28 ? 5 : 0)).toFixed(1);
    const cyDim = (item.y * scale + d * scale / 2 + 9).toFixed(1);
    const fs = Math.max(8, Math.min(11, w * scale / Math.max(item.name.length, 4) * 1.6)).toFixed(1);
    const label = item.name.length > 16 ? item.name.slice(0, 14) + '…' : item.name;
    const showLabel = w * scale > 32 && d * scale > 18;
    const showDim = w * scale > 50 && d * scale > 28;

    return [
      `<rect x="${sx}" y="${sy}" width="${sw}" height="${sd}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1" rx="2"/>`,
      showLabel ? `<text x="${cx}" y="${cyMain}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" fill="#3A3530" font-family="sans-serif">${label}</text>` : '',
      showDim ? `<text x="${cx}" y="${cyDim}" text-anchor="middle" dominant-baseline="middle" font-size="8" fill="#7A7068" font-family="monospace">${w.toFixed(1)}×${d.toFixed(1)}м</text>` : '',
    ].join('');
  }).join('\n');

  // Flow overlay
  let flowDefs = '';
  let flowEls = '';
  if (showFlow) {
    const flow = generateFlowData(plan);
    if (flow.routes.length > 0) {
      const pt = ([x, y]: [number, number]) => [x * scale, y * scale] as [number, number];
      const curve = (from: [number, number], to: [number, number]) => {
        const [x1, y1] = pt(from); const [x2, y2] = pt(to);
        const dx = x2 - x1; const dy = y2 - y1; const len = Math.hypot(dx, dy);
        if (len < 2) return `M${x1},${y1} L${x2},${y2}`;
        const px = -dy / len; const py = dx / len; const off = Math.min(len * 0.14, 22);
        return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${(x1 + x2) / 2 + px * off},${(y1 + y2) / 2 + py * off} ${x2.toFixed(1)},${y2.toFixed(1)}`;
      };
      const [ex, ey] = pt(flow.entry);
      flowDefs = `<defs><marker id="fa" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><polygon points="0,0 7,3.5 0,7" fill="#4A7FA5" opacity="0.9"/></marker></defs>`;
      const entry = `<circle cx="${ex}" cy="${ey}" r="8" fill="#4A7FA5" opacity="0.18"/><circle cx="${ex}" cy="${ey}" r="4" fill="#4A7FA5" opacity="0.7"/><text x="${ex}" y="${ey + 14}" text-anchor="middle" font-size="8" fill="#4A7FA5" font-family="sans-serif">вход</text>`;
      const routes = flow.routes.map(r => `<path d="${curve(r.from, r.to)}" fill="none" stroke="#4A7FA5" stroke-width="1.5" stroke-dasharray="7,4" stroke-linecap="round" marker-end="url(#fa)" opacity="0.65"/>`).join('');
      const zones = flow.zones.map(z => {
        const [zx, zy] = pt(z.center);
        return `<circle cx="${zx}" cy="${zy}" r="5" fill="#4A7FA5" opacity="0.22"/><circle cx="${zx}" cy="${zy}" r="2.5" fill="#4A7FA5" opacity="0.55"/><text x="${zx}" y="${zy - 9}" text-anchor="middle" font-size="8" fill="#4A7FA5" font-family="sans-serif">${z.label}</text>`;
      }).join('');
      flowEls = entry + routes + zones;
    }
  }

  // Dimension labels
  const dimW = (planW / 2).toFixed(1);
  const dimL = (planH / 2).toFixed(1);
  const dimLabels = `<text x="${dimW}" y="-10" text-anchor="middle" font-size="10" fill="#8A8078" font-family="sans-serif">${plan.room_width.toFixed(1)} м</text><text x="-10" y="${dimL}" text-anchor="middle" font-size="10" fill="#8A8078" font-family="sans-serif" transform="rotate(-90,-10,${dimL})">${plan.room_length.toFixed(1)} м</text>`;

  const north = `<text x="${(planW - 6).toFixed(1)}" y="${(planH - 6).toFixed(1)}" text-anchor="end" font-size="9" fill="#C0B8B0" font-family="sans-serif">↑ С</text>`;

  // Title block at top
  const titleX = (totalW / 2).toFixed(1);
  const scaleLabel = (100 / scale).toFixed(1);
  const title = `<text x="${titleX}" y="14" text-anchor="middle" font-size="12" font-weight="500" fill="#1A1A1A" font-family="sans-serif">${plan.room_name}</text><text x="${titleX}" y="24" text-anchor="middle" font-size="9" fill="#888" font-family="sans-serif">1 см = ${scaleLabel} см · сетка 1 м · ${plan.room_width.toFixed(1)}×${plan.room_length.toFixed(1)} м</text>`;

  const offsetX = (PADDING + 20).toFixed(1);
  const offsetY = (PADDING + TITLE_H).toFixed(1);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW.toFixed(0)}" height="${totalH.toFixed(0)}" viewBox="0 0 ${totalW.toFixed(0)} ${totalH.toFixed(0)}">
  ${flowDefs}
  ${title}
  <g transform="translate(${offsetX},${offsetY})">
    ${dimLabels}
    <rect x="0" y="0" width="${planW.toFixed(1)}" height="${planH.toFixed(1)}" fill="#F0EBE4" stroke="#A09888" stroke-width="2"/>
    <g>${gridLines.join('')}</g>
    ${flowEls}
    <g>${furnitureEls}</g>
    ${north}
  </g>
</svg>`;
}

// ─── Color / material metadata ───────────────────────────────────────────────

export const PRICE_SEGMENT_LABELS: Record<PriceSegment, string> = {
  economy: 'Эконом',
  mid: 'Средний',
  premium: 'Премиум',
};

export const FINISH_OPTIONS = [
  { value: 'matte',     label: 'Матовый' },
  { value: 'glossy',    label: 'Глянцевый' },
  { value: 'satin',     label: 'Сатин' },
  { value: 'natural',   label: 'Натуральный' },
  { value: 'textured',  label: 'Текстурированный' },
];

// Grouping of furniture types for the filter bar
export const TYPE_GROUPS: Record<string, { types: FurnitureType[]; label: string }> = {
  living:  { types: ['sofa', 'armchair', 'coffee_table', 'tv_unit'],          label: 'Гостиная' },
  sleeping:{ types: ['bed', 'wardrobe'],                                        label: 'Спальня' },
  work:    { types: ['desk', 'chair'],                                          label: 'Кабинет' },
  dining:  { types: ['dining_table', 'table'],                                  label: 'Столовая' },
  kitchen: { types: ['fridge', 'stove'],                                        label: 'Кухня' },
  bath:    { types: ['bathtub', 'toilet', 'sink'],                              label: 'Санузел' },
};

// Return group key for a given furniture type ('' if none)
export function typeGroupOf(type: FurnitureType): string {
  for (const [key, g] of Object.entries(TYPE_GROUPS)) {
    if ((g.types as string[]).includes(type)) return key;
  }
  return '';
}

// Filter furniture list by type group and/or price segment
export function filterFurniture(
  items: FurnitureItem[],
  typeGroup: string,
  segment: string,
): FurnitureItem[] {
  return items.filter(item => {
    if (typeGroup && typeGroupOf(item.type) !== typeGroup) return false;
    if (segment && item.price_segment !== segment) return false;
    return true;
  });
}

// Generate a procurement CSV from a plan
export function generateProcurementCSV(plan: FurniturePlan): string {
  const sep = ';';
  const headers = ['Предмет', 'Тип', 'Ш (м)', 'Г (м)', 'Материал', 'RAL/НЦС', 'Покрытие', 'Кол-во', 'Сегмент'];
  const rows = plan.furniture.map(item => {
    const { w, d } = effectiveDims(item);
    const typeLabel = FURNITURE_COLORS[item.type]?.label || item.type;
    return [
      item.name,
      typeLabel,
      w.toFixed(2),
      d.toFixed(2),
      item.material || '—',
      item.ral || '—',
      item.finish || '—',
      String(item.quantity ?? 1),
      item.price_segment ? PRICE_SEGMENT_LABELS[item.price_segment] : '—',
    ].join(sep);
  });
  return [headers.join(sep), ...rows].join('\n');
}

// ─── Furniture catalog (presets for add-item panel) ──────────────────────────

export interface FurniturePreset {
  type: FurnitureType;
  name: string;
  width: number;
  depth: number;
}

export const FURNITURE_CATALOG: Record<string, { label: string; items: FurniturePreset[] }> = {
  living: {
    label: 'Гостиная',
    items: [
      { type: 'sofa',         name: 'Диван 3-местный',   width: 2.2, depth: 0.9 },
      { type: 'sofa',         name: 'Диван 2-местный',   width: 1.8, depth: 0.85 },
      { type: 'armchair',     name: 'Кресло',             width: 0.85, depth: 0.85 },
      { type: 'coffee_table', name: 'Журнальный стол',    width: 1.1, depth: 0.55 },
      { type: 'tv_unit',      name: 'ТВ-тумба',           width: 1.8, depth: 0.4 },
    ],
  },
  sleeping: {
    label: 'Спальня',
    items: [
      { type: 'bed',      name: 'Кровать 160×200',   width: 1.6, depth: 2.0 },
      { type: 'bed',      name: 'Кровать 180×200',   width: 1.8, depth: 2.0 },
      { type: 'bed',      name: 'Односпальная 90×200', width: 0.9, depth: 2.0 },
      { type: 'wardrobe', name: 'Шкаф-купе 1.8м',    width: 1.8, depth: 0.6 },
      { type: 'wardrobe', name: 'Шкаф распашной',    width: 0.9, depth: 0.55 },
      { type: 'table',    name: 'Тумбочка',           width: 0.5, depth: 0.45 },
    ],
  },
  work: {
    label: 'Кабинет',
    items: [
      { type: 'desk',  name: 'Рабочий стол 140',  width: 1.4, depth: 0.7 },
      { type: 'desk',  name: 'Угловой стол',       width: 1.6, depth: 0.8 },
      { type: 'chair', name: 'Офисное кресло',     width: 0.6, depth: 0.6 },
    ],
  },
  dining: {
    label: 'Столовая',
    items: [
      { type: 'dining_table', name: 'Стол на 4 чел', width: 1.4, depth: 0.8 },
      { type: 'dining_table', name: 'Стол на 6 чел', width: 2.0, depth: 0.9 },
      { type: 'chair',        name: 'Обеденный стул', width: 0.5, depth: 0.5 },
    ],
  },
  kitchen: {
    label: 'Кухня',
    items: [
      { type: 'fridge', name: 'Холодильник',  width: 0.6, depth: 0.65 },
      { type: 'stove',  name: 'Варочная поверхность', width: 0.6, depth: 0.6 },
    ],
  },
  bath: {
    label: 'Санузел',
    items: [
      { type: 'bathtub', name: 'Ванна 170×75',     width: 1.7, depth: 0.75 },
      { type: 'bathtub', name: 'Ванна угловая',     width: 1.5, depth: 1.5 },
      { type: 'toilet',  name: 'Унитаз',             width: 0.7, depth: 0.35 },
      { type: 'sink',    name: 'Раковина',            width: 0.6, depth: 0.45 },
      { type: 'sink',    name: 'Тумба с раковиной',  width: 0.8, depth: 0.5 },
    ],
  },
};

let _itemCounter = Date.now();

export function createFurnitureItem(preset: FurniturePreset, roomWidth: number, roomLength: number): FurnitureItem {
  _itemCounter += 1;
  // Place new item near the center of the room
  const cx = Math.max(0, Math.min(roomWidth - preset.width, (roomWidth - preset.width) / 2));
  const cy = Math.max(0, Math.min(roomLength - preset.depth, (roomLength - preset.depth) / 2));
  return {
    id: `item_${_itemCounter}`,
    name: preset.name,
    type: preset.type,
    width: preset.width,
    depth: preset.depth,
    x: snapTo(cx),
    y: snapTo(cy),
    rotation: 0,
  };
}

// ─── Budget estimation ────────────────────────────────────────────────────────

const SEGMENT_RANGE_RUB: Record<PriceSegment, [number, number]> = {
  economy: [15_000,  40_000],
  mid:     [45_000, 120_000],
  premium: [130_000, 400_000],
};

export interface BudgetEstimate {
  minTotal: number;
  maxTotal: number;
  bySegment: Record<PriceSegment, { count: number; min: number; max: number }>;
  unassigned: number;
}

export function estimateBudget(items: FurnitureItem[]): BudgetEstimate {
  const bySegment: BudgetEstimate['bySegment'] = {
    economy: { count: 0, min: 0, max: 0 },
    mid:     { count: 0, min: 0, max: 0 },
    premium: { count: 0, min: 0, max: 0 },
  };
  let unassigned = 0;

  for (const item of items) {
    const qty = item.quantity ?? 1;
    if (!item.price_segment) { unassigned += qty; continue; }
    const [lo, hi] = SEGMENT_RANGE_RUB[item.price_segment];
    bySegment[item.price_segment].count += qty;
    bySegment[item.price_segment].min += lo * qty;
    bySegment[item.price_segment].max += hi * qty;
  }

  const minTotal = Object.values(bySegment).reduce((s, v) => s + v.min, 0);
  const maxTotal = Object.values(bySegment).reduce((s, v) => s + v.max, 0);
  return { minTotal, maxTotal, bySegment, unassigned };
}

export function formatRub(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} тыс. ₽`;
  return `${n} ₽`;
}

// ─── Local storage persistence ────────────────────────────────────────────────
const LS_KEY = (projectId: string, roomName: string) =>
  `furniture_plan_${projectId}_${roomName.replace(/\s+/g, '_')}`;

export function savePlanToStorage(projectId: string, plan: FurniturePlan) {
  try {
    localStorage.setItem(LS_KEY(projectId, plan.room_name), JSON.stringify(plan));
  } catch {}
}

export function loadPlanFromStorage(projectId: string, roomName: string): FurniturePlan | null {
  try {
    const raw = localStorage.getItem(LS_KEY(projectId, roomName));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
