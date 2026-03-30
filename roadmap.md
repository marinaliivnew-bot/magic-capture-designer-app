# Magic Capture — Roadmap

## Rules for Cascade
- Implement ONE task at a time, in order
- After each task, stop and wait for confirmation before proceeding
- Always reference specific files with @filename
- Do not refactor, rename, or restructure anything outside the scope of the current task
- Do not remove any existing functionality unless explicitly instructed
- Do not add TypeScript strict mode, RLS, or CI pipelines
- All new UI text must be in Russian

---

## Task 1 — Remove Style Narrowing step
**Status:** TODO

**What to do:**
Remove the Style Narrowing screen entirely from the user flow. It duplicates the style selection from the previous step and shows the same low-quality images twice.

**Scope:**
- Remove the Style Narrowing screen/component
- Remove its route
- Update navigation so the flow goes directly from Brief → Questions & Contradictions
- Do NOT touch any other screens or components

---

## Task 2 — "Fill from text" button in rooms section
**Status:** TODO

**What to do:**
Add a button «Заполнить из текста» in the rooms section (Секция Б — Список помещений). When clicked, AI reads the text from the raw input field (Секция В) and automatically extracts room names, types, and dimensions, then fills in the rooms list.

**Scope:**
- Check existing Edge Functions before creating a new one — reuse if possible
- The button appears in the rooms section next to or below the manual input
- AI extraction must handle Russian text input
- Extracted rooms must populate the Name, Type, and Dimensions fields
- The Name field must be filled (it is currently required and blocks generation)
- Do NOT change any other part of the form

---

## Task 3 — Curated style image queries + randomization
**Status:** TODO

**What to do:**
Replace generic Unsplash search queries for the style selection screen with curated, specific queries that return representative, attractive interior photos for each style. Add randomization so a random image from the top 10 results is shown (not always the first one).

**Curated queries per style (use these exactly):**
- Минимализм: "minimalist apartment interior white"
- Скандинавский: "scandinavian living room interior"
- Лофт: "loft apartment industrial interior"
- Современный: "modern apartment interior design"
- Классика: "classic elegant interior living room"
- Прованс: "french country interior provence"
- Ар-деко: "art deco apartment interior 2020"
- Контемпорари: "contemporary interior design apartment"
- Эклектика: "eclectic interior design colorful"
- Japandi: "japandi interior minimal wood"

**Scope:**
- Find where style image queries are currently defined and replace them with the curated list above
- Change image selection from result[0] to a random pick from results[0..9]
- Do NOT change concept board image logic — only style selection screen

---

## Task 4 — Pass floor plan data into concept board prompt
**Status:** TODO

**What to do:**
The floor plan (rooms list with names, types, dimensions) is currently uploaded but not used in the concept board generation. Pass this data into the generate-board Edge Function prompt so the board is structured by room.

**Scope:**
- Modify the generate-board Edge Function prompt to include room data
- The board should generate blocks per room (e.g. "Мастер-спальня 19.5м²", "Кабинет") instead of generic categories
- Each room block should include: atmosphere, materials, lighting suggestions
- Update the frontend to display room-based blocks
- Do NOT change how images are fetched

---

## Task 5 — Concept board prompt with design interpretation
**Status:** TODO

**What to do:**
The current concept board prompt causes the AI to simply echo back what the user typed. Update the prompt in generate-board Edge Function so the AI adds design interpretation — suggests complementary elements, makes connections between references, and proposes solutions the user didn't explicitly mention.

**Scope:**
- Edit only the system prompt inside the generate-board Edge Function
- Add instruction to: interpret references rather than describe them, suggest what the user might not have thought of, explain WHY each element fits the brief
- Do NOT change the JSON response schema — keep the same structure

---

## Task 6 — Expand brief form + reference annotation
**Status:** TODO

**What to do:**
Add three new sections to the brief input form and add a "what appeals to you" field for each reference image.

**New form sections (add after existing fields):**
- Освещение (lighting): естественный свет, рабочее освещение, атмосферное освещение
- Цвет (extended): preferred color temperature, accent colors, colors to avoid
- Текстуры и фактуры: preferred tactile and visual textures

**Reference annotation:**
- After each reference image upload, show a text field: «Что именно здесь привлекает? (цвет, материал, пропорции, свет, атмосфера)»
- Pass this annotation explicitly into the concept board prompt

**Scope:**
- Add new fields to the input form and brief sections
- Add annotation field to reference image upload component
- Pass all new data into the analyze-brief and generate-board Edge Function prompts
- All labels in Russian

---

## Task 7 — UI animations and micro-interactions
**Status:** TODO

**What to do:**
Make the interface feel more alive with micro-animations, loading states, and tooltips.

**Specific changes:**

Micro-animations:
- Buttons: smooth color transition + slight scale on hover and click (transform: scale(0.97))
- Cards: fade-in + slide-up on appear (stagger effect — each card slightly delayed)
- Progress bar (Brief Completeness Score): animated fill, not instant jump

Loading states:
- Replace empty screens during AI generation with skeleton loaders (pulsing placeholder blocks)
- Generate button changes to «Генерирую...» with animated dots while AI is working
- Disable the button during generation to prevent double-clicks

Feedback:
- Toast notifications: on save, on successful generation, on error (with retry option)
- Successful field fill: brief green highlight flash on the field

Tooltips:
- Add a «?» icon on each brief form field with a short hint explaining why this info matters
- Add tooltip on action buttons explaining what will happen on click

**Scope:**
- Use Tailwind CSS utilities and CSS transitions — do not add new animation libraries unless necessary
- Toast notifications: use an existing library already in the project, or add react-hot-toast if none exists
- All tooltip text in Russian
