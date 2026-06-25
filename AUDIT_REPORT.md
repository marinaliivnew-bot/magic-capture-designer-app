# AUDIT_REPORT.md — Аудит кода Magic Capture

**Дата:** 2026-06-11
**Скоуп:** `supabase/functions/*`, `supabase/migrations/*`, `src/lib/*`, `src/pages/*`, `src/integrations/supabase/*`
**Характер:** только аудит. Код не изменялся. Это карта проблем для последующих точечных задач.

> Контекст из ТЗ: парсер `extractBetween`/regex в edge-функциях уже признан хрупким (замена на structured JSON запланирована). В отчёте это не дублируется как отдельная находка, но смежные regex-проблемы (`budget-calculator`, `parse-rooms`) отмечены.

---

## Сводка

| Уровень | Кол-во | Суть |
|---------|--------|------|
| 🔴 Критические | 4 | Сломанный контроль доступа в БД и Storage; секреты в клиентском бандле; AI-функции без авторизации (финансовый DoS) |
| 🟠 Высокие | 5 | Публичный доступ к черновикам с PII; проглатывание ошибок сети/AI; неатомарные delete-then-insert; гигиена ключей |
| 🟡 Средние | 7 | Мёртвая логика дедупликации; расхождение провайдера AI (OpenAI vs Anthropic); тихая потеря картинок; N+1; контракт 200-на-ошибку |
| 🟢 Низкие | 5 | Хрупкий кэш изображений, brittle-regex бюджета, `dangerouslySetInnerHTML`, CORS `*`, мелочи |

**Главный вывод:** приложение позиционируется как «защищённое по сессии» (миграция `20260324120000_security_hardening_rls.sql`), но защита **частичная**. Таблица `designer_profile` и три Storage-бакета остались на политиках `USING(true)` времён MVP. Плюс AI-функции вызываемы кем угодно с публичным anon-ключом без rate-limit. В совокупности это значит: конфиденциальные данные дизайнера и загруженные портфолио читаются и **удаляются** анонимно, а на счёт OpenAI можно «накрутить» расход извне.

---

## 🔴 Критические

### C-1. `designer_profile`: политика `USING(true)` — полный анонимный доступ ко всем профилям

**Файл:** `supabase/migrations/20250408_add_designer_profile.sql:20-26`
Миграция безопасности `20260324120000_security_hardening_rls.sql` пересоздала политики для `projects/briefs/issues/questions/board_*/rooms`, но **не тронула `designer_profile`**.

```sql
CREATE POLICY "Allow all operations on designer_profile"
  ON designer_profile FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
```

**Почему опасно:** любой анонимный пользователь с публичным anon-ключом может `SELECT/UPDATE/DELETE` **все** строки `designer_profile` — включая `custom_ergonomics_text`, `ai_analysis`, `hard_constraints` (это интеллектуальная собственность дизайнера и приватные стандарты). Можно прочитать чужой профиль, подменить или удалить. Это classic Broken Access Control (OWASP A01).

**Как исправить:** привязать политики к `request_session_id()` так же, как для `projects`.

```sql
DROP POLICY IF EXISTS "Allow all operations on designer_profile" ON public.designer_profile;

CREATE POLICY "session_select_designer_profile" ON public.designer_profile
  FOR SELECT TO anon, authenticated
  USING (session_id = public.request_session_id());

CREATE POLICY "session_insert_designer_profile" ON public.designer_profile
  FOR INSERT TO anon, authenticated
  WITH CHECK (session_id = public.request_session_id());

CREATE POLICY "session_update_designer_profile" ON public.designer_profile
  FOR UPDATE TO anon, authenticated
  USING (session_id = public.request_session_id())
  WITH CHECK (session_id = public.request_session_id());

CREATE POLICY "session_delete_designer_profile" ON public.designer_profile
  FOR DELETE TO anon, authenticated
  USING (session_id = public.request_session_id());
```

---

### C-2. Storage-бакеты `designer-portfolio` и `plan-uploads`: анонимное чтение и удаление любых файлов

**Файлы:**
- `supabase/migrations/20250408_add_designer_portfolio_bucket.sql:10-28`
- `supabase/migrations/20260308171210_3eaed9be-27ed-4087-ae9d-18a2a077fef1.sql:27-29`

