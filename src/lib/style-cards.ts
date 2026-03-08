export const STYLE_CARDS = [
  { key: "scandinavian", label: "Скандинавский", query: "scandinavian interior design living room" },
  { key: "minimalism", label: "Минимализм", query: "minimalist interior design white" },
  { key: "classic", label: "Классика", query: "classic elegant interior design" },
  { key: "loft", label: "Лофт", query: "loft industrial interior design" },
  { key: "japandi", label: "Japandi", query: "japandi interior design wood" },
  { key: "eclectic", label: "Эклектика", query: "eclectic colorful interior design" },
] as const;

export const COLOR_CARDS = [
  { key: "warm_neutral", label: "Тёплый нейтральный", query: "warm neutral beige interior" },
  { key: "cool_neutral", label: "Холодный нейтральный", query: "cool grey neutral interior" },
  { key: "dark", label: "Тёмный", query: "dark moody interior design" },
  { key: "bright_accent", label: "Яркие акценты", query: "colorful accent interior design" },
] as const;

export const MATERIAL_CARDS = [
  { key: "wood", label: "Дерево", query: "wood texture interior" },
  { key: "stone", label: "Камень", query: "stone marble interior" },
  { key: "gloss", label: "Глянец", query: "glossy lacquer interior" },
  { key: "metal", label: "Металл", query: "metal brass interior design" },
  { key: "textile", label: "Текстиль", query: "fabric textile cozy interior" },
  { key: "concrete", label: "Бетон", query: "concrete loft interior" },
] as const;

// For dislikes block — union of styles + colors
export const DISLIKE_CARDS = [...STYLE_CARDS, ...COLOR_CARDS];

export type StyleCardDef = { key: string; label: string; query: string };
