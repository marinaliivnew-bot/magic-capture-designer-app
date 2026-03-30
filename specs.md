# Magic Capture — Technical Specs

## What this project is
A web app for interior designers that transforms client input (room data, style preferences, floor plans, reference images) into structured briefs and concept boards, with PDF export.

## Tech stack
- **Frontend:** React + Tailwind CSS
- **Backend / DB:** Supabase (PostgreSQL + Storage)
- **Anonymous sessions:** session_id stored in localStorage (no auth)
- **AI text generation:** OpenAI GPT-4o via Supabase Edge Functions
- **Images:** Unsplash API (primary), Together AI FLUX (fallback)
- **PDF export:** @react-pdf/renderer
- **Language:** Russian (all UI and AI output)

## AI architecture — CRITICAL
All AI calls go through Supabase Edge Functions. The OpenAI key is stored in Supabase Edge Secrets and is NEVER exposed on the frontend. Do not move AI calls to the frontend under any circumstances.

## Environment variables
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- OpenAI key lives in Supabase Edge Secrets only

## Local dev
- Project folder: ~/Documents/magic-capture
- Run: npm run dev
- Port: localhost:8080 (or 8081 if occupied — check terminal output)

## Git workflow
git add . → git commit -m "message" → git push

## Key constraints
- Never use <form> HTML tags — use onClick/onChange handlers instead
- All user-facing text and AI responses must be in Russian
- Do not add authentication — anonymous sessions only for MVP
- Do not add TypeScript strict mode or RLS migrations — premature for MVP
- Do not touch working Supabase connection logic
