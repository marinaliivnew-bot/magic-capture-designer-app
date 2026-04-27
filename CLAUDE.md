# Magic Capture - Designer Brief Tool

## Product Overview

Web app for interior designers to convert unstructured client input (chats, voice notes, references) into a validated, agreed design concept.

Core value:
- Extracts what the client actually wants (not what they say)
- Aligns it with designer's personal style standards
- Validates decisions against ergonomics and constraints
- Forces explicit resolution of contradictions before concept generation

Output is not just a mood board, but a **fixed, agreed design direction** with traceable decisions.

The designer profile acts as a permanent "standards layer" applied to every project.

**Production URL**: https://magic-capture-designer-app.pages.dev  
**Supabase project ref**: `iyqfstkhpsalqxzhousy`  
**GitHub repo**: `marinaliivnew-bot/magic-capture` (branch `main` -> auto-deploys to Cloudflare Pages)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| Routing | React Router v6 |
| Backend / DB | Supabase (PostgreSQL + Storage + Edge Functions) |
| Hosting | Cloudflare Pages (static, SPA routing via `_redirects`) |
| AI | OpenAI GPT-4o - called **only** from Supabase Edge Functions |

---

## Critical Architecture Rules

### 1. NEVER call OpenAI from the browser
`.env` is in `.gitignore` -> `VITE_OPENAI_KEY` is `undefined` in Cloudflare production builds.  
All OpenAI calls go through Supabase Edge Functions which read secrets via `Deno.env.get("VITE_OPENAI_KEY") || Deno.env.get("OPENAI_API_KEY")`.

### 2. Session-based data model
All data is scoped by `session_id` stored in `localStorage` (see `src/lib/session.ts`).  
No auth - the session ID IS the user identity. Never remove the session filter from DB queries.

### 3. Supabase env vars in Edge Functions
Use `Deno.env.get("VITE_OPENAI_KEY")` - the secret is named `VITE_OPENAI_KEY` in Supabase dashboard (not `OPENAI_API_KEY`).  
When creating new edge functions, deploy with:
```
npx supabase functions deploy <name> --project-ref iyqfstkhpsalqxzhousy
```

### 4. Deploying changes
Frontend: commit + push to `main` -> Cloudflare Pages rebuilds automatically (1-2 min).  
Edge functions: deploy manually with the command above after editing.

---

## Project Structure

```
src/
  pages/
    Index.tsx               - project list (home)
    NewProject.tsx          - create project wizard
    EditProject.tsx         - edit project metadata
    BriefPage.tsx           - client brief form
    QuestionsPage.tsx       - AI-generated clarifying questions
    StyleNarrowingPage.tsx  - style selection
    ConceptBoard.tsx        - AI-generated mood board
    ExportPage.tsx          - PDF export
    DesignerProfilePage.tsx - designer style profile (one per session)
    NotFound.tsx
  components/
    ProjectStepNav.tsx      - step navigation bar
    RefUploadCard/Modal     - reference image upload UI
    RoomCard, StyleCard, NavLink, ProjectHeader
  lib/
    api.ts                  - all Supabase DB calls + AI function calls
    session.ts              - localStorage session ID

supabase/
  functions/
    analyze-brief/          - AI brief analysis -> issues + questions
    analyze-client-taste/   - extract structured client taste from refs + text
    generate-board/         - AI concept board generation -> 5 blocks
    analyze-profile/        - AI designer profile analysis -> free text
    apply-answers/          - apply Q&A answers back to brief
    fetch-style-images/     - Unsplash image search (server-side)
    extract-text/           - PDF/image text extraction
    parse-rooms/            - parse room list from text
    analyze-plan/           - analyze floor plan image
```

---

## Database Tables

