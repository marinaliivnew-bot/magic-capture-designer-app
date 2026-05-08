import rules from './ergonomics-rules.json';

export type ErgonomicsSeverity = 'critical' | 'important' | 'optional';
export type ErgonomicsCategory = 'kitchen' | 'passages' | 'zoning' | 'storage';

export interface ErgonomicsRule {
  id: string;
  name: string;
  description: string;
  category: ErgonomicsCategory;
  severity: ErgonomicsSeverity;
  unlocks: string;
  suggestion: string;
  params: Record<string, number>;
}

export interface ErgonomicsWarning {
  id: string;
  ruleId: string;
  severity: ErgonomicsSeverity;
  category: ErgonomicsCategory;
  title: string;
  description: string;
  evidence: string;
  suggestion: string;
  unlocks: string;
  roomName?: string;
}

export interface RoomInput {
  name: string;
  room_type?: string;
  dimensions_text?: string;
}

export interface BriefInput {
  users_of_space?: string;
  scenarios?: string;
  style_likes?: string;
  constraints_practical?: string;
}

export interface ProjectInput {
  raw_input?: string;
  rooms_description?: string;
}

// ─── parsers ──────────────────────────────────────────────────────────────────

function parseDimensions(text: string): { width: number; length: number; area: number } | null {
  if (!text?.trim()) return null;

  // "3×4 м", "3.5x4.2м", "3 на 4"
  const crossMatch = text.match(/(\d+(?:[.,]\d+)?)\s*[×xхна]+\s*(\d+(?:[.,]\d+)?)/i);
  if (crossMatch) {
    const w = parseFloat(crossMatch[1].replace(',', '.'));
    const l = parseFloat(crossMatch[2].replace(',', '.'));
    return { width: Math.min(w, l), length: Math.max(w, l), area: w * l };
  }

  // "14 кв.м", "14м²", "14 кв м"
  const areaMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:кв\.?\s*м|м²|квадрат)/i);
  if (areaMatch) {
    const area = parseFloat(areaMatch[1].replace(',', '.'));
    // estimate square room
    const side = Math.sqrt(area);
    return { width: side, length: side, area };
  }

  // single number ≥ 3: treat as area
  const singleMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:м|m)?$/i);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1].replace(',', '.'));
    if (val >= 3) {
      const side = Math.sqrt(val);
      return { width: side, length: side, area: val };
    }
  }

  return null;
}

function parseResidentCount(text: string): { adults: number; children: number } {
  if (!text?.trim()) return { adults: 1, children: 0 };

  const lower = text.toLowerCase();
  let adults = 0;
  let children = 0;

  // explicit numbers: "2 взрослых", "двое взрослых"
  const wordNums: Record<string, number> = {
    'один': 1, 'одна': 1, 'двое': 2, 'два': 2, 'две': 2,
    'трое': 3, 'три': 3, 'четверо': 4, 'четыре': 4,
    'пятеро': 5, 'пять': 5,
  };

  const adultMatch = lower.match(/(\d+|один|одна|двое|два|две|трое|три|четверо|четыре|пятеро|пять)\s*(?:взрослых?|человек)/i);
  if (adultMatch) {
    const raw = adultMatch[1];
    adults = parseInt(raw) || wordNums[raw.toLowerCase()] || 1;
  }

  // children: "1 ребенок", "двое детей", "ребёнок", "дети"
  const childMatch = lower.match(/(\d+|один|одна|двое|два|две|трое|три|четверо|четыре)\s*(?:ребён?ок|детей|ребят)/i);
  if (childMatch) {
    const raw = childMatch[1];
    children = parseInt(raw) || wordNums[raw.toLowerCase()] || 1;
  } else if (/ребён?ок|малыш|ребёнок|дети/.test(lower)) {
    children = 1;
  }

  if (adults === 0) {
    // count "пара", "муж и жена", "семья" as 2
    if (/пара|муж и жена|супруги|вдвоём/.test(lower)) adults = 2;
    else if (/семья/.test(lower)) adults = 2;
    else adults = 1;
  }

  return { adults, children };
}

