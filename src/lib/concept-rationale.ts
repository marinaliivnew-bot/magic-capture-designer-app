import { normalizeUserRefs } from "./user-refs";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  brief: "бриф",
  client_reference: "клиентский референс",
  designer_profile: "профиль дизайнера",
  answered_question: "ответ клиента",
  manual: "ручное решение дизайнера",
  master_reference: "мастер-референс",
  user_upload: "ручная замена изображения",
};

const BRIEF_KEYS_BY_BLOCK: Record<string, string[]> = {
  atmosphere: ["style_likes", "style_dislikes", "success_criteria"],
  palette: ["style_likes", "constraints_practical"],
  materials: ["style_likes", "constraints_practical", "budget"],
  furniture: ["scenarios", "zones", "storage"],
  lighting: ["scenarios", "zones", "constraints_practical"],
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function compact(value: string, limit = 140) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1).trim()}…` : normalized;
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function words(value: string) {
  return unique(
    normalizeForSearch(value)
      .replace(/[^a-zа-я0-9\s-]/g, " ")
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 4)
  );
}

const STYLE_STOP_WORDS = new Set([
  "style",
  "interior",
  "room",
  "texture",
  "surface",
  "проект",
  "стиль",
  "интерьер",
  "нужно",
  "нужны",
  "нравится",
  "берем",
  "используем",
  "референс",
  "клиент",
  "свет",
  "материал",
  "материалы",
]);

function labelSourceType(sourceType: string) {
  return SOURCE_TYPE_LABELS[sourceType] || sourceType;
}

export function getBlockRationale(block: any, brief: any): string[] {
  const reasons: string[] = [];
  const images = Array.isArray(block?.board_images) ? block.board_images : [];
  const sourceTypes = unique(
    images
      .map((img: any) => text(img?.source_type))
      .concat(text(block?.source_type))
      .filter(Boolean)
  );
  const sourceUrls = images.filter((img: any) => text(img?.source_url) || text(img?.url));
  const imageNotes = unique(images.map((img: any) => text(img?.note)).filter(Boolean));

  if (sourceTypes.length > 0) {
    reasons.push(`Источник решения: ${sourceTypes.map(labelSourceType).join(", ")}.`);
  }

  if (sourceUrls.length > 0) {
    reasons.push(`Визуальная проверка: ${sourceUrls.length} референс(ов) с сохраненным URL.`);
  }

  if (imageNotes.length > 0) {
    reasons.push(`Сигнал из референса: ${compact(imageNotes[0])}`);
  }

  const briefKeys = BRIEF_KEYS_BY_BLOCK[block?.block_type] || [];
  const briefEvidence = briefKeys.map((key) => text(brief?.[key])).find(Boolean);
  if (briefEvidence) {
    reasons.push(`Связь с брифом: ${compact(briefEvidence)}`);
  }

  if (text(block?.caption)) {
    reasons.push(`Дизайнерское решение: ${compact(block.caption)}`);
  }

  return unique(reasons).slice(0, 3);
}

export function getConceptBasis(blocks: any[], brief: any): string[] {
  const refs = normalizeUserRefs(brief?.user_refs_structured || brief?.user_refs, "project");
  const basis: string[] = [];

  const refLikes = refs.map((ref) => text(ref.likes)).filter(Boolean);
  const refTags = unique(refs.flatMap((ref) => (Array.isArray(ref.tags) ? ref.tags : [])));

  if (refLikes.length > 0) {
    basis.push(`Клиентские референсы: ${compact(refLikes[0])}`);
  }
  if (refTags.length > 0) {
    basis.push(`Ключевые визуальные сигналы: ${refTags.slice(0, 6).join(", ")}.`);
  }

  const briefStyle = text(brief?.style_likes);
  if (briefStyle) basis.push(`Стилевые предпочтения из брифа: ${compact(briefStyle)}`);

  const blockReasons = (blocks || [])
    .flatMap((block) => getBlockRationale(block, brief))
    .filter((reason) => !reason.startsWith("Дизайнерское решение"));
  basis.push(...blockReasons);

  return unique(basis).slice(0, 5);
}

export function getClientReferenceAnalysis(brief: any) {
  const refs = normalizeUserRefs(brief?.user_refs_structured || brief?.user_refs, "project");

  return refs.map((ref, index) => ({
    id: `${ref.url}-${index}`,
    label: `Референс ${index + 1}`,
    url: ref.url,
    take: text(ref.likes) || (ref.tags?.length ? `Берем признаки: ${ref.tags.join(", ")}` : ""),
    reject: text(ref.dislikes),
    clarify: !text(ref.likes) && !text(ref.dislikes) ? "Требует ручного разбора дизайнером" : "",
  }));
}

function extractSignals(value: string) {
  return unique(
    value
      .split(/[,.;\n]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 3)
  );
}

function normalizeForSearch(value: string) {
  return value.toLowerCase().replace(/ё/g, "е");
}

function blockSearchText(block: any) {
  const images = Array.isArray(block?.board_images) ? block.board_images : [];
  const imageText = images
    .flatMap((img: any) => [img?.note, img?.source_type, img?.source_url, img?.attribution])
    .map((item) => text(item))
    .join(" ");
  const chipsText = Array.isArray(block?.color_chips)
    ? block.color_chips.map((chip: any) => [chip?.name, chip?.role, chip?.ral, chip?.hex].map(text).join(" ")).join(" ")
    : "";
  const zonesText = Array.isArray(block?.lighting_zones)
    ? block.lighting_zones.map((zone: any) => [zone?.zone, zone?.scenario, zone?.type, zone?.kelvin].map(text).join(" ")).join(" ")
    : "";

  return normalizeForSearch([block?.caption, block?.source_type, imageText, chipsText, zonesText].map(text).join(" "));
}

function findSignalMatches(signal: string, blocks: any[]) {
  const normalizedSignal = normalizeForSearch(signal);
  return (blocks || [])
    .filter((block) => blockSearchText(block).includes(normalizedSignal))
    .map((block) => block?.block_type)
    .filter(Boolean);
}

export interface ReferenceMatchRow {
  id: string;
  label: string;
  url: string;
  extractedSignals: string[];
  usedInConcept: string[];
  excluded: string[];
  needsClarification: string[];
  coverageRatio: number;
}

export function getReferenceMatchMatrix(brief: any, blocks: any[]): ReferenceMatchRow[] {
  const refs = normalizeUserRefs(brief?.user_refs_structured || brief?.user_refs, "project");

  return refs.map((ref, index) => {
    const extractedSignals = unique([...extractSignals(text(ref.likes)), ...(ref.tags || [])]);
    const excluded = extractSignals(text(ref.dislikes));
    const usedInConcept = unique(
      extractedSignals.flatMap((signal) => {
        const matches = findSignalMatches(signal, blocks);
        return matches.length > 0 ? [`${signal} → ${matches.join(", ")}`] : [];
      })
    );
    const needsClarification = extractedSignals.filter((signal) => findSignalMatches(signal, blocks).length === 0);

    return {
      id: `${ref.url}-${index}`,
      label: `Референс ${index + 1}`,
      url: ref.url,
      extractedSignals,
      usedInConcept,
      excluded,
      needsClarification,
      coverageRatio: extractedSignals.length > 0 ? usedInConcept.length / extractedSignals.length : 1,
    };
  });
}

export function getReferenceCoverage(brief: any, blocks: any[]) {
  const rows = getReferenceMatchMatrix(brief, blocks);
  const signalCount = rows.reduce((sum, row) => sum + row.extractedSignals.length, 0);
  const usedCount = rows.reduce((sum, row) => sum + row.usedInConcept.length, 0);

  return {
    rows,
    signalCount,
    usedCount,
    ratio: signalCount > 0 ? usedCount / signalCount : 1,
    hasUnmappedSignals: rows.some((row) => row.needsClarification.length > 0),
  };
}

export interface StyleFormula {
  phrase: string;
  terms: string[];
  negativeTerms: string[];
  sources: string[];
}

export interface MasterReference {
  id: string;
  blockType: string;
  url: string;
  note: string;
}

export interface StyleConflict {
  blockType: string;
  blockLabel: string;
  reason: string;
}

function getNarrowingLabels(brief: any) {
  const narrowing = brief?.style_narrowing_result;
  if (!narrowing || typeof narrowing !== "object") return [];
  return unique(
    ["styles", "moods", "materials", "colors"]
      .flatMap((key) => (Array.isArray(narrowing[key]) ? narrowing[key] : []))
      .map((item: any) => text(item?.label || item?.key || item))
  );
}

export function getStyleFormula(brief: any, blocks: any[] = []): StyleFormula {
  const refs = normalizeUserRefs(brief?.user_refs_structured || brief?.user_refs, "project");
  const refSignals = refs.flatMap((ref) => [
    text(ref.likes),
    ...(Array.isArray(ref.tags) ? ref.tags.map(text) : []),
  ]);
  const agreed = brief?.agreed_style_result;
  const agreedSignals = Array.isArray(agreed?.agreed_elements)
    ? agreed.agreed_elements.map((item: any) => text(item?.element || item?.client_signal))
    : [];
  const blockSignals = blocks
    .flatMap((block) => [text(block?.caption), ...(block?.board_images || []).map((img: any) => text(img?.note))])
    .filter(Boolean);

  const positiveSources = unique([
    ...getNarrowingLabels(brief),
    ...agreedSignals,
    text(brief?.style_likes),
    ...refSignals,
    ...blockSignals,
  ]);
  const negativeTerms = unique([
    ...words(text(brief?.style_dislikes)),
    ...words(text(brief?.constraints_practical)),
    ...refs.flatMap((ref) => words(text(ref.dislikes))),
  ]).filter((term) => !STYLE_STOP_WORDS.has(term));

  const terms = unique(positiveSources.flatMap(words))
    .filter((term) => !STYLE_STOP_WORDS.has(term) && !negativeTerms.includes(term))
    .slice(0, 10);
  const phrase = positiveSources.length > 0
    ? compact(positiveSources.slice(0, 3).join("; "), 220)
    : "Единый визуальный язык еще не зафиксирован: заполните стилевые предпочтения или выберите мастер-референс.";

  return {
    phrase,
    terms,
    negativeTerms,
    sources: positiveSources.slice(0, 5),
  };
}

export function getMasterReference(blocks: any[]): MasterReference | null {
  for (const block of blocks || []) {
    const image = (block?.board_images || []).find((img: any) => text(img?.source_type) === "master_reference");
    if (image) {
      return {
        id: image.id,
        blockType: block.block_type,
        url: text(image.url),
        note: text(image.note || image.attribution),
      };
    }
  }
  return null;
}

export function getStyleConsistency(brief: any, blocks: any[]) {
  const formula = getStyleFormula(brief, blocks);
  const master = getMasterReference(blocks);
  const requiredTerms = formula.terms.slice(0, master ? 4 : 6);
  const conflicts: StyleConflict[] = [];

  for (const block of blocks || []) {
    if (!["materials", "furniture"].includes(block?.block_type)) continue;
    const searchText = blockSearchText(block);
    const matchedTerms = requiredTerms.filter((term) => searchText.includes(term));
    const negativeMatches = formula.negativeTerms.filter((term) => searchText.includes(term));

    if (requiredTerms.length >= 3 && matchedTerms.length === 0) {
      conflicts.push({
        blockType: block.block_type,
        blockLabel: block.block_type,
        reason: "Блок не содержит признаков стилевой формулы и может выглядеть чужеродно.",
      });
    }

    if (negativeMatches.length > 0) {
      conflicts.push({
        blockType: block.block_type,
        blockLabel: block.block_type,
        reason: `Найдены признаки из табу/ограничений: ${negativeMatches.slice(0, 4).join(", ")}.`,
      });
    }
  }

  return {
    formula,
    master,
    conflicts,
    hasConflicts: conflicts.length > 0,
  };
}
