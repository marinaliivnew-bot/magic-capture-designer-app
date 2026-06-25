# CLAUDE.md — Инструкция для Claude Code

> Этот файл загружается автоматически в каждый чат. Держи его коротким.

## Проект

**Magic Capture** — AI-инструмент для дизайнеров интерьера: сырой ввод клиента → структурированный бриф → concept board → PDF для согласования.

## Стек

React + Tailwind · Supabase (PostgreSQL + Edge Functions) · Anthropic API (Claude Sonnet) · Unsplash API · Cloudflare Pages

## Контекстные файлы (в корне проекта)

| Файл | Содержит |
|------|----------|
| `PROJECT_CONTEXT.md` | Полная спецификация: модули, модель данных, workflow, язык интерфейса |
| `ROADMAP_v3.md` | Что сделано ✅ + что дальше (блоки 5–6) |
| `ADR.md` | Лог архитектурных решений — почему выбрали X, а не Y |

**Перед задачей:** прочитай `PROJECT_CONTEXT.md` и `ROADMAP_v3.md`.

## Структура проекта

```
src/
  pages/          — экраны (NewProject, BriefPage, StyleNarrowingPage, ConceptBoard, DesignerProfilePage)
  components/     — UI-компоненты (ColorChip, ConflictDetector, BudgetCalculator и др.)
  lib/            — утилиты (style-cards.ts, ergonomics, budget)
supabase/
  functions/      — Edge Functions (analyze-brief, generate-board, analyze-profile)
.claude/
  skills/         — скиллы (frontend-design, interior-ergonomics, canvas-design, skill-creator)
```

## Правила

1. **Одна задача за сессию.** Формулируй конкретно, ссылаясь на файлы.
2. **Язык интерфейса и AI-ответов:** русский.
3. **Supabase Edge Functions:** деплой через `npx supabase functions deploy <name> --project-ref iyqfstkhpsalqxzhousy`.
4. **Env-переменные:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (не PUBLISHABLE_KEY), `VITE_ANTHROPIC_KEY`, `VITE_UNSPLASH_KEY`.
5. **Supabase policies:** всегда `DROP POLICY IF EXISTS` перед `CREATE POLICY`.
6. **Не трогай StyleNarrowingPage**, если задача касается BriefPage — это разные экраны.
7. После выполнения задачи — ставь ✅ в `ROADMAP_v3.md`.
8. После каждого раунда изменений:
   - ✅ Проверить типы (types.ts)
   - ✅ Задеплоить Edge Functions
   - ✅ Применить миграции
   - ✅ Протестировать flow от начала до конца

## Пример стартовой фразы

```
Прочитай PROJECT_CONTEXT.md и ROADMAP_v3.md — это контекст проекта.
Сегодня делаем: [задача 5.1 — Профиль дизайнера].
```

---

## Текущее состояние (обновляй перед каждой сессией)

**Активный блок:** Block 5 — Personalization  
**Последнее изменение:** _[дата] — [что сделали]_  
**Известные проблемы:** _[перечисли или напиши "нет"]_  
**Следующая задача:** _[одна фраза]_

---

## Инструкция для Codex (code review)

Ты — независимый ревьюер. Claude Code уже написал код. Твоя задача:

1. Найди логические ошибки и баги — не переписывай, только указывай.
2. Проверь edge cases: пустой ввод, null, сетевые ошибки.
3. Найди дублирование кода между файлами.
4. Проверь, что промпты к Anthropic API возвращают ожидаемый формат.
5. Отвечай списком: файл → строка → проблема → почему это баг.

Не предлагай архитектурные изменения. Не переписывай. Только находи.