| Table | Purpose |
|---|---|
| `projects` | Project metadata (name, raw_input, rooms_description, plan_url, constraints) scoped by `session_id` |
| `briefs` | Client brief fields: users_of_space, scenarios, zones, storage, style_likes, style_dislikes, constraints_practical, success_criteria, user_refs, user_refs_structured |
| `issues` | AI-detected contradictions in the brief |
| `questions` | AI-generated clarifying questions (priority: critical/important/optional) |
| `board_blocks` | Concept board blocks (atmosphere/palette/materials/furniture/lighting) |
| `board_images` | Images per board block (url, attribution, note = search query) |
| `designer_profile` | Designer style standards, one row per session_id |

### briefs structured references
- `user_refs_structured` - JSON array of client references with annotations:
```json
[
  {
    "url": "string",
    "liked": true,
    "comment": "string",
    "tags": ["string"]
  }
]
```

Note:
Raw `user_refs` is not sufficient. AI must operate on structured references where each image is interpreted as a preference signal (what exactly is liked/disliked).

### designer_profile columns
- `designer_name` - display name
- `style_description` - free text style description
- `style_refs` - array of URLs (http refs) and storage paths (portfolio uploads)
- `hard_constraints` - JSON key-value constraints (currently unused in UI)
- `ergonomics_rules` - JSON sliders: temperature/strictness/texture/color/style (0-10)
- `custom_ergonomics_text` - free text standards and constraints
- `ai_analysis` - AI-generated analysis text (saved after AI call)
- `ai_questions` - AI follow-up questions array

---

## 3-Layer AI Architecture (core concept)

Every AI decision is computed from three competing layers:

1. **Designer standards** (`designer_profile`) - highest priority
2. **Client preferences** (brief + reference analysis)
3. **Constraints / ergonomics** (hard limits, non-negotiable)

### Conflict resolution logic:

- Constraints override everything
- Designer standards override client preferences
- Client preferences are accepted only within allowed boundaries

AI must not average inputs - it must:
1. Detect conflicts
2. Explain them
3. Propose resolution options

The `formatDesignerProfileForAI()` function in `src/lib/api.ts` formats the designer profile into a text block prepended to every AI prompt as a highest-priority standards section.

Edge functions `analyze-brief`, `analyze-client-taste`, and `generate-board` should all operate with this conflict model rather than simple prompt averaging.

---

## User Journey (target flow)

```
Stage 0: Designer fills profile once (style, constraints, portfolio)
Stage 1: New project input - collect all available raw inputs
         - object metadata
         - floor plan / builder drawings
         - room list and dimensions
         - lifestyle and household info
         - raw notes / chat / transcript
Stage 2: Client brief - style wishes, references, lifestyle
Stage 3: Client interpretation (NEW)
         - AI extracts actual preferences from refs and text
         - Identifies hidden contradictions
         - Outputs "client taste profile"
Stage 4: AI builds 3-layer interpretation (client taste + designer style + ergonomics)
Stage 5: Validation - conflict detection and forced resolution
         - AI generates conflict cards with explanation
         - Each conflict includes:
           - why it is a problem
           - what constraint is violated
           - suggested alternatives
         - Designer must resolve or override
Stage 6: Decision fixation (NEW)
         - Designer explicitly accepts / overrides decisions
         - Each decision is stored and becomes part of the brief
         - No implicit assumptions allowed
Stage 7: Style engine generates 3 directions:
         - Strict (100% designer standards)
         - Compromise (client wishes within designer standards)
         - Experimental (client direction, warning if breaks standards)
Stage 8: Concept board - images, palette, materials, furniture, lighting
Stage 9: PDF export with 3-layer attribution
```

---

## First Input Page Structure

Purpose:
The first page is not a questionnaire. It is a structured intake surface where the designer can quickly dump everything already received from the client or developer and turn it into usable project input.

The page should be organized by **source of information**, not by database field names.

### Section 1 - Object
- `project name`
- optional object type
- optional address / object note

### Section 2 - Plan and rooms

This is the primary block on the page.

It should support three parallel sources for the same spatial information:
- uploaded floor plan / builder drawing / sketch
- manual room list
- text description of rooms and dimensions

