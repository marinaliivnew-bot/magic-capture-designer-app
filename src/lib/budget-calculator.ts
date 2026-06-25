export type BudgetSegment = 'economy' | 'middle' | 'premium';
export type BudgetRegion = 'regions' | 'moscow' | 'custom';

export const BUDGET_METHODOLOGY_VERSION = 'MC-BUDGET-2026-06-25';

export const SEGMENT_LABELS: Record<BudgetSegment, string> = {
  economy: 'базовый',
  middle: 'средний',
  premium: 'высокий',
};

// ─── price tables ─────────────────────────────────────────────────────────────

export interface BudgetRateConfig {
  methodologyVersion: string;
  floorRates: Record<BudgetSegment, number>;
  wallRates: Record<BudgetSegment, number>;
  ceilingRates: Record<BudgetSegment, number>;
  furnitureRates: Record<string, Record<BudgetSegment, number>>;
  roomHeightM: number;
  regionCoefficients: Record<BudgetRegion, number>;
}

export interface BudgetCalculationOptions {
  segment?: BudgetSegment;
  region?: BudgetRegion;
  manualRateMultiplier?: number;
  config?: BudgetRateConfig;
}

export const DEFAULT_BUDGET_RATE_CONFIG: BudgetRateConfig = {
  methodologyVersion: BUDGET_METHODOLOGY_VERSION,
  floorRates: {
  economy: 1_200,
  middle: 3_000,
  premium: 7_000,
  },
  wallRates: {
  economy: 800,
  middle: 2_000,
  premium: 4_500,
  },
  ceilingRates: {
  economy: 500,
  middle: 1_200,
  premium: 3_000,
  },
  furnitureRates: {
  kitchen:  { economy: 150_000, middle: 400_000, premium: 900_000 },
  living:   { economy: 100_000, middle: 300_000, premium: 700_000 },
  bedroom:  { economy:  80_000, middle: 200_000, premium: 500_000 },
  bathroom: { economy:  80_000, middle: 200_000, premium: 450_000 },
  office:   { economy:  50_000, middle: 120_000, premium: 280_000 },
  other:    { economy:  30_000, middle:  80_000, premium: 180_000 },
  },
  roomHeightM: 2.8,
  regionCoefficients: {
    regions: 1,
    moscow: 1.18,
    custom: 1,
  },
};

// ─── parsers ──────────────────────────────────────────────────────────────────

function parseAreaFromDimensions(text: string): number | null {
  if (!text?.trim()) return null;

  // "3×4 м", "3.5x4.2м", "3 на 4"
  const crossMatch = text.match(/(\d+(?:[.,]\d+)?)\s*[×xхна]+\s*(\d+(?:[.,]\d+)?)/i);
  if (crossMatch) {
    const w = parseFloat(crossMatch[1].replace(',', '.'));
    const l = parseFloat(crossMatch[2].replace(',', '.'));
    return w * l;
  }

  // "14 кв.м", "14м²"
  const areaMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:кв\.?\s*м|м²|квадрат)/i);
  if (areaMatch) return parseFloat(areaMatch[1].replace(',', '.'));

  // bare number ≥ 4: treat as m²
  const singleMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:м|m)?$/i);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1].replace(',', '.'));
    if (val >= 4) return val;
  }

  return null;
}

export function parseBudget(text: string): number | null {
  if (!text?.trim()) return null;
  const s = text.toLowerCase();
  const mln = s.match(/(\d+[.,]?\d*)\s*млн/);
  if (mln) return parseFloat(mln[1].replace(',', '.')) * 1_000_000;
  const tys = s.match(/(\d+[.,]?\d*)\s*тыс/);
  if (tys) return parseFloat(tys[1].replace(',', '.')) * 1_000;
  // space-separated number ≥ 5 digits: "1 500 000"
  const num = s.match(/(\d[\d\s]{4,})/);
  if (num) return parseInt(num[1].replace(/\s/g, ''), 10);
  return null;
}

