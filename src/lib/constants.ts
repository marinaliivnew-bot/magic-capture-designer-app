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
  { type: 'atmosphere', label: 'Визуальная атмосфера и эмоция' },
  { type: 'palette', label: 'Палитра стандартов RAL / NCS' },
  { type: 'materials', label: 'Карта материалов и текстур' },
  { type: 'furniture', label: 'Габариты мебели и эргономика' },
  { type: 'lighting', label: 'Освещение' },
] as const;

export const PRIORITY_CONFIG = {
  critical: { label: 'Критично: Влияет на планировку', color: 'destructive' as const },
  important: { label: 'Важно: Влияет на бюджет', color: 'warning' as const },
  optional: { label: 'Опционально: Детализация', color: 'info' as const },
} as const;