#### 2.1 Plan upload
- Accept `JPG`, `PNG`, `PDF`
- Show preview / file state
- Allow AI plan analysis

#### 2.2 Plan analysis result
- Show extracted rooms
- Show extracted dimensions
- Show AI notes
- Actions:
  - `apply to form`
  - `fill rooms from plan`

#### 2.3 Room list
- editable list of rooms
- each row includes:
  - room name
  - room type / purpose
  - dimensions
- user can:
  - accept rooms from plan
  - edit them manually
  - add missing rooms

#### 2.4 Text fallback
- text area for room description when no plan exists
- action:
  - `fill rooms from text`

### Section 3 - Client and lifestyle

This block captures how the space must function.

- who will live / use the space
- lifestyle scenarios
- special routines or household patterns
- what must happen in the space

Examples:
- children
- pets
- guests
- work from home
- frequent cooking
- sports / hobby storage
- privacy needs

### Section 4 - Taste and references

This block captures aesthetic direction.

#### 4.1 Text preferences
- what the client likes
- what the client does not like

#### 4.2 Client references
- upload images / add links
- show mini-preview grid
- references belong to the first input flow and should not be hidden too late in the process

#### 4.3 Reference comment
- one shared text field:
  - what exactly the client likes in these references

This should stay lightweight on the first page. Deep interpretation happens later.

### Section 5 - Constraints and limits

This block is only for practical and technical limits, not taste.

- practical constraints
- budget, if known
- timeline, if known
- technical / builder constraints

Examples:
- cannot move wet zones
- low ceiling
- wear resistance required
- easy maintenance required
- rental restrictions

### Section 6 - Raw notes / chats / transcript

Large freeform field for anything not yet structured.

Accept:
- chat fragments
- meeting notes
- voice note transcript
- builder comments
- unstructured client wishes

### CTA logic

The page should allow non-linear input.
The designer may start from any source:
- only plan
- only transcript
- only references
- only manual room list

The UX message is:
`enter what you already have - the system will structure it later`

Primary CTA:
- `assemble brief`

---

## Improvement Roadmap (in priority order)

### Phase 1 DONE - Designer profile fixes
- Fixed `removeRef` bug (was deleting wrong ref)
- Moved profile AI analysis to edge function (was failing in production)
- Designer profile now passed to `analyze-brief` and `generate-board`

---

### Phase 2 - Client input layer

**2.1 CRITICAL BUGFIX - Fix `user_refs` silently dropped**
- File: `src/lib/api.ts` ~line 100
- Add `user_refs` and `style_narrowing_result` to `ALLOWED_BRIEF_FIELDS`
- Without this fix, all saved reference images are silently discarded on upsert

**2.2 - Restructure first input page**
- Files: `src/pages/NewProject.tsx`, `src/pages/EditProject.tsx`
- Organize the page by input sources:
  - object
  - plan and rooms
  - client and lifestyle
  - taste and references
  - constraints and limits
  - raw notes / chats / transcript
- The page must feel like an intake surface, not a long questionnaire.

**2.3 - Strengthen plan-to-room workflow**
- Files: `src/pages/NewProject.tsx`, `src/pages/EditProject.tsx`
- Plan analysis must support:
  - extracted dimensions
  - extracted room list
  - `fill rooms from plan`
- Plan should be treated as the most reliable source of room dimensions when available.

**2.4 - "Standards applied" badge on project cards**
- File: `src/pages/Index.tsx`
- Load `designer_profile` on mount; if profile is filled - show badge on every project card

**2.5 - Structured client taste extraction**
- Add `user_refs_structured` support so references are stored as interpreted preference signals, not just URLs
- AI should capture what the client responds to inside the references, with annotations and tags

---

### Phase 3 - Agreed Style Screen

New page between QuestionsPage and ConceptBoard showing style intersection.