```sql
-- designer-portfolio
CREATE POLICY "Allow reads from designer-portfolio"  ... USING (bucket_id = 'designer-portfolio');
CREATE POLICY "Allow deletes from designer-portfolio" ... USING (bucket_id = 'designer-portfolio');
-- plan-uploads
CREATE POLICY "Anyone can view plans"   ON storage.objects FOR SELECT USING (bucket_id = 'plan-uploads');
CREATE POLICY "Anyone can delete plans" ON storage.objects FOR DELETE USING (bucket_id = 'plan-uploads');
```

**Почему опасно:**
1. Бакеты помечены `public = true` + SELECT-политика без скоупа → **любой** может перечислить и скачать чужие загруженные портфолио (PDF/DOCX со стандартами дизайнера) и планы помещений клиентов.
2. DELETE-политика `USING (bucket_id = ...)` без проверки владельца → **любой анонимный пользователь может удалить любой файл** в этих бакетах. Это деструктивный вандализм одним запросом.

**Как исправить:** хранить файлы под префиксом `"<session_id>/<file>"` (фронтенд уже грузит в подпапки — нужно это закрепить политикой) и скоупить доступ по первому сегменту пути. Бакеты сделать приватными, отдавать через signed URL.

```sql
DROP POLICY IF EXISTS "Allow reads from designer-portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Allow deletes from designer-portfolio" ON storage.objects;

CREATE POLICY "session_read_portfolio" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'designer-portfolio'
    AND (storage.foldername(name))[1] = public.request_session_id()
  );

CREATE POLICY "session_delete_portfolio" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (
    bucket_id = 'designer-portfolio'
    AND (storage.foldername(name))[1] = public.request_session_id()
  );
-- аналогично для INSERT и для бакета plan-uploads
```
(Серверное чтение в `extract-text`/`analyze-profile` идёт через service-role и политиками не ограничивается — продолжит работать.)

---

### C-3. AI edge-функции без авторизации и rate-limit → неконтролируемый расход на OpenAI (финансовый DoS)

**Файлы:** `supabase/functions/{analyze-brief,generate-board,generate-furniture-plan,analyze-plan,apply-answers,analyze-client-taste,resolve-style,parse-rooms,analyze-profile}/index.ts` — все.

**Проблема:** каждая функция:
- отдаёт `Access-Control-Allow-Origin: *`;
- не проверяет ни принадлежность `projectId`/`session_id` вызывающему, ни лимиты;
- вызывается публичным anon-ключом, который **по определению лежит в клиентском бандле** (`src/lib/api.ts:309` и т.д.).

**Почему опасно:** любой человек, вытащив anon-ключ из бандла (тривиально), может в цикле дёргать `generate-board`/`analyze-brief`, каждый вызов — это запрос к `gpt-4o` (`generate-board` ещё и `max_tokens: 16000` в `analyze-profile`). Прямой путь к исчерпанию бюджета OpenAI и к недоступности сервиса. Подтверждения личности нет нигде.

**Как исправить (минимум):**
- Проверять Supabase JWT в функции (`verify_jwt`) либо собственный токен; как минимум валидировать, что `session_id` из заголовка владеет переданным `projectId` (запрос с service-role к `projects`).
- Ввести rate-limit по `session_id`/IP (таблица-счётчик или Upstash/Redis).
- Сузить CORS до домена прод-фронта.

```ts
// псевдокод проверки владения в начале функции
const sessionId = req.headers.get("x-session-id");
const { data: proj } = await supabaseService
  .from("projects").select("id").eq("id", projectId).eq("session_id", sessionId).maybeSingle();
if (!proj) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers });
```

---

### C-4. Anthropic API-ключ вызывается напрямую из браузера

**Файл:** `src/pages/FurniturePlanPage.tsx:315-327`

```ts
const resp = await fetch("https://api.anthropic.com/v1/messages", {
  headers: { "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
  body: JSON.stringify({ model: "claude-sonnet-4-5", ... }),
});
```

**Почему опасно:**
- Любая `VITE_*`-переменная, на которую есть статическая ссылка, **инлайнится Vite в публичный JS-бандл**. Если `VITE_ANTHROPIC_KEY` задан в окружении сборки (Cloudflare Pages), секретный ключ Anthropic становится доступен каждому посетителю → кража ключа, расход на чужой счёт.
- Сейчас ключа нет в `.env` → на проде вызов уходит с `x-api-key: undefined` и молча падает в `catch` (фича «AI-оценка бюджета» нерабочая). То есть это одновременно и дыра, и баг.
- Браузерный CORS Anthropic в принципе не предполагает прямой вызов из фронта без `anthropic-dangerous-direct-browser-access`.

