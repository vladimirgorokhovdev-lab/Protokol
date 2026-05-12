import { supabase } from "@/integrations/supabase/client";

export interface Folder {
  id: string;
  name: string;
  case_number: string | null;
  color: string;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface SearchResult {
  transcription_id: string;
  match_count: number;
  first_snippet: string | null;
}

export async function loadFolders(): Promise<Folder[]> {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.error("Failed to load folders:", error);
    return [];
  }
  return data as Folder[];
}

export async function createFolder(name: string, caseNumber?: string, color = "#1e3a8a"): Promise<Folder | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("folders")
    .insert({ user_id: user.id, name, case_number: caseNumber || null, color })
    .select()
    .single();
  if (error) {
    console.error("Failed to create folder:", error);
    return null;
  }
  return data as Folder;
}

export async function updateFolder(id: string, updates: Partial<Pick<Folder, "name" | "case_number" | "color">>): Promise<boolean> {
  const { error } = await supabase.from("folders").update(updates).eq("id", id);
  if (error) {
    console.error("Failed to update folder:", error);
    return false;
  }
  return true;
}

export async function deleteFolder(id: string): Promise<boolean> {
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete folder:", error);
    return false;
  }
  return true;
}

export async function loadTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .order("name", { ascending: true });
  if (error) {
    console.error("Failed to load tags:", error);
    return [];
  }
  return data as Tag[];
}

export async function createTag(name: string, color = "#d4af37"): Promise<Tag | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("tags")
    .insert({ user_id: user.id, name, color })
    .select("id, name, color")
    .single();
  if (error) {
    console.error("Failed to create tag:", error);
    return null;
  }
  return data as Tag;
}

export async function deleteTag(id: string): Promise<boolean> {
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete tag:", error);
    return false;
  }
  return true;
}

export async function setTranscriptionFolder(transcriptionId: string, folderId: string | null): Promise<boolean> {
  const { error } = await supabase
    .from("transcriptions")
    .update({ folder_id: folderId })
    .eq("id", transcriptionId);
  if (error) {
    console.error("Failed to set folder:", error);
    return false;
  }
  return true;
}

export async function loadTranscriptionTags(transcriptionId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("transcription_tags")
    .select("tags(id, name, color)")
    .eq("transcription_id", transcriptionId);
  if (error || !data) {
    console.error("Failed to load transcription tags:", error);
    return [];
  }
  return data.map((row: any) => row.tags).filter(Boolean) as Tag[];
}

export async function loadAllTranscriptionTagsMap(): Promise<Map<string, Tag[]>> {
  const { data, error } = await supabase
    .from("transcription_tags")
    .select("transcription_id, tags(id, name, color)");
  const map = new Map<string, Tag[]>();
  if (error || !data) return map;
  data.forEach((row: any) => {
    if (!row.tags) return;
    const list = map.get(row.transcription_id) || [];
    list.push(row.tags);
    map.set(row.transcription_id, list);
  });
  return map;
}

export async function addTranscriptionTag(transcriptionId: string, tagId: string): Promise<boolean> {
  const { error } = await supabase
    .from("transcription_tags")
    .insert({ transcription_id: transcriptionId, tag_id: tagId });
  if (error) {
    console.error("Failed to add tag:", error);
    return false;
  }
  return true;
}

export async function removeTranscriptionTag(transcriptionId: string, tagId: string): Promise<boolean> {
  const { error } = await supabase
    .from("transcription_tags")
    .delete()
    .eq("transcription_id", transcriptionId)
    .eq("tag_id", tagId);
  if (error) {
    console.error("Failed to remove tag:", error);
    return false;
  }
  return true;
}

export interface SearchFilters {
  query?: string;
  folderId?: string | null;
  tagIds?: string[];
  speaker?: string;
  caseNumber?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export async function searchTranscriptionsAdvanced(filters: SearchFilters): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc("search_transcriptions_advanced", {
    p_query: filters.query?.trim() || null,
    p_folder_id: filters.folderId ?? null,
    p_tag_ids: filters.tagIds && filters.tagIds.length > 0 ? filters.tagIds : null,
    p_speaker: filters.speaker?.trim() || null,
    p_case_number: filters.caseNumber?.trim() || null,
    p_date_from: filters.dateFrom?.toISOString() || null,
    p_date_to: filters.dateTo?.toISOString() || null,
  });
  if (error) {
    console.error("Failed advanced search:", error);
    return [];
  }
  return (data || []) as SearchResult[];
}
