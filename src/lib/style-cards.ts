export const STYLE_CARDS = [
  { key: "scandinavian", label: "Скандинавский", query: "scandinavian living room interior apartment cozy", description: "Светлое дерево, белые стены, уют и функциональность" },
  { key: "minimalism", label: "Минимализм", query: "minimalist apartment living room interior clean", description: "Чистые линии, ничего лишнего, воздух и свет" },
  { key: "classic", label: "Классика", query: "classic elegant living room interior molding", description: "Симметрия, молдинги, благородные ткани и тёплые тона" },
  { key: "loft", label: "Лофт", query: "loft apartment living room industrial brick", description: "Кирпич, металл, открытое пространство, индустриальный дух" },
  { key: "japandi", label: "Japandi", query: "japandi living room interior wood neutral calm", description: "Японский минимализм + скандинавский уют, природные текстуры" },
  { key: "eclectic", label: "Эклектика", query: "eclectic living room interior colorful furniture", description: "Микс эпох и стилей, смелые сочетания, характер" },
  { key: "provence", label: "Прованс", query: "french country living room interior soft linen", description: "Мягкие фактуры, льняные ткани, выцветшие оттенки" },
  { key: "organic", label: "Органик / Биофилия", query: "biophilic living room interior plants natural wood", description: "Живые растения, необработанное дерево, натуральный камень" },
  { key: "mediterranean", label: "Средиземноморский", query: "mediterranean living room interior arches warm", description: "Терракота, арки, белые стены, тёплый свет" },
  { key: "art_deco", label: "Арт-деко", query: "art deco bedroom interior velvet geometric", description: "Геометрия, золото, бархат, роскошь деталей" },
  { key: "wabi_sabi", label: "Ваби-саби", query: "wabi sabi living room interior clay texture minimal", description: "Несовершенство как красота, глина, грубые фактуры" },
  { key: "contemporary", label: "Контемпорари", query: "contemporary living room interior design neutral 2024", description: "Актуальный нейтральный, без привязки к стилю" },
] as const;

export const COLOR_CARDS = [
  { key: "warm_neutral", label: "Тёплый нейтральный", query: "warm beige living room interior cozy neutral", description: "" },
  { key: "cool_neutral", label: "Холодный нейтральный", query: "cool grey living room interior concrete minimal", description: "" },
  { key: "dark", label: "Тёмный", query: "dark moody living room interior black walls", description: "" },
  { key: "bright_accent", label: "Яркие акценты", query: "colorful accent living room interior bold", description: "" },
  { key: "earthy_olive", label: "Землянистый / Оливковый", query: "earthy green olive living room interior warm", description: "Мох и зелень, терракота, тёплые земляные оттенки" },
  { key: "dusty_rose", label: "Розовый / Пудровый", query: "dusty rose blush living room interior soft", description: "Мягкий розовый, приглушённый, без кричащих цветов" },
  { key: "graphic_bw", label: "Графитный / Чёрно-белый", query: "black white graphic living room interior bold", description: "Максимальный контраст, без цвета" },
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

export type StyleCardDef = { key: string; label: string; query: string; description?: string };