function containsAny(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

function roomIsType(room: RoomInput, types: string[]): boolean {
  const haystack = `${room.name} ${room.room_type || ''}`.toLowerCase();
  return types.some(t => haystack.includes(t));
}

// ─── rule checks ──────────────────────────────────────────────────────────────

const KITCHEN_NAMES = ['кухн', 'кухня', 'кухонн', 'столов', 'кухня-столовая', 'кухня-гостиная'];
const BEDROOM_NAMES = ['спальн', 'bedroom', 'master'];
const HALLWAY_NAMES = ['коридор', 'прихожая', 'холл', 'тамбур', 'прихожая'];

function checkKitchenWorkTriangle(
  rooms: RoomInput[],
  allText: string,
  ruleSet: ErgonomicsRule[],
): ErgonomicsWarning[] {
  const rule = ruleSet.find(r => r.id === 'kitchen_work_triangle')!;
  const warnings: ErgonomicsWarning[] = [];

  const kitchenRooms = rooms.filter(r => roomIsType(r, KITCHEN_NAMES));

  for (const room of kitchenRooms) {
    const dims = parseDimensions(room.dimensions_text || '');
    if (dims && dims.area < rule.params.minAreaSqm) {
      warnings.push({
        id: `ergonomics_kitchen_triangle_${room.name}`,
        ruleId: rule.id,
        severity: rule.severity as ErgonomicsSeverity,
        category: rule.category as ErgonomicsCategory,
        title: `${rule.name}: «${room.name}» ${dims.area.toFixed(1)} м²`,
        description: `Площадь ${dims.area.toFixed(1)} м² недостаточна для полноценного рабочего треугольника (норма: ≥ ${rule.params.minAreaSqm} м²).`,
        evidence: `${room.name}: ${room.dimensions_text}`,
        suggestion: rule.suggestion,
        unlocks: rule.unlocks,
        roomName: room.name,
      });
    }
  }

  // If kitchen mentioned in text but not in rooms list
  if (kitchenRooms.length === 0 && containsAny(allText, KITCHEN_NAMES)) {
    const smallKitchenKw = ['маленькая кухня', 'небольшая кухня', 'кухня 5', 'кухня 4', 'кухня 6'];
    if (containsAny(allText, smallKitchenKw)) {
      warnings.push({
        id: 'ergonomics_kitchen_triangle_text',
        ruleId: rule.id,
        severity: rule.severity as ErgonomicsSeverity,
        category: rule.category as ErgonomicsCategory,
        title: rule.name,
        description: 'В описании упоминается небольшая кухня. Уточните площадь — для рабочего треугольника требуется ≥ 6 м².',
        evidence: 'Данные из текстового описания проекта',
        suggestion: rule.suggestion,
        unlocks: rule.unlocks,
      });
    }
  }

  return warnings;
}

function checkKitchenSinkDishwasher(
  rooms: RoomInput[],
  allText: string,
  ruleSet: ErgonomicsRule[],
): ErgonomicsWarning[] {
  const rule = ruleSet.find(r => r.id === 'kitchen_sink_dishwasher')!;
  const warnings: ErgonomicsWarning[] = [];

  const hasDishwasher = containsAny(allText, ['посудомойка', 'посудомоечная', 'пмм']);
  if (!hasDishwasher) return warnings;

  const hasProximityNote = containsAny(allText, [
    'рядом с мойкой', 'смежно с мойкой', 'около мойки',
    'вплотную к мойке', 'у мойки',
  ]);

  if (!hasProximityNote) {
    warnings.push({
      id: 'ergonomics_sink_dishwasher',
      ruleId: rule.id,
      severity: rule.severity as ErgonomicsSeverity,
      category: rule.category as ErgonomicsCategory,
      title: rule.name,
      description: 'Посудомоечная машина упомянута, но положение относительно мойки не зафиксировано. Разнос более 60 см потребует дополнительной прокладки коммуникаций.',
      evidence: `Упоминание ПММ: «${hasDishwasher}»`,
      suggestion: rule.suggestion,
      unlocks: rule.unlocks,
    });
  }

  return warnings;
}

function checkKitchenStoveSafety(
  rooms: RoomInput[],
  allText: string,
  ruleSet: ErgonomicsRule[],
): ErgonomicsWarning[] {
  const rule = ruleSet.find(r => r.id === 'kitchen_stove_safety')!;
  const warnings: ErgonomicsWarning[] = [];

  const hasKitchen = rooms.some(r => roomIsType(r, KITCHEN_NAMES)) || !!containsAny(allText, KITCHEN_NAMES);
  if (!hasKitchen) return warnings;

  const hasStove = containsAny(allText, ['плита', 'варочная', 'духовой шкаф', 'духовка']);
  if (!hasStove) return warnings;

  const hasFridge = containsAny(allText, ['холодильник', 'холодос']);
  const dangerKw = ['плита рядом с холодильник', 'холодильник рядом с плитой', 'плита вплотную'];
  const hasDanger = containsAny(allText, dangerKw);

  if (hasDanger || (hasFridge && !containsAny(allText, ['панель между', 'разделитель', 'защитная панель']))) {
    warnings.push({
      id: 'ergonomics_stove_safety',
      ruleId: rule.id,
      severity: rule.severity as ErgonomicsSeverity,
      category: rule.category as ErgonomicsCategory,
      title: rule.name,
      description: `Плита и холодильник упомянуты. Необходимо зафиксировать наличие защитной панели и расстояние от плиты до боковой стены ≥ ${rule.params.minWallCm} см.`,
      evidence: `Кухня: плита + холодильник. Защитная панель не упомянута.`,
      suggestion: rule.suggestion,
      unlocks: rule.unlocks,
    });
  }

  return warnings;
}

function checkPassageMinWidth(
  rooms: RoomInput[],
  allText: string,
  ruleSet: ErgonomicsRule[],
): ErgonomicsWarning[] {
  const rule = ruleSet.find(r => r.id === 'passage_min_width')!;
  const warnings: ErgonomicsWarning[] = [];
  const minCm = rule.params.minCm;
  const comfortCm = rule.params.comfortCm;

  for (const room of rooms) {
    if (!roomIsType(room, HALLWAY_NAMES)) continue;
    const dims = parseDimensions(room.dimensions_text || '');
    if (!dims) continue;

    const narrowSide = dims.width * 100; // convert m → cm
    if (narrowSide < minCm) {
      warnings.push({
        id: `ergonomics_passage_min_${room.name}`,
        ruleId: rule.id,
        severity: rule.severity as ErgonomicsSeverity,
        category: rule.category as ErgonomicsCategory,
        title: `${rule.name}: «${room.name}» ${narrowSide.toFixed(0)} см`,
        description: `Ширина ${narrowSide.toFixed(0)} см ниже минимально допустимых ${minCm} см. Проход не соответствует нормам безопасной эвакуации и повседневного использования.`,
        evidence: `${room.name}: ${room.dimensions_text}`,
        suggestion: rule.suggestion,
        unlocks: rule.unlocks,
        roomName: room.name,
      });
    } else if (narrowSide < comfortCm) {
      warnings.push({
        id: `ergonomics_passage_comfort_${room.name}`,
        ruleId: rule.id,
        severity: 'optional',
        category: rule.category as ErgonomicsCategory,
        title: `Узкий проход: «${room.name}» ${narrowSide.toFixed(0)} см`,
        description: `Ширина ${narrowSide.toFixed(0)} см допустима, но ниже комфортного минимума ${comfortCm} см. Исключите крупную мебель вдоль этого прохода.`,
        evidence: `${room.name}: ${room.dimensions_text}`,
        suggestion: 'В узком проходе 60–90 см избегайте навесных шкафов ниже 210 см и распашных дверей — ставьте раздвижные.',
        unlocks: rule.unlocks,
        roomName: room.name,
      });
    }
  }

  // text-based: "коридор 60 см", "коридор узкий"
  const narrowTextKw = ['коридор 60', 'коридор 50', 'коридор 70', 'узкий коридор', 'тесный коридор'];
  const narrowFound = containsAny(allText, narrowTextKw);
  if (narrowFound && !rooms.some(r => roomIsType(r, HALLWAY_NAMES))) {
    warnings.push({
      id: 'ergonomics_passage_min_text',
      ruleId: rule.id,
      severity: rule.severity as ErgonomicsSeverity,
      category: rule.category as ErgonomicsCategory,
      title: rule.name,
      description: 'В описании упоминается узкий коридор. Проверьте чистовые размеры с учётом отделки.',
      evidence: `Из описания: «${narrowFound}»`,
      suggestion: rule.suggestion,
      unlocks: rule.unlocks,
    });
  }

  return warnings;
}

function checkSmallSpaceScale(
  rooms: RoomInput[],
  allText: string,
  ruleSet: ErgonomicsRule[],
): ErgonomicsWarning[] {
  const rule = ruleSet.find(r => r.id === 'passage_small_space_scale')!;
  const warnings: ErgonomicsWarning[] = [];
  const maxSqm = rule.params.smallRoomMaxSqm;

  const largeFurnitureKw = ['большой диван', 'угловой диван', 'диван 2', 'диван 3', 'шкаф-купе', 'гардеробная'];

  for (const room of rooms) {
    const dims = parseDimensions(room.dimensions_text || '');
    if (!dims || dims.area >= maxSqm) continue;

    const roomText = `${room.name} ${room.dimensions_text || ''}`.toLowerCase();
    const fullContext = `${allText} ${roomText}`;

    const bigFurniture = containsAny(fullContext, largeFurnitureKw);
    if (bigFurniture) {
      warnings.push({
        id: `ergonomics_small_space_${room.name}`,
        ruleId: rule.id,
        severity: rule.severity as ErgonomicsSeverity,
        category: rule.category as ErgonomicsCategory,
        title: `${rule.name}: «${room.name}» (${dims.area.toFixed(1)} м²)`,
        description: `Помещение ${dims.area.toFixed(1)} м² — меньше ${maxSqm} м². Упомянутая крупногабаритная мебель («${bigFurniture}») может перекрыть основной проход.`,
        evidence: `${room.name}: ${room.dimensions_text} + мебель: «${bigFurniture}»`,
        suggestion: rule.suggestion,
        unlocks: rule.unlocks,
        roomName: room.name,
      });
    }
  }

  return warnings;
}

function checkDoorSwing(
  rooms: RoomInput[],
  allText: string,
  ruleSet: ErgonomicsRule[],
): ErgonomicsWarning[] {
  const rule = ruleSet.find(r => r.id === 'door_swing_clearance')!;
  const warnings: ErgonomicsWarning[] = [];

  const swingProblemKw = [
    'дверь мешает', 'дверь бьёт', 'дверь задевает',
    'нет места для двери', 'дверь в стену',
    'подъёмный фасад', 'подъёмные фасады',
    'шкаф под потолок', 'встроенный шкаф до потолка',
  ];

  const found = containsAny(allText, swingProblemKw);
  if (found) {
    warnings.push({
      id: 'ergonomics_door_swing',
      ruleId: rule.id,
      severity: rule.severity as ErgonomicsSeverity,
      category: rule.category as ErgonomicsCategory,
      title: rule.name,
      description: 'В описании есть признаки конфликта зоны открывания дверей или фасадов шкафов с проходами.',
      evidence: `Из описания: «${found}»`,
      suggestion: rule.suggestion,
      unlocks: rule.unlocks,
    });
  }

  // Narrow hallway + standard door = likely conflict
  const hallways = rooms.filter(r => roomIsType(r, HALLWAY_NAMES));
  for (const room of hallways) {
    const dims = parseDimensions(room.dimensions_text || '');
    if (!dims) continue;
    const narrowSide = dims.width * 100;
    if (narrowSide > 0 && narrowSide < rule.params.doorSwingCm + 60) {
      warnings.push({
        id: `ergonomics_door_swing_${room.name}`,
        ruleId: rule.id,
        severity: 'important',
        category: rule.category as ErgonomicsCategory,
        title: `Зона открывания двери: «${room.name}» (${narrowSide.toFixed(0)} см)`,
        description: `При ширине ${narrowSide.toFixed(0)} см стандартная дверь (${rule.params.doorSwingCm} см) займёт значительную часть прохода. Рассмотрите раздвижные двери.`,
        evidence: `${room.name}: ${room.dimensions_text}`,
        suggestion: rule.suggestion,
        unlocks: rule.unlocks,
        roomName: room.name,
      });
    }
  }

  return warnings;
}

function checkLightingScenarios(
  brief: BriefInput,
  allText: string,
  ruleSet: ErgonomicsRule[],
): ErgonomicsWarning[] {
  const rule = ruleSet.find(r => r.id === 'lighting_scenarios')!;
  const warnings: ErgonomicsWarning[] = [];

  const lightingKw = ['освещени', 'свет', 'люстра', 'бра', 'торшер', 'подсветка', 'светильник', 'лампа'];
  const multiScenarioKw = [
    'несколько источников', 'многоуровневое', 'сценарий света',
    'рабочий свет', 'акцентный свет', 'декоративный свет',
    'диммер', 'диммируемый', 'умный дом', 'smart home',
  ];

  const mentionsLighting = containsAny(allText, lightingKw);
  if (!mentionsLighting) return warnings;

  const mentionsMulti = containsAny(allText, multiScenarioKw);
  const onlyCeiling = /только люстра|одна люстра|точечный свет|потолочный свет/.test(allText.toLowerCase());

  if (onlyCeiling && !mentionsMulti) {
    warnings.push({
      id: 'ergonomics_lighting_scenarios',
      ruleId: rule.id,
      severity: rule.severity as ErgonomicsSeverity,
      category: rule.category as ErgonomicsCategory,
      title: rule.name,
      description: 'Упомянут только потолочный свет — это один сценарий из трёх необходимых. Многоуровневое освещение значительно влияет на восприятие пространства.',
      evidence: 'Описание освещения ограничено потолочным источником',
      suggestion: rule.suggestion,
      unlocks: rule.unlocks,
    });
  }

  return warnings;
}

function checkBedAtWindow(
  rooms: RoomInput[],
  allText: string,
  ruleSet: ErgonomicsRule[],
): ErgonomicsWarning[] {
  const rule = ruleSet.find(r => r.id === 'bed_not_at_window')!;
  const warnings: ErgonomicsWarning[] = [];

  const bedWindowKw = [
    'кровать у окна', 'кровать к окну', 'изголовье у окна',
    'кровать под окном', 'кровать возле окна',
  ];
  const found = containsAny(allText, bedWindowKw);
  if (found) {
    warnings.push({
      id: 'ergonomics_bed_window',
      ruleId: rule.id,
      severity: rule.severity as ErgonomicsSeverity,
      category: rule.category as ErgonomicsCategory,
      title: rule.name,
      description: 'В описании упомянуто размещение кровати у окна. Это создаёт сквозняки, температурный перепад и конфликт со шторами.',
      evidence: `Из описания: «${found}»`,
      suggestion: rule.suggestion,
      unlocks: rule.unlocks,
    });
  }

  return warnings;
}

function checkBedAtDoor(
  rooms: RoomInput[],
  allText: string,
  ruleSet: ErgonomicsRule[],
): ErgonomicsWarning[] {
  const rule = ruleSet.find(r => r.id === 'bed_not_at_door')!;
  const warnings: ErgonomicsWarning[] = [];

  const bedDoorKw = [
    'кровать напротив двери', 'кровать у двери', 'изголовье к двери',
    'кровать против двери',
  ];
  const found = containsAny(allText, bedDoorKw);
  if (found) {
    warnings.push({
      id: 'ergonomics_bed_door',
      ruleId: rule.id,
      severity: rule.severity as ErgonomicsSeverity,
      category: rule.category as ErgonomicsCategory,
      title: rule.name,
      description: 'Кровать расположена напротив или у двери — нарушает приватность и снижает качество сна.',
      evidence: `Из описания: «${found}»`,
      suggestion: rule.suggestion,
      unlocks: rule.unlocks,
    });
  }

  return warnings;
}

function checkStoragePerResident(
  brief: BriefInput,
  rooms: RoomInput[],
  allText: string,
  ruleSet: ErgonomicsRule[],
): ErgonomicsWarning[] {
  const rule = ruleSet.find(r => r.id === 'storage_per_resident')!;
  const warnings: ErgonomicsWarning[] = [];

  const { adults, children } = parseResidentCount(brief.users_of_space || allText);
  const totalPeople = adults + children;
  if (totalPeople === 0) return warnings;

  const requiredLinear =
    adults * rule.params.minLinearMPerAdult +
    children * rule.params.minLinearMPerChild;

  const storageKw = ['гардеробная', 'гардероб', 'шкаф-купе', 'встроенный шкаф', 'кладовая', 'гардеробн'];
  const hasStorageMention = containsAny(allText, storageKw);

  // Measure storage linear meters mentioned
  const storageLinearMatch = allText.match(/(?:шкаф|гардероб)[^.]*?(\d+(?:[.,]\d+)?)\s*(?:пог\.?\s*м|погонн)/i);
  if (storageLinearMatch) {
    const actualLinear = parseFloat(storageLinearMatch[1].replace(',', '.'));
    if (actualLinear < requiredLinear) {
      warnings.push({
        id: 'ergonomics_storage_linear',
        ruleId: rule.id,
        severity: rule.severity as ErgonomicsSeverity,
        category: rule.category as ErgonomicsCategory,
        title: `${rule.name}: ${actualLinear} пог.м при норме ${requiredLinear.toFixed(1)} пог.м`,
        description: `Для ${totalPeople} жильцов (${adults} взр. + ${children} дет.) норма хранения — ${requiredLinear.toFixed(1)} пог.м. Упомянуто ${actualLinear} пог.м.`,
        evidence: `Жильцы: ${brief.users_of_space?.slice(0, 80) || 'из описания'}`,
        suggestion: rule.suggestion,
        unlocks: rule.unlocks,
      });
    }
  } else if (!hasStorageMention && totalPeople >= 2) {
    warnings.push({
      id: 'ergonomics_storage_not_mentioned',
      ruleId: rule.id,
      severity: 'optional',
      category: rule.category as ErgonomicsCategory,
      title: rule.name,
      description: `Для ${totalPeople} жильцов необходимо ≥ ${requiredLinear.toFixed(1)} пог.м хранения одежды. Место для хранения в планировке не упомянуто.`,
      evidence: `Состав: ${brief.users_of_space?.slice(0, 80) || 'данные из описания'}`,
      suggestion: rule.suggestion,
      unlocks: rule.unlocks,
    });
  }

  return warnings;
}

// ─── main export ──────────────────────────────────────────────────────────────

export const DEFAULT_RULES: ErgonomicsRule[] = rules as ErgonomicsRule[];

export function validateErgonomics(
  brief: BriefInput,
  rooms: RoomInput[],
  project: ProjectInput,
  customRules?: ErgonomicsRule[],
): ErgonomicsWarning[] {
  const ruleSet = customRules ?? DEFAULT_RULES;

  const allText = [
    brief.users_of_space,
    brief.scenarios,
    brief.style_likes,
    brief.constraints_practical,
    project.raw_input,
    project.rooms_description,
    ...rooms.map(r => `${r.name} ${r.dimensions_text || ''}`),
  ]
    .filter(Boolean)
    .join(' ');

  const warnings: ErgonomicsWarning[] = [
    ...checkKitchenWorkTriangle(rooms, allText, ruleSet),
    ...checkKitchenSinkDishwasher(rooms, allText, ruleSet),
    ...checkKitchenStoveSafety(rooms, allText, ruleSet),
    ...checkPassageMinWidth(rooms, allText, ruleSet),
    ...checkSmallSpaceScale(rooms, allText, ruleSet),
    ...checkDoorSwing(rooms, allText, ruleSet),
    ...checkLightingScenarios(brief, allText, ruleSet),
    ...checkBedAtWindow(rooms, allText, ruleSet),
    ...checkBedAtDoor(rooms, allText, ruleSet),
    ...checkStoragePerResident(brief, rooms, allText, ruleSet),
  ];

  const order: Record<ErgonomicsSeverity, number> = { critical: 0, important: 1, optional: 2 };
  return warnings.sort((a, b) => order[a.severity] - order[b.severity]);
}