**3.1 - New page `src/pages/AgreedStylePage.tsx`**
- Route: `/project/:id/agreed-style`
- Shows:
  client extracted taste (from `analyze-client-taste`)
  designer allowed style
  explicit overlap
  rejected elements
- Critical:
  User must see not just conflicts, but what is ACTUALLY agreed.
- Conflict cards explaining mismatch between client desire, designer standards, and constraints

**3.2 - New edge function `supabase/functions/resolve-style/`**
- Input: `style_narrowing_result` + `designer_profile`
- Output: agreed elements + list of conflicts with explanation
- Save result to new field `agreed_style_result` in `briefs` table (new column needed)

**3.3 - New edge function `supabase/functions/analyze-client-taste/`**
- Input:
  raw brief
  `user_refs` / `user_refs_structured`
- Output:
  dominant style signals
  rejected elements
  contradictions
  summary "what client actually wants"

**3.4 - Add step to navigation**
- File: `src/components/ProjectStepNav.tsx`
- Add agreed style step between Questions and Board

---

### Phase 4 - Three Style Directions

**4.1 - Update edge function `supabase/functions/generate-board/`**
- Generate 3 variants: `strict` / `compromise` / `experimental`
- For `experimental`: mark which decisions break designer standards
- Add `direction` field to response

**4.2 - Update `src/pages/ConceptBoard.tsx`**
- Three tabs / switcher for directions
- Warning badge on experimental if it breaks standards
- Load/save board blocks filtered by `direction`
- Each block must include attribution:
  `client-driven`
  `designer-driven`
  `constraint-driven`
- This must be visible in UI, not only in export.

**4.3 - DB schema: add `direction` column to `board_blocks` table**
- Values: `strict | compromise | experimental | null` (null = legacy single board)

---

### Phase 5 - PDF with 3-layer attribution

**5.1 - Update `src/pages/ExportPage.tsx`**
- Each board decision labeled as client-driven / designer-driven / constraint-driven
- Add "Conflicts and how they were resolved" section

**5.2 - Add `attribution` field to `board_blocks`**
- AI returns attribution per block when generating
- Save as JSON: `{ source: "client" | "designer" | "constraint", reason: string }`

---

### Known bugs to fix before starting each phase
- **Phase 2**: `ALLOWED_BRIEF_FIELDS` missing `user_refs` + `style_narrowing_result` (task 2.1)
- **Phase 3**: Need new DB column `agreed_style_result` in `briefs` table
- **Phase 4**: Need new DB column `direction` in `board_blocks` table
- **Phase 5**: Need new DB column `attribution` in `board_blocks` table

---

## Key Files to Know

- [src/lib/api.ts](src/lib/api.ts) - central API layer, `formatDesignerProfileForAI`, `analyzeBrief`, `generateBoard`
- [src/pages/DesignerProfilePage.tsx](src/pages/DesignerProfilePage.tsx) - designer profile form + AI analysis
- [supabase/functions/analyze-brief/index.ts](supabase/functions/analyze-brief/index.ts) - brief analysis edge function
- [supabase/functions/analyze-client-taste/index.ts](supabase/functions/analyze-client-taste/index.ts) - client taste extraction edge function
- [supabase/functions/generate-board/index.ts](supabase/functions/generate-board/index.ts) - board generation edge function
- [supabase/functions/analyze-profile/index.ts](supabase/functions/analyze-profile/index.ts) - profile analysis edge function

---

## Core Product Principle

The system does not generate design.

It:
- reduces ambiguity
- exposes contradictions
- forces explicit decisions

Every output must be explainable:
"why this decision was made and what influenced it"

---

## Common Commands

```bash
# Deploy a specific edge function
npx supabase functions deploy <function-name> --project-ref iyqfstkhpsalqxzhousy

# Deploy all edge functions
npx supabase functions deploy --project-ref iyqfstkhpsalqxzhousy

# Local dev
npm run dev

# Build
npm run build
```
