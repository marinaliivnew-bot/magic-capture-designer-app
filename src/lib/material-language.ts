const EXPLICIT_ARTIFICIAL_TERMS = [
  "искусствен",
  "синтетич",
  "ненатурал",
  "пластик",
  "пвх",
  "акрил",
  "hpl",
  "ламинат",
];

const PRACTICAL_ANALOG_TERMS = [
  "практич",
  "износостой",
  "моющ",
  "легко мыть",
  "простой уход",
  "стойк",
  "аналог",
  "имитац",
  "керамогранит",
  "кварцвинил",
];

const NATURAL_TERMS = [
  "натуральн",
  "дерево",
  "камень",
  "массив",
  "шпон",
  "лен",
  "лён",
  "шерсть",
];

function normalize(value: unknown) {
  return typeof value === "string" ? value.toLowerCase().replace(/ё/g, "е") : "";
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function hasExplicitArtificialMaterialRequest(value: unknown) {
  return hasAny(normalize(value), EXPLICIT_ARTIFICIAL_TERMS);
}

export function mentionsPracticalAnalog(value: unknown) {
  return hasAny(normalize(value), PRACTICAL_ANALOG_TERMS);
}

export function mentionsNaturalMaterial(value: unknown) {
  return hasAny(normalize(value), NATURAL_TERMS);
}

export function normalizeMaterialConflictIssue<T extends {
  type?: string;
  title?: string;
  evidence?: string;
  impact?: string;
  suggestion?: string;
}>(issue: T): T {
  const combined = [issue.title, issue.evidence, issue.impact, issue.suggestion].map(normalize).join(" ");
  const discussesArtificial = hasAny(combined, ["искусствен", "ненатурал", "синтетич"]);
  if (!discussesArtificial) return issue;

  const evidence = issue.evidence || "";
  if (hasExplicitArtificialMaterialRequest(evidence)) return issue;

  return {
    ...issue,
    title: "Практичный аналог материалов требует согласования",
    evidence: evidence
      ? `Источник/цитата: «${evidence.replace(/^«|»$/g, "")}»`
      : "Источник: AI сформулировал риск без цитаты клиента; требуется ручная проверка дизайнером.",
    impact:
      "Нельзя записывать искусственные или ненатуральные материалы как желание клиента без прямого источника.",
    suggestion:
      "Если нужен более стойкий аналог натурального материала, оформить это как предложение дизайнера: практичный аналог или имитация натуральной фактуры, подлежит согласованию.",
  };
}
