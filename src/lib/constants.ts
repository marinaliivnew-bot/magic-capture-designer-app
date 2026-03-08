export const ROOM_TYPES = [
  { value: 'kitchen', label: 'Кухня' },
  { value: 'living', label: 'Гостиная' },
  { value: 'bedroom', label: 'Спальня' },
  { value: 'bathroom', label: 'Санузел' },
  { value: 'office', label: 'Офис' },
  { value: 'other', label: 'Другое' },
] as const;

export const BRIEF_SECTIONS = [
  { key: 'users_of_space', label: 'Пользователи пространства', description: 'Состав семьи, питомцы, гости' },
  { key: 'scenarios', label: 'Сценарии', description: 'Сценарии жизни / работы в помещении' },
  { key: 'zones', label: 'Функциональные зоны', description: 'Зоны помещения' },
  { key: 'storage', label: 'Хранение', description: 'Потребности в хранении' },
  { key: 'style_likes', label: 'Стиль — нравится', description: 'Стилистические предпочтения' },
  { key: 'style_dislikes', label: 'Стиль — не нравится', description: 'Что точно не подходит' },
  { key: 'constraints_practical', label: 'Ограничения', description: 'Бюджет, сроки, табу, уход, износостойкость' },
  { key: 'success_criteria', label: 'Критерии успеха', description: 'Что будет "классно получилось"' },
] as const;

export const BOARD_BLOCK_TYPES = [
  { type: 'atmosphere', label: 'Атмосфера / Вайб' },
  { type: 'palette', label: 'Цветовая палитра' },
  { type: 'materials', label: 'Материалы и текстуры' },
  { type: 'furniture', label: 'Мебель / формы' },
  { type: 'lighting', label: 'Освещение' },
] as const;

export const PRIORITY_CONFIG = {
  critical: { label: 'Критично', color: 'destructive' as const },
  important: { label: 'Важно', color: 'warning' as const },
  optional: { label: 'Опционально', color: 'info' as const },
} as const;
