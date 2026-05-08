export type ConflictType =
  | 'budget_vs_materials'
  | 'dimensions_mismatch'
  | 'style_vs_constraints'
  | 'materials_vs_function';

export type ConflictSeverity = 'critical' | 'important' | 'optional';

export interface ConflictItem {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  title: string;
  description: string;
  evidence_a: string;
  evidence_b: string;
  question: string;
  unlocks: string;
}

export interface BriefSnapshot {
  users_of_space?: string;
  scenarios?: string;
  style_likes?: string;
  style_dislikes?: string;
  constraints_practical?: string;
  budget?: string;
  timeline?: string;
  success_criteria?: string;
}

export interface RoomSnapshot {
  name: string;
  room_type?: string;
  dimensions_text?: string;
}

export interface ProjectSnapshot {
  raw_input?: string;
  rooms_description?: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function containsAny(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

function parseBudget(text: string): number | null {
  if (!text?.trim()) return null;
  const s = text.toLowerCase();
  const mln = s.match(/(\d+[.,]?\d*)\s*млн/);
  if (mln) return parseFloat(mln[1].replace(',', '.')) * 1_000_000;
  const tys = s.match(/(\d+[.,]?\d*)\s*тыс/);
  if (tys) return parseFloat(tys[1].replace(',', '.')) * 1_000;
  // space-separated number ≥ 5 digits: "3 000 000"
  const num = s.match(/(\d[\d\s]{4,})/);
  if (num) return parseInt(num[1].replace(/\s/g, ''), 10);
  return null;
}

function extractAreaFromText(text: string): { area: number; context: string }[] {
  const results: { area: number; context: string }[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(?:кв\.?\s*м|м²|квадрат)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const area = parseFloat(m[1].replace(',', '.'));
    const ctx = text.slice(Math.max(0, m.index - 30), m.index + 50).replace(/\s+/g, ' ').trim();
    results.push({ area, ctx });
  }
  return results;
}

// ─── rule tables ──────────────────────────────────────────────────────────────

const PREMIUM_MATERIALS: { keywords: string[]; label: string; minBudget: number }[] = [
  { keywords: ['мрамор', 'мраморный', 'мраморная'], label: 'мрамор', minBudget: 2_000_000 },
  { keywords: ['паркет дуб', 'дубовый паркет', 'массив дуба', 'паркет из дуба'], label: 'паркет из дуба', minBudget: 1_500_000 },
  { keywords: ['латунь', 'латунный', 'латунная'], label: 'латунная фурнитура', minBudget: 1_500_000 },
  { keywords: ['травертин', 'оникс'], label: 'натуральный камень', minBudget: 2_000_000 },
  { keywords: ['итальянская мебель', 'итальянский кухн'], label: 'итальянская мебель', minBudget: 2_000_000 },
  { keywords: ['бронза', 'бронзовый', 'бронзовая'], label: 'бронзовые элементы', minBudget: 1_500_000 },
];

const DELICATE_MATERIALS = [
  'бархат', 'бархатный', 'бархатная',
  'велюр', 'велюровый',
  'шёлк', 'шелк', 'шелковый', 'шёлковый',
  'светлый ворс', 'белый ковёр', 'белый ковер', 'светлый ковёр', 'светлый ковер',
  'белый паркет', 'светлый паркет',
  'замша', 'замшевый',
];

const PROBLEMATIC_CONDITIONS: { keywords: string[]; label: string }[] = [
  { keywords: ['кошка', 'кот', 'кошки', 'кота', 'котёнок'], label: 'кошка' },
  { keywords: ['собака', 'пёс', 'пес', 'собаки', 'щенок'], label: 'собака' },
  { keywords: ['животны', 'питомец'], label: 'домашние животные' },
  { keywords: ['маленький ребенок', 'маленький ребёнок', 'малыш', 'младенец', 'ребенок до', 'ребёнок до'], label: 'маленький ребёнок' },
];

// Pairs of style keywords that contradict each other inside style_likes
const STYLE_CONTRADICTION_PAIRS: { a: string[]; b: string[]; description: string }[] = [
  {
    a: ['минимализм', 'минималист', 'лаконичн'],
    b: ['лепнина', 'барокко', 'рококо', 'версаль', 'орнамент'],
    description: 'минимализм и декоративные элементы барокко/рококо',
  },
  {
    a: ['japandi', 'японский стиль', 'ваби-саби', 'ваби саби'],
    b: ['гламур', 'голливудский', 'блеск', 'глянец', 'хромированный'],
    description: 'japandi и гламурные элементы',
  },
  {
    a: ['скандинав', 'нордик', 'hygge'],
    b: ['барокко', 'рококо', 'версаль', 'ампир'],
    description: 'скандинавский стиль и барокко/ампир',
  },
];

// ─── main export ──────────────────────────────────────────────────────────────

export function detectConflicts(
  brief: BriefSnapshot,
  rooms: RoomSnapshot[],
  project: ProjectSnapshot,
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];
  let counter = 0;
  const id = () => `c_${++counter}`;

  const likes = brief.style_likes || '';
  const dislikes = brief.style_dislikes || '';
  const users = brief.users_of_space || '';
  const constraints = brief.constraints_practical || '';
  const budget = brief.budget || '';
  const raw = project.raw_input || '';
  const roomsDesc = project.rooms_description || '';

  // ── 1. Бюджет vs стоимость материалов ────────────────────────────────────
  const budgetAmount = parseBudget(budget);
  if (budgetAmount !== null) {
    for (const mat of PREMIUM_MATERIALS) {
      if (containsAny(likes, mat.keywords) && budgetAmount < mat.minBudget) {
        const budgetFmt = budget.trim();
        const thresholdFmt =
          mat.minBudget >= 1_000_000
            ? `${mat.minBudget / 1_000_000} млн ₽`
            : `${mat.minBudget / 1_000} тыс ₽`;
        conflicts.push({
          id: id(),
          type: 'budget_vs_materials',
          severity: 'important',
          title: `Бюджет не покрывает ${mat.label}`,
          description: `Клиент упоминает ${mat.label} в пожеланиях, но бюджет (${budgetFmt}) ниже типичного порога для этого материала (от ${thresholdFmt}).`,
          evidence_a: `Пожелания: «${likes.slice(0, 100)}»`,
          evidence_b: `Бюджет: ${budgetFmt}`,
          question: `Готов ли клиент рассмотреть аналоги ${mat.label} в другом ценовом сегменте, или бюджет может быть скорректирован?`,
          unlocks: 'Подбор материалов',
        });
        break; // one budget conflict is enough
      }
    }
  }

  // ── 2. Метраж из разных источников ───────────────────────────────────────
  const textSources = [raw, roomsDesc].filter(Boolean).join('\n');
  if (textSources && rooms.length > 0) {
    for (const room of rooms) {
      if (!room.dimensions_text?.trim()) continue;
      const roomAreaM = room.dimensions_text.match(/(\d+(?:[.,]\d+)?)/);
      if (!roomAreaM) continue;
      const roomArea = parseFloat(roomAreaM[1].replace(',', '.'));
      if (roomArea < 3) continue;

      // Find room name in text sources
      const nameIdx = textSources.toLowerCase().indexOf(room.name.toLowerCase());
      if (nameIdx === -1) continue;

      const nearby = textSources.slice(Math.max(0, nameIdx - 10), nameIdx + 100);
      const areas = extractAreaFromText(nearby);
      for (const { area: textArea, context: ctx } of areas) {
        const diff = Math.abs(textArea - roomArea) / Math.max(textArea, roomArea);
        if (diff > 0.15) {
          conflicts.push({
            id: id(),
            type: 'dimensions_mismatch',
            severity: 'critical',
            title: `Расхождение площади: «${room.name}»`,
            description: `В списке помещений — ${roomArea} м², в заметках — ${textArea} м². Расхождение ${Math.round(diff * 100)}% влияет на планировочное решение.`,
            evidence_a: `Список помещений: ${room.name} — ${room.dimensions_text}`,
            evidence_b: `Заметки: «${ctx}»`,
            question: `Какой источник данных по площади «${room.name}» актуален — список помещений или заметки? Нужен обмерочный план.`,
            unlocks: 'Планировочное решение',
          });
          break;
        }
      }
    }
  }

  // ── 3. Стиль vs ограничения ───────────────────────────────────────────────

  // 3a. Взаимно исключающие стили внутри style_likes
  for (const pair of STYLE_CONTRADICTION_PAIRS) {
    const hasA = pair.a.some(kw => likes.toLowerCase().includes(kw));
    const hasB = pair.b.some(kw => likes.toLowerCase().includes(kw));
    if (hasA && hasB) {
      conflicts.push({
        id: id(),
        type: 'style_vs_constraints',
        severity: 'important',
        title: `Стилевое противоречие: ${pair.description}`,
        description: 'В пожеланиях одновременно присутствуют несовместимые стилевые направления.',
        evidence_a: `Пожелания: «${likes.slice(0, 120)}»`,
        evidence_b: 'Противоречие внутри одного блока',
        question: 'Какое из стилевых направлений является приоритетным? Возможно, клиент имеет в виду отдельные элементы, а не целый стиль?',
        unlocks: 'Согласование стиля',
      });
    }
  }

  // 3b. Один и тот же элемент в likes и dislikes
  if (likes && dislikes) {
    const likeWords = likes.toLowerCase().split(/[\s,;.!?]+/).filter(w => w.length > 4);
    const dislikeSet = new Set(dislikes.toLowerCase().split(/[\s,;.!?]+/).filter(w => w.length > 4));
    const overlap = likeWords.filter(w => dislikeSet.has(w));
    if (overlap.length > 0) {
      conflicts.push({
        id: id(),
        type: 'style_vs_constraints',
        severity: 'important',
        title: 'Элемент одновременно в «нравится» и «не нравится»',
        description: `Одни и те же слова встречаются в обоих блоках вкуса (например: «${overlap.slice(0, 3).join('», «')}»).`,
        evidence_a: `Нравится: «${likes.slice(0, 100)}»`,
        evidence_b: `Не нравится: «${dislikes.slice(0, 100)}»`,
        question: 'Уточните у клиента: что конкретно нравится, а что нет? Возможно, речь о разных формах одного и того же элемента.',
        unlocks: 'Согласование стиля',
      });
    }
  }

  // 3c. Светлая палитра + требование износостойкости
  if (constraints && likes) {
    const wearKw = ['износостойк', 'практичн', 'моющийся', 'легко мыть', 'без следов', 'стойкий'];
    const lightKw = ['белый', 'светлый', 'пастельн', 'нежн', 'кремовый', 'молочный', 'айвори'];
    const needsWear = wearKw.some(kw => constraints.toLowerCase().includes(kw));
    const wantsLight = lightKw.some(kw => likes.toLowerCase().includes(kw));
    if (needsWear && wantsLight) {
      conflicts.push({
        id: id(),
        type: 'style_vs_constraints',
        severity: 'important',
        title: 'Светлая палитра vs требование износостойкости',
        description: 'Пожелания на светлые/пастельные оттенки конфликтуют с требованием практичности и износостойкости.',
        evidence_a: `Пожелания: «${likes.slice(0, 100)}»`,
        evidence_b: `Ограничения: «${constraints.slice(0, 100)}»`,
        question: 'Какой приоритет выше — светлая палитра или практичность? Рассматривает ли клиент износостойкие материалы в светлых тонах (кварцвинил, керамогранит, матовые краски)?',
        unlocks: 'Подбор материалов',
      });
    }
  }

  // ── 4. Материалы vs функциональные требования ────────────────────────────
  const foundDelicate = DELICATE_MATERIALS.find(m => likes.toLowerCase().includes(m.toLowerCase()));
  if (foundDelicate) {
    const allUserText = [users, raw].filter(Boolean).join(' ');
    for (const cond of PROBLEMATIC_CONDITIONS) {
      if (containsAny(allUserText, cond.keywords)) {
        conflicts.push({
          id: id(),
          type: 'materials_vs_function',
          severity: 'critical',
          title: `${foundDelicate} + ${cond.label} — высокий риск повреждений`,
          description: `Деликатный материал (${foundDelicate}) не совместим с условиями эксплуатации. ${cond.label} повредит или быстро загрязнит покрытие.`,
          evidence_a: `Пожелания: «${likes.slice(0, 100)}»`,
          evidence_b: `Состав домохозяйства: «${users.slice(0, 100)}»`,
          question: `Знает ли клиент о сложности ухода за ${foundDelicate} в присутствии ${cond.label}? Готов ли рассмотреть альтернативы с аналогичной текстурой, но высокой стойкостью?`,
          unlocks: 'Концепт-борд',
        });
        break;
      }
    }
  }

  // Sort: critical → important → optional
  const order: Record<ConflictSeverity, number> = { critical: 0, important: 1, optional: 2 };
  return conflicts.sort((a, b) => order[a.severity] - order[b.severity]);
}
