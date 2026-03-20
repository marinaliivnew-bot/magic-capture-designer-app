import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "./session";

// Projects
export async function createProject(data: {
  name: string;
  raw_input?: string;
  rooms_description?: string;
  plan_url?: string;
  constraints?: Record<string, string>;
}) {
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      session_id: getSessionId(),
      name: data.name,
      raw_input: data.raw_input || null,
      rooms_description: data.rooms_description || null,
      plan_url: data.plan_url || null,
      constraints: data.constraints || {},
    })
    .select()
    .single();
  if (error) throw error;
  return project;
}

export async function getProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("session_id", getSessionId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProject(id: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("session_id", getSessionId())
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, fields: {
  name?: string;
  raw_input?: string | null;
  rooms_description?: string | null;
  plan_url?: string | null;
  constraints?: Record<string, string>;
}) {
  const { data, error } = await supabase
    .from("projects")
    .update(fields)
    .eq("id", id)
    .eq("session_id", getSessionId())
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id: string) {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("session_id", getSessionId());
  if (error) throw error;
}

// Briefs
export async function getBrief(projectId: string) {
  const { data, error } = await supabase
    .from("briefs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertBrief(projectId: string, fields: Record<string, unknown>) {
  // Check if brief exists
  const existing = await getBrief(projectId);
  if (existing) {
    const { data, error } = await supabase
      .from("briefs")
      .update(fields)
      .eq("project_id", projectId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("briefs")
      .insert({ project_id: projectId, ...fields })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

// Issues
export async function getIssues(projectId: string) {
  const { data, error } = await supabase
    .from("issues")
    .select("*")
    .eq("project_id", projectId);
  if (error) throw error;
  return data;
}

export async function saveIssues(projectId: string, issues: Array<{
  type: string;
  title: string;
  evidence?: string;
  impact?: string;
  suggestion?: string;
}>) {
  // Delete old issues first
  await supabase.from("issues").delete().eq("project_id", projectId);
  if (issues.length === 0) return [];
  const { data, error } = await supabase
    .from("issues")
    .insert(issues.map(i => ({ ...i, project_id: projectId })))
    .select();
  if (error) throw error;
  return data;
}

// Questions
export async function getQuestions(projectId: string) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function saveQuestions(projectId: string, questions: Array<{
  priority: string;
  text: string;
  unlocks?: string;
}>) {
  await supabase.from("questions").delete().eq("project_id", projectId);
  if (questions.length === 0) return [];
  const { data, error } = await supabase
    .from("questions")
    .insert(questions.map(q => ({ ...q, project_id: projectId })))
    .select();
  if (error) throw error;
  return data;
}

export async function updateQuestion(id: string, fields: { asked?: boolean; answer?: string }) {
  const { data, error } = await supabase
    .from("questions")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Board blocks & images
export async function getBoardBlocks(projectId: string) {
  const { data, error } = await supabase
    .from("board_blocks")
    .select("*, board_images(*)")
    .eq("project_id", projectId)
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function saveBoardBlocks(projectId: string, blocks: Array<{
  block_type: string;
  caption?: string;
  sort_order: number;
  images?: Array<{
    url?: string;
    source_type?: string;
    source_url?: string;
    attribution?: string;
    note?: string;
  }>;
}>) {
  // Delete existing
  await supabase.from("board_blocks").delete().eq("project_id", projectId);
  
  for (const block of blocks) {
    const { images, ...blockData } = block;
    const { data: savedBlock, error } = await supabase
      .from("board_blocks")
      .insert({ ...blockData, project_id: projectId })
      .select()
      .single();
    if (error) throw error;

    if (images && images.length > 0 && savedBlock) {
      const { error: imgError } = await supabase
        .from("board_images")
        .insert(images.map(img => ({ ...img, block_id: savedBlock.id })));
      if (imgError) throw imgError;
    }
  }
}

export async function updateBoardBlock(blockId: string, fields: { caption?: string }) {
  const { error } = await supabase
    .from("board_blocks")
    .update(fields)
    .eq("id", blockId);
  if (error) throw error;
}

export async function updateBoardImage(imageId: string, fields: { url?: string; source_type?: string; source_url?: string; attribution?: string }) {
  const { error } = await supabase
    .from("board_images")
    .update(fields)
    .eq("id", imageId);
  if (error) throw error;
}

// AI Analysis
export async function analyzeBrief(projectId: string, briefText: string, projectContext?: string) {
  // Fetch user refs from brief
  const brief = await getBrief(projectId);
  const userRefs = (brief as any)?.user_refs || [];

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-brief`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ briefText, projectContext, userRefs }),
    }
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Analysis failed: ${resp.status}`);
  }
  const result = await resp.json();

  // Save results to DB
  await saveIssues(projectId, result.issues || []);
  await saveQuestions(projectId, result.questions || []);

  return result;
}

// Board generation
export async function generateBoard(projectId: string, briefText: string, projectContext?: string) {
  const brief = await getBrief(projectId);
  const userRefs = (brief as any)?.user_refs || [];

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-board`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ briefText, projectContext, userRefs }),
    }
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Board generation failed: ${resp.status}`);
  }
  const result = await resp.json();

  // Collect all search queries to fetch real images
  const allQueries: Record<string, string> = {};
  (result.blocks || []).forEach((b: any, i: number) => {
    (b.search_queries || []).forEach((q: string, j: number) => {
      allQueries[`board_${i}_${j}`] = q;
    });
  });

  // Fetch real images directly from Unsplash (avoid edge-function CORS issues)
  let imageMap: Record<string, { url: string; attribution: string }> = {};
  try {
    const unsplashKey = import.meta.env.VITE_UNSPLASH_KEY;
    if (!unsplashKey) {
      throw new Error("VITE_UNSPLASH_KEY is not configured");
    }

    const entries = Object.entries(allQueries);
    const results = await Promise.all(
      entries.map(async ([key, query]) => {
        try {
          const resp = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
              query
            )}&per_page=1`,
            {
              headers: {
                Authorization: `Client-ID ${unsplashKey}`,
              },
            }
          );
          if (!resp.ok) return [key, null] as const;
          const data = await resp.json();
          const photo = data.results?.[0];
          if (!photo) return [key, null] as const;

          const url =
            photo.urls?.regular || photo.urls?.small || photo.urls?.thumb || "";
          if (!url) return [key, null] as const;

          return [
            key,
            {
              url,
              attribution: `${photo.user?.name || "Unsplash"} / Unsplash`,
            },
          ] as const;
        } catch (e) {
          console.error(`Unsplash fetch failed for ${key}:`, e);
          return [key, null] as const;
        }
      })
    );

    for (const [key, value] of results) {
      if (value) imageMap[key] = value;
    }
  } catch (e) {
    console.error("Failed to fetch board images:", e);
  }

  // Save blocks to DB with real image URLs
  const blocksToSave = (result.blocks || []).map((b: any, i: number) => ({
    block_type: b.block_type,
    caption: b.caption,
    sort_order: i,
    images: (b.search_queries || []).map((q: string, j: number) => {
      const key = `board_${i}_${j}`;
      const img = imageMap[key];
      return {
        url: img?.url || "",
        source_type: "unsplash_auto",
        attribution: img?.attribution || "",
        note: q,
      };
    }),
  }));

  await saveBoardBlocks(projectId, blocksToSave);

  return result;
}
