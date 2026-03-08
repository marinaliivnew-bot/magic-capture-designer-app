export const STYLE_CARDS = [
  { key: "scandinavian", label: "Скандинавский", query: "scandinavian interior design living room", description: "Светлое дерево, белые стены, уют и функциональность" },
  { key: "minimalism", label: "Минимализм", query: "minimalist interior design white", description: "Чистые линии, ничего лишнего, воздух и свет" },
  { key: "classic", label: "Классика", query: "classic interior design molding symmetry elegant room", description: "Симметрия, молдинги, благородные ткани и тёплые тона" },
  { key: "loft", label: "Лофт", query: "loft industrial interior design", description: "Кирпич, металл, открытое пространство, индустриальный дух" },
  { key: "japandi", label: "Japandi", query: "japandi interior design wood", description: "Японский минимализм + скандинавский уют, природные текстуры" },
  { key: "eclectic", label: "Эклектика", query: "eclectic colorful interior design", description: "Микс эпох и стилей, смелые сочетания, характер" },
  { key: "provence", label: "Прованс", query: "provence french country interior design", description: "Мягкие фактуры, льняные ткани, выцветшие оттенки" },
  { key: "organic", label: "Органик / Биофилия", query: "organic biophilic interior natural materials", description: "Живые растения, необработанное дерево, натуральный камень" },
  { key: "mediterranean", label: "Средиземноморский", query: "mediterranean interior white blue terracotta", description: "Терракота, арки, белые стены, тёплый свет" },
  { key: "art_deco", label: "Арт-деко", query: "art deco interior gold geometric luxury", description: "Геометрия, золото, бархат, роскошь деталей" },
  { key: "wabi_sabi", label: "Ваби-саби", query: "wabi sabi interior design clay pottery handmade texture room", description: "Несовершенство как красота, глина, грубые фактуры" },
  { key: "contemporary", label: "Контемпорари", query: "contemporary interior design neutral warm 2024", description: "Актуальный нейтральный, без привязки к стилю" },
] as const;

export const COLOR_CARDS = [
  { key: "warm_neutral", label: "Тёплый нейтральный", query: "warm neutral beige interior", description: "" },
  { key: "cool_neutral", label: "Холодный нейтральный", query: "cool grey minimalist interior concrete white", description: "" },
  { key: "dark", label: "Тёмный", query: "dark moody interior black walls bedroom", description: "" },
  { key: "bright_accent", label: "Яркие акценты", query: "colorful accent interior design", description: "" },
  { key: "earthy_olive", label: "Землянистый / Оливковый", query: "earthy green olive interior design living room", description: "Мох и зелень, терракота, тёплые земляные оттенки" },
  { key: "dusty_rose", label: "Розовый / Пудровый", query: "dusty rose blush pink interior bedroom soft", description: "Мягкий розовый, приглушённый, без кричащих цветов" },
  { key: "graphic_bw", label: "Графитный / Чёрно-белый", query: "black white graphic interior bold contrast", description: "Максимальный контраст, без цвета" },
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
