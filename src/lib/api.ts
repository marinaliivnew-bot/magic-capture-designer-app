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

const ALLOWED_BRIEF_FIELDS = [
  "users_of_space",
  "scenarios",
  "zones",
  "storage",
  "style_likes",
  "style_dislikes",
  "constraints_practical",
  "success_criteria",
  "completeness_score",
  "user_refs",
  "style_narrowing_result",
];

export async function upsertBrief(projectId: string, fields: Record<string, any>) {
  const filtered = Object.fromEntries(
    Object.entries(fields).filter(([key]) => ALLOWED_BRIEF_FIELDS.includes(key))
  );

  // Check if brief exists
  const existing = await getBrief(projectId);
  if (existing) {
    const { error } = await supabase
      .from("briefs")
      .update(filtered)
      .eq("project_id", projectId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("briefs")
      .insert({ project_id: projectId, ...filtered });
    if (error) throw error;
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

const VISUAL_SLIDER_LABELS: Record<string, [string, string]> = {
  temperature: ["Холодно", "Тепло"],
  strictness: ["Строго", "Свободно"],
  texture: ["Просто", "Фактурно"],
  color: ["Монохром", "Цветно"],
  style: ["Классика", "Авангард"],
};

function formatDesignerProfileForAI(profile: DesignerProfile | null): string {
  if (!profile) return "";
  const parts: string[] = [];
  if (profile.designer_name) parts.push(`Дизайнер: ${profile.designer_name}`);
  if (profile.style_description) parts.push(`Стиль: ${profile.style_description}`);
  if (profile.custom_ergonomics_text) parts.push(`Ограничения и стандарты:\n${profile.custom_ergonomics_text}`);
  if (profile.ergonomics_rules) {
    const sliders = Object.entries(profile.ergonomics_rules)
      .map(([key, val]) => {
        const [left, right] = VISUAL_SLIDER_LABELS[key] || [key, ""];
        return `  ${left} ↔ ${right}: ${val}/10`;
      })
      .join("\n");
    if (sliders) parts.push(`Визуальный язык:\n${sliders}`);
  }
  if (profile.ai_analysis) {
    const shortAnalysis = profile.ai_analysis.split("\n").slice(0, 10).join("\n");
    parts.push(`Резюме AI по стилю дизайнера:\n${shortAnalysis}`);
  }
  return parts.join("\n\n");
}

// AI Analysis
export async function analyzeBrief(projectId: string, briefText: string, projectContext?: string) {
  // Fetch user refs from brief and designer profile in parallel
  const [brief, designerProfile] = await Promise.all([
    getBrief(projectId),
    getDesignerProfile(getSessionId()),
  ]);
  const userRefs = (brief as any)?.user_refs || [];
  const designerProfileText = formatDesignerProfileForAI(designerProfile);

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-brief`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ briefText, projectContext, userRefs, designerProfileText }),
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
  const [brief, designerProfile] = await Promise.all([
    getBrief(projectId),
    getDesignerProfile(getSessionId()),
  ]);
  const userRefs = (brief as any)?.user_refs || [];
  const designerProfileText = formatDesignerProfileForAI(designerProfile);

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-board`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ briefText, projectContext, userRefs, designerProfileText }),
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
    (Array.isArray(b.search_queries) ? b.search_queries : []).forEach((q: string, j: number) => {
      allQueries[`board_${i}_${j}`] = q;
    });
  });

  // Fetch real images through server-side edge function (keeps API keys off client)
  let imageMap: Record<string, { url: string; attribution: string }> = {};
  try {
    if (Object.keys(allQueries).length > 0) {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-style-images`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ queries: allQueries }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Style image fetch failed: ${resp.status}`);
      }
      const data = await resp.json();
      imageMap = data.images || {};
    }
  } catch (e) {
    console.error("Failed to fetch board images:", e);
  }

  // Save blocks to DB with real image URLs
  const blocksToSave = (result.blocks || []).map((b: any, i: number) => ({
    block_type: b.block_type,
    caption: b.caption,
    sort_order: i,
    images: (Array.isArray(b.search_queries) ? b.search_queries : []).map((q: string, j: number) => {
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

export async function parseRoomsFromText(text: string): Promise<{ name: string; room_type: string; dimensions_text: string }[]> {
  const { data, error } = await supabase.functions.invoke("parse-rooms", {
    body: { text },
  });
  if (error) throw error;
  return data?.rooms || [];
}

// Designer Profile API (v2-three-layer)
export interface DesignerProfile {
  id?: string;
  session_id: string;
  designer_name?: string | null;
  style_description: string | null;
  style_refs: string[] | null;
  hard_constraints: Record<string, any> | null;
  ergonomics_rules: Record<string, any> | null;
  custom_ergonomics_text: string | null;
  ai_analysis?: string | null;
  ai_questions?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export async function getDesignerProfile(sessionId: string): Promise<DesignerProfile | null> {
  const { data, error } = await supabase
    .from("designer_profile")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertDesignerProfile(profile: DesignerProfile): Promise<DesignerProfile> {
  // Exclude auto-generated fields from insert/update
  const { id, created_at, updated_at, ...profileData } = profile;
  
  const { data, error } = await supabase
    .from("designer_profile")
    .upsert(profileData, { onConflict: "session_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