function detectSegment(likes: string, constraints: string, raw: string): BudgetSegment {
  const all = `${likes} ${constraints} ${raw}`.toLowerCase();
  const premiumKw = [
    'мрамор', 'паркет из дуба', 'массив дуба', 'латунь', 'травертин',
    'оникс', 'итальянская мебель', 'бронза', 'натуральный камень', 'премиум',
  ];
  const economyKw = ['эконом', 'бюджетный', 'недорогой', 'дешев', 'ikea', 'икеа', 'леруа'];
  if (premiumKw.some(kw => all.includes(kw))) return 'premium';
  if (economyKw.some(kw => all.includes(kw))) return 'economy';
  return 'middle';
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface RoomBudgetEstimate {
  roomName: string;
  roomType: string;
  areaSqm: number;
  flooring: number;
  walls: number;
  ceiling: number;
  furniture: number;
  total: number;
}

export interface BudgetResult {
  segment: BudgetSegment;
  detectedSegment: BudgetSegment;
  region: BudgetRegion;
  regionCoefficient: number;
  manualRateMultiplier: number;
  methodologyVersion: string;
  methodologyDate: string;
  budgetLimit: number | null;
  totalEstimate: number;
  estimateRange: { min: number; max: number } | null;
  roomEstimates: RoomBudgetEstimate[];
  overBudget: boolean;
  overBudgetPercent: number | null;
  missingAreaRooms: string[];
  functionalOverrides: string[];
  hasRooms: boolean;
  assumptions: string[];
  includes: string[];
  excludes: string[];
  rateRows: Array<{ label: string; value: number | string }>;
  canShowInContract: boolean;
}

export interface BriefBudgetInput {
  budget?: string;
  style_likes?: string;
  constraints_practical?: string;
}

export interface RoomBudgetInput {
  name: string;
  room_type?: string;
  dimensions_text?: string;
}

export interface ProjectBudgetInput {
  id?: string;
  raw_input?: string;
}

function normalizeOptions(options?: BudgetSegment | BudgetCalculationOptions): BudgetCalculationOptions {
  if (!options) return {};
  return typeof options === 'string' ? { segment: options } : options;
}

function applyMultiplier(value: number, multiplier: number) {
  return Math.round(value * multiplier);
}

// ─── main export ──────────────────────────────────────────────────────────────

export function calculateBudget(
  brief: BriefBudgetInput,
  rooms: RoomBudgetInput[],
  project: ProjectBudgetInput,
  optionsOrSegment?: BudgetSegment | BudgetCalculationOptions,
): BudgetResult {
  const options = normalizeOptions(optionsOrSegment);
  const config = options.config || DEFAULT_BUDGET_RATE_CONFIG;
  const likes = brief.style_likes || '';
  const constraints = brief.constraints_practical || '';
  const raw = project.raw_input || '';

  const detectedSegment = detectSegment(likes, constraints, raw);
  const segment = options.segment ?? detectedSegment;
  const region = options.region ?? 'regions';
  const regionCoefficient = config.regionCoefficients[region] ?? 1;
  const manualRateMultiplier = options.manualRateMultiplier && options.manualRateMultiplier > 0
    ? options.manualRateMultiplier
    : 1;
  const totalMultiplier = regionCoefficient * manualRateMultiplier;
  const budgetLimit = parseBudget(brief.budget || '');

  const allText = `${constraints} ${likes}`.toLowerCase();
  const functionalOverrides: string[] = [];

  const needsDurableFloor = /износостойк|практичн|прочн покрыт|моющийся|стойкий к/.test(allText);
  if (needsDurableFloor) {
    functionalOverrides.push('Требование износостойкости: пол не ниже среднего сегмента');
  }
  if (/мрамор|травертин|натуральный камень/.test(allText)) {
    functionalOverrides.push('Натуральный камень: стены/пол в сегменте премиум');
  }

  const floorSegment: BudgetSegment =
    needsDurableFloor && segment === 'economy' ? 'middle' : segment;

  const validRooms = rooms.filter(r => r.name?.trim());
  const missingAreaRooms: string[] = [];
  const roomEstimates: RoomBudgetEstimate[] = [];

  for (const room of validRooms) {
    const area = parseAreaFromDimensions(room.dimensions_text || '');
    if (area === null || area < 1) {
      missingAreaRooms.push(room.name);
      continue;
    }

    // Rough perimeter for square-ish room
    const perimeter = 4 * Math.sqrt(area);
    const wallArea = perimeter * config.roomHeightM;

    const flooring = area * applyMultiplier(config.floorRates[floorSegment], totalMultiplier);
    const walls = wallArea * applyMultiplier(config.wallRates[segment], totalMultiplier);
    const ceiling = area * applyMultiplier(config.ceilingRates[segment], totalMultiplier);
    const roomTypeKey = room.room_type || 'other';
    const furniture = applyMultiplier(
      (config.furnitureRates[roomTypeKey] ?? config.furnitureRates.other)[segment],
      totalMultiplier
    );

    roomEstimates.push({
      roomName: room.name,
      roomType: roomTypeKey,
      areaSqm: area,
      flooring,
      walls,
      ceiling,
      furniture,
      total: flooring + walls + ceiling + furniture,
    });
  }

  const totalEstimate = roomEstimates.reduce((s, r) => s + r.total, 0);
  const estimateRange = totalEstimate > 0
    ? {
        min: Math.round(totalEstimate * 0.85),
        max: Math.round(totalEstimate * 1.15),
      }
    : null;
  const overBudget = budgetLimit !== null && totalEstimate > 0 && totalEstimate > budgetLimit;
  const overBudgetPercent = overBudget && budgetLimit
    ? Math.round(((totalEstimate - budgetLimit) / budgetLimit) * 100)
    : null;

  const assumptions = [
    `Методика ${config.methodologyVersion}: площадь помещения × ставки отделки + типовой ориентир комплектации по типу помещения.`,
    `Сегмент расчета: ${SEGMENT_LABELS[segment]}; определен по брифу${options.segment ? ' и скорректирован дизайнером' : ''}.`,
    `Региональный коэффициент: ${regionCoefficient}; ручная корректировка ставок: ${manualRateMultiplier}.`,
    `Высота стен для предварительного расчета: ${config.roomHeightM} м.`,
    'Диапазон показывает ориентир ±15% и не является сметой подрядчика.',
  ];

  const includes = [
    'Предварительная оценка чистовых материалов пола, стен и потолка.',
    'Ориентир по мебели/комплектации по типу помещения.',
    'Функциональные повышающие коэффициенты, если в брифе есть требования износостойкости или натурального камня.',
  ];

  const excludes = [
    'Работы подрядчика, доставка, монтаж, демонтаж и инженерные системы.',
    'Авторский надзор, проектирование, закупочные комиссии и непредвиденные работы.',
    'Помещения без площади или габаритов.',
  ];

  const rateRows = [
    { label: 'Пол, ₽/м²', value: applyMultiplier(config.floorRates[floorSegment], totalMultiplier) },
    { label: 'Стены, ₽/м²', value: applyMultiplier(config.wallRates[segment], totalMultiplier) },
    { label: 'Потолок, ₽/м²', value: applyMultiplier(config.ceilingRates[segment], totalMultiplier) },
    { label: 'Мебель/комплектация', value: 'по типу помещения' },
  ];

  return {
    segment,
    detectedSegment,
    region,
    regionCoefficient,
    manualRateMultiplier,
    methodologyVersion: config.methodologyVersion,
    methodologyDate: '2026-06-25',
    budgetLimit,
    totalEstimate,
    estimateRange,
    roomEstimates,
    overBudget,
    overBudgetPercent,
    missingAreaRooms,
    functionalOverrides,
    hasRooms: validRooms.length > 0,
    assumptions,
    includes,
    excludes,
    rateRows,
    canShowInContract: totalEstimate > 0,
  };
}
