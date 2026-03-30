# Magic Capture — Current State

## What works
- App runs locally on localhost:8080
- Supabase connection and anonymous sessions work correctly
- Brief generation via GPT-4o (through Supabase Edge Function)
- Concept board generation with Unsplash images
- PDF export (text + image links, no embedded images)
- Floor plan upload (file is accepted)
- Style selection screen with images

## Known issues and bugs
- PDF export shows text links instead of embedded images (known limitation, out of scope for now)
- Floor plan data is uploaded but NOT passed into the concept board AI prompt — board ignores it
- Concept board is an "echo" of user input — AI does not add design interpretation
- Style images on the style selection screen are always the same (no randomization)
- Style images are low quality / not representative (e.g. art deco shows a ballroom, not a modern apartment)
- The "Name" field in the rooms section is required and blocks brief generation when user pastes room data as text

## Current screen flow
1. New Project (input form)
2. Brief (structured + editable)
3. Style Narrowing (style images selection) ← TO BE REMOVED
4. Questions & Contradictions
5. Concept Board
6. PDF Export

## Supabase Edge Functions (in supabase/functions/)
- analyze-brief — generates structured brief from raw input
- generate-board — generates concept board blocks and image queries
- (check ls ~/Documents/magic-capture/supabase/functions/ for full list)

## What has NOT been deployed yet
- Edge Functions need to be deployed to Supabase (currently running locally only)
