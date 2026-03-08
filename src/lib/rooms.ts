import { supabase } from "@/integrations/supabase/client";

export async function uploadPlanFile(file: File, projectId: string, roomIndex: number): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${projectId}/room-${roomIndex}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("plan-uploads")
    .upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("plan-uploads").getPublicUrl(path);
  return data.publicUrl;
}

export async function saveRooms(
  projectId: string,
  rooms: Array<{
    name: string;
    room_type: string;
    dimensions_text?: string;
    plan_url?: string;
    sort_order: number;
  }>
) {
  // Delete existing rooms for this project
  await supabase.from("rooms").delete().eq("project_id", projectId);

  if (rooms.length === 0) return [];

  const { data, error } = await supabase
    .from("rooms")
    .insert(rooms.map((r) => ({ ...r, project_id: projectId })))
    .select();
  if (error) throw error;
  return data;
}

export async function getRooms(projectId: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  if (error) throw error;
  return data;
}