**Как исправить:** перенести вызов в edge-функцию (по образцу остальных), ключ держать только в секретах Supabase. Из фронта дёргать `/functions/v1/<estimate-fn>` с anon-ключом (плюс проверка владения из C-3).

---

## 🟠 Высокие

### H-1. `VITE_UNSPLASH_KEY` попадает в клиентский бандл

**Файл:** `src/pages/StyleNarrowingPage.tsx:118-133`, ключ в `.env:4`.

```ts
const unsplashKey = import.meta.env.VITE_UNSPLASH_KEY;
const response = await fetch(`https://api.unsplash.com/search/photos?...`, {
  headers: { Authorization: `Client-ID ${unsplashKey}` },
});
```

Ключ Unsplash инлайнится в бандл и публично доступен → исчерпание квоты/нарушение ToS чужими руками. При этом **серверный путь уже существует** (`supabase/functions/fetch-style-images/index.ts` берёт `UNSPLASH_ACCESS_KEY` из `Deno.env`). То есть этот прямой вызов из браузера — регресс относительно правильной архитектуры.

**Как исправить:** маршрутизировать запросы `StyleNarrowingPage` через `fetch-style-images` (или новый thin-эндпоинт), убрать `VITE_UNSPLASH_KEY` из фронта, **ротировать** уже «засвеченный» ключ.

---

### H-2. `get-public-project` отдаёт ЛЮБОЙ проект по UUID без флага публикации

**Файл:** `supabase/functions/get-public-project/index.ts:35-58`

Функция тянет проект+бриф+блоки через service-role по одному `projectId`, без проверки «проект опубликован/расшарен». `PublicProjectPage` лишь отображает `approval_status`, но сервер отдаёт и черновики.

**Почему опасно:** бриф содержит PII клиента — `users_of_space` (состав семьи/образ жизни), `budget`, `timeline`. Любой, кто узнал/перебрал UUID, читает приватные данные клиента до согласования. UUID не является секретом авторизации.

**Как исправить:** отдавать проект только если он явно опубликован (например `constraints->>'approval_status' IN ('locked','approved')` или отдельный `is_public`/`public_token`). Лучше — отдельный неугадываемый `public_token`, а не сам `id`.

```ts
if (!["locked", "approved"].includes(projectRes.data.constraints?.approval_status)) {
  return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
```

---

### H-3. Edge-функции не проверяют `response.ok` перед `response.json()` → тихая потеря ошибок

**Файлы:**
- `supabase/functions/parse-rooms/index.ts:48-55` — сразу `await response.json()`; при 429/500 `data.choices` отсутствует → `rooms = []`, клиент думает «комнат нет».
- `supabase/functions/generate-furniture-plan/index.ts:117-130` — то же: при ошибке OpenAI `content = "{}"` → пустой план без сигнала об ошибке.

(Для сравнения, `apply-answers`/`analyze-brief`/`analyze-plan` проверку `response.ok` имеют — поведение несогласованное.)

**Почему опасно:** сетевые/квотные ошибки маскируются под «пустой результат». Пользователь видит молчаливый сбой, отладка затруднена.

**Как исправить:** добавить единообразный блок перед парсингом:

```ts
if (!response.ok) {
  const errText = await response.text();
  console.error("OpenAI error:", response.status, errText);
  return new Response(JSON.stringify({ error: `AI error: ${response.status}` }),
    { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

---

### H-4. Неатомарные delete-then-insert и гонка в `upsertBrief`

**Файл:** `src/lib/api.ts`
- `saveIssues` (154-161), `saveQuestions` (180-187), `saveBoardBlocks` (227-244): сначала `DELETE`, затем серия `INSERT`. Без транзакции: если `INSERT` упадёт после `DELETE`, данные потеряны безвозвратно.
- `upsertBrief` (120-133): `getBrief` → ветвление insert/update. Два параллельных вызова оба увидят «нет записи» и сделают двойной `INSERT` (если на `briefs.project_id` нет `UNIQUE`).

**Почему опасно:** потеря пользовательских данных и дубликаты при параллельных автосохранениях/двойных кликах.

**Как исправить:**
- Перенести «удалить+вставить» в RPC/Postgres-функцию (транзакция) либо использовать `upsert` с `onConflict`.
- На `briefs.project_id` добавить `UNIQUE` и заменить ручное ветвление на `.upsert(..., { onConflict: "project_id" })` (как уже сделано в `upsertDesignerProfile`).

---

### H-5. Гигиена секретов в `.env`

**Файл:** `.env`
- Лежит реальный `VITE_OPENAI_KEY=sk-proj-...`. Префикс `VITE_` — «заряженное ружьё»: достаточно одной статической ссылки `import.meta.env.VITE_OPENAI_KEY` в `src/*`, и ключ OpenAI уедет в бандл. Сейчас ссылок нет (проверено grep), но имя провоцирует регресс. Edge-функции читают его как серверный `Deno.env.get("VITE_OPENAI_KEY")` — путаница имён.
- `.gitignore:25-26` содержит дублирующую строку `.env` (косметика).
- `.env` в гит **не** закоммичен (проверено `git ls-files`) — это хорошо.

**Как исправить:** переименовать серверный ключ в `OPENAI_API_KEY` (без `VITE_`), хранить только в секретах Supabase; в локальном `.env` фронта оставить лишь `VITE_SUPABASE_*`. Ротировать уже засвеченный Unsplash-ключ (см. H-1). Убрать дубль в `.gitignore`.

---

## 🟡 Средние

### M-1. Мёртвая логика дедупликации в `analyze-brief`

**Файл:** `supabase/functions/analyze-brief/index.ts:66-69`

```ts
const knownFacts = [
  briefText.includes('users') ? `Пользователи: уже описаны в брифе` : null,
  ...
];
```
`briefText` — русский текст, а проверяется английский литерал `'users'`. Условие почти всегда `false`, блок «УЖЕ ИЗВЕСТНО» всегда «Нет данных». Системный промпт (ШАГ 1) опирается на этот блок, чтобы не задавать повторных вопросов — то есть ключевая анти-дублирующая логика не работает.

**Как исправить:** формировать `knownFacts` из реальных полей брифа (`users_of_space`, `scenarios`, `style_likes`, …), а не из подстроки. Передавать в функцию структурированный бриф, а не только склеенный текст.

---

### M-2. Расхождение провайдера AI: документация ≠ код

**Файлы:** `CLAUDE.md` (стек: «Anthropic API (Claude Sonnet)»), но `supabase/functions/*` — все на `https://api.openai.com` / `gpt-4o`; `FurniturePlanPage.tsx:315` — на Anthropic.

**Почему важно:** два провайдера, рассинхрон с документацией, разные форматы ответов и обработки ошибок. Усложняет сопровождение и оценку стоимости. Решить стратегически: один провайдер, единый клиент-обёртка в edge-функциях.

---

### M-3. `generateBoard` молча теряет изображения

**Файл:** `src/lib/api.ts:365-408`

`try/catch` вокруг `fetch-style-images` логирует ошибку в консоль и продолжает с пустым `imageMap`. Блоки сохраняются с `url: ""`. Пользователь получает борд без картинок и без какого-либо уведомления.

**Как исправить:** прокинуть статус деградации в результат (`imagesFailed: true`) и показать toast/баннер «изображения подгрузить не удалось, можно повторить».

---

### M-4. N+1 при сохранении блоков борда

**Файл:** `src/lib/api.ts:229-244`

Цикл по блокам: на каждый блок — отдельный `INSERT ... .select().single()`, затем отдельный `INSERT` картинок. Для 5 блоков это ~10 round-trip к БД. Плюс это и есть неатомарность из H-4.

**Как исправить:** один батч-`INSERT` блоков с `.select()`, затем один батч-`INSERT` всех картинок с маппингом по возвращённым id. Идеально — обернуть в RPC-транзакцию.

---

### M-5. Контракт «HTTP 200 на ошибке» в `analyze-profile`

**Файл:** `supabase/functions/analyze-profile/index.ts:25-27,131,183,197`

Намеренно отдаёт `status: 200` с `{ error }` в теле (комментарий «чтобы тело не съел Supabase client»). Это хрупкий контракт: любой `resp.ok`-чек выше по стеку посчитает ответ успешным. Клиент **обязан** инспектировать `body.error` (`DesignerProfilePage.tsx:536` это делает, но легко забыть в новом коде).

**Как исправить:** при прямом `fetch` (а не `supabase.functions.invoke`) можно вернуть корректные коды (4xx/5xx) и читать тело обычным образом. Если оставляете 200 — задокументировать контракт и обрабатывать `body.error` централизованно.

---

### M-6. Отсутствие валидации размера/формы входных данных edge-функций

**Файлы:** большинство функций (`analyze-brief`, `generate-board`, `apply-answers`, `resolve-style`, …) делают `await req.json()` и сразу используют поля. Лимиты есть только в `extract-text` (30k) и `analyze-profile` (60k).

**Почему важно:** можно прислать мегабайтный `briefText`/`currentBrief` → дорогие токены, рост латентности, вектор abuse (связано с C-3). 

**Как исправить:** общая обёртка-валидатор: проверка наличия обязательных полей, ограничение длины строк, ранний `400` на мусор.

---

### M-7. Клиентский код не скоупит часть запросов по сессии (опирается только на RLS)

**Файл:** `src/lib/api.ts` — `getBrief` (78-86), `getIssues` (137-143), `updateQuestion` (190-199), `updateBoardBlock`, `updateBoardImage` фильтруют только по `project_id`/`id`, без `session_id`.

Сейчас это закрыто RLS (`session_*` политики), поэтому не уязвимость **при условии** корректного RLS. Но это скрытая зависимость: любое ослабление RLS мгновенно открывает данные, а в коде нет второго рубежа. Отметить как тех-долг/защита в глубину. (Связано с C-1: для `designer_profile` RLS как раз сломан.)

---

## 🟢 Низкие

### L-1. Хрупкий кэш в `fetch-style-images`

**Файл:** `supabase/functions/fetch-style-images/index.ts:100-114`
`queryHash` — 32-битный самописный хэш (возможны коллизии разных запросов → один файл). Проверка кэша через `list("", { search: fileName })` + `fileList[0].name === fileName` опирается на подстрочный `search` и порядок. Лучше: `crypto.subtle.digest('SHA-256', ...)` для имени и точечная проверка существования объекта.

### L-2. Brittle-regex в `budget-calculator`

**Файл:** `src/lib/budget-calculator.ts:37-73`
`parseBudget` ветка «`\d[\d\s]{4,}`» поймает любое длинное число (например, телефон) как бюджет; `parseAreaFromDimensions` «голое число ≥ 4» трактует как м². Периметр считается как `4·√area` (предположение «квадратная комната») — для вытянутых помещений заметная погрешность. Не критично (оценочный инструмент), но стоит ужесточить и покрыть тестами. Та же категория, что известный `extractBetween`.

### L-3. `dangerouslySetInnerHTML` в графиках

**Файл:** `src/components/ui/chart.tsx:70` — инъекция CSS из конфигурации цветов. Данные задаются разработчиком (не пользователем), риск XSS низкий. Держать под контролем: не прокидывать в `chart config` пользовательский ввод.

### L-4. CORS `Access-Control-Allow-Origin: *` во всех функциях

Открытый CORS усиливает C-3/H-1 (вызов с любого origin). После введения авторизации сузить до домена прод-фронта.

### L-5. Мелочи
- `.gitignore:25-26` — дублирующаяся строка `.env`.
- `budget-calculator.ts:33` — `ROOM_HEIGHT_M = 2.8` захардкожена, игнорирует реальную высоту из брифа.
- `generate-furniture-plan`/`parse-rooms` — повторяющийся boilerplate (CORS, чтение ключа, парсинг) дублируется в 9 функциях; напрашивается общий модуль `_shared/`.

---

## Рекомендованный порядок устранения

1. **C-1, C-2** — миграции RLS/Storage (быстро, закрывают зияющие дыры доступа к данным).
2. **C-4, H-1** — убрать секреты из фронта, ротировать ключи.
3. **C-3, H-2** — авторизация/owner-check + rate-limit на edge-функциях; флаг публикации для public-проекта.
4. **H-3, H-4** — обработка ошибок и атомарность записи.
5. Средние/низкие — по мере касания соответствующих модулей.

> Каждую находку предлагается выносить в отдельную задачу (по правилу проекта «одна задача за сессию»). Исправления в этом отчёте намеренно не применялись.
