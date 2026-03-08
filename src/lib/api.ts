import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "./session";

// Projects
export async function createProject(data: {
  name: string;
  raw_input?: string;
  constraints?: Record<string, string>;
}) {
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      session_id: getSessionId(),
      name: data.name,
      room_type: data.room_type || null,
      dimensions_text: data.dimensions_text || null,
      raw_input: data.raw_input || null,
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
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-brief`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ briefText, projectContext }),
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
