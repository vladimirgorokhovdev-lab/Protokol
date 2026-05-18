import { supabase } from "@/integrations/supabase/client";
import type { TranscriptSegment } from "@/lib/transcript";

export async function uploadAudioFile(
  file: File,
  userId: string,
  onProgress?: (pct: number) => void,
): Promise<string | null> {
  const ext = file.name.split(".").pop() || "webm";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { data: signed, error: signErr } = await supabase.storage
    .from("audio-files")
    .createSignedUploadUrl(path);

  if (signErr || !signed) {
    console.error("Failed to get upload URL:", signErr);
    return null;
  }

  const ok = await new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener("load", () =>
      resolve(xhr.status >= 200 && xhr.status < 300),
    );
    xhr.addEventListener("error", () => resolve(false));
    xhr.addEventListener("abort", () => resolve(false));
    xhr.open("PUT", signed.signedUrl);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });

  if (!ok) {
    console.error("Failed to upload audio");
    return null;
  }
  onProgress?.(100);
  return path;
}

export async function getAudioUrl(audioPath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("audio-files")
    .createSignedUrl(audioPath, 60 * 60 * 24);

  return data?.signedUrl ?? null;
}

export async function saveTranscription(
  fileName: string,
  segments: TranscriptSegment[],
  speakerNames: Record<string, string>,
  audioFileOrPath?: File | string | null,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let audioPath: string | null = null;
  if (typeof audioFileOrPath === "string") {
    audioPath = audioFileOrPath;
  } else if (audioFileOrPath instanceof File) {
    audioPath = await uploadAudioFile(audioFileOrPath, user.id);
  }

  const duration =
    segments.length > 0 ? segments[segments.length - 1].endTime : 0;
  const uniqueSpeakers = new Set(segments.map((s) => s.speaker));

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const teamId = membership?.team_id ?? null;

  const { data: transcription, error } = await supabase
    .from("transcriptions")
    .insert({
      user_id: user.id,
      file_name: fileName,
      duration,
      speaker_count: uniqueSpeakers.size,
      segment_count: segments.length,
      speaker_names: speakerNames,
      audio_path: audioPath,
      team_id: teamId,
    } as never)
    .select()
    .single();

  if (error || !transcription) {
    console.error("Failed to save transcription:", error);
    return null;
  }

  const segmentRows = segments.map((s, i) => ({
    transcription_id: transcription.id,
    speaker: s.speaker,
    speaker_index: s.speakerIndex,
    text: s.text,
    start_time: s.startTime,
    end_time: s.endTime,
    segment_order: i,
  }));

  const BATCH_SIZE = 500;
  for (let i = 0; i < segmentRows.length; i += BATCH_SIZE) {
    const batch = segmentRows.slice(i, i + BATCH_SIZE);
    const { error: segError } = await supabase
      .from("transcription_segments")
      .insert(batch);

    if (segError) {
      console.error(
        `Failed to save segments batch ${i / BATCH_SIZE + 1}:`,
        segError,
      );
    }
  }

  return transcription.id;
}

export async function saveAiSummary(
  transcriptionId: string,
  aiSummary: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("transcriptions")
    .update({ ai_summary: aiSummary } as any)
    .eq("id", transcriptionId);

  if (error) {
    console.error("Failed to save AI summary:", error);
  }
}

export async function loadAiSummary(transcriptionId: string) {
  const { data, error } = await supabase
    .from("transcriptions")
    .select("ai_summary")
    .eq("id", transcriptionId)
    .single();

  if (error || !data?.ai_summary) return null;
  return data.ai_summary as Record<string, unknown>;
}

export async function loadTranscriptions() {
  const { data, error } = await supabase
    .from("transcriptions")
    .select("*, folder_id")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load transcriptions:", error);
    return [];
  }
  return data;
}

export async function searchTranscriptionsByContent(
  query: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("search_transcriptions", {
    search_query: query,
  });

  if (error) {
    console.error("Failed to search transcriptions:", error);
    return [];
  }
  return data as string[];
}

export async function loadTranscriptionSegments(
  transcriptionId: string,
): Promise<TranscriptSegment[]> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("transcription_segments")
      .select("*")
      .eq("transcription_id", transcriptionId)
      .order("segment_order", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to load segments:", error);
      return allData.length > 0 ? allData : [];
    }

    allData = allData.concat(data);
    hasMore = data.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  const data = allData;

  return data.map((row) => ({
    id: row.id,
    speaker: row.speaker,
    speakerIndex: row.speaker_index,
    text: row.text,
    startTime: row.start_time,
    endTime: row.end_time,
    isEdited: row.is_edited,
  }));
}

export async function deleteTranscription(id: string) {
  const { data: record } = await supabase
    .from("transcriptions")
    .select("audio_path")
    .eq("id", id)
    .single();

  if (record?.audio_path) {
    await supabase.storage.from("audio-files").remove([record.audio_path]);
  }

  const { error } = await supabase.from("transcriptions").delete().eq("id", id);

  if (error) {
    console.error("Failed to delete transcription:", error);
    return false;
  }
  return true;
}

export async function updateSegmentText(segmentId: string, text: string) {
  const { error } = await supabase
    .from("transcription_segments")
    .update({ text, is_edited: true } as any)
    .eq("id", segmentId);

  if (error) {
    console.error("Failed to update segment text:", error);
    return false;
  }
  return true;
}

export async function deleteSegment(segmentId: string) {
  const { error } = await supabase
    .from("transcription_segments")
    .delete()
    .eq("id", segmentId);

  if (error) {
    console.error("Failed to delete segment:", error);
    return false;
  }
  return true;
}

export async function restoreSegmentInDb(
  segment: TranscriptSegment,
  transcriptionId: string,
  segmentOrder: number,
): Promise<boolean> {
  const { error } = await supabase.rpc("restore_transcription_segment", {
    p_id: segment.id,
    p_transcription_id: transcriptionId,
    p_speaker: segment.speaker,
    p_speaker_index: segment.speakerIndex,
    p_text: segment.text,
    p_start_time: segment.startTime,
    p_end_time: segment.endTime,
    p_segment_order: segmentOrder,
    p_is_edited: segment.isEdited ?? false,
  });

  if (error) {
    console.error("Failed to restore segment in DB:", error);
    return false;
  }
  return true;
}

export async function mergeSegmentsInDb(
  firstId: string,
  secondId: string,
  mergedText: string,
): Promise<boolean> {
  const { error } = await supabase.rpc("merge_transcription_segments", {
    p_first_id: firstId,
    p_second_id: secondId,
    p_merged_text: mergedText,
  });

  if (error) {
    console.error("Failed to merge segments in DB:", error);
    return false;
  }
  return true;
}

export async function splitSegmentInDb(
  segmentId: string,
  firstText: string,
  secondText: string,
  splitTime: number,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("split_transcription_segment", {
    p_segment_id: segmentId,
    p_first_text: firstText,
    p_second_text: secondText,
    p_split_time: splitTime,
  });

  if (error) {
    console.error("Failed to split segment in DB:", error);
    return null;
  }
  return (data as unknown as string) ?? null;
}

export async function reassignSegmentSpeaker(
  segmentId: string,
  speaker: string,
  speakerIndex: number,
) {
  const { error } = await supabase
    .from("transcription_segments")
    .update({ speaker, speaker_index: speakerIndex })
    .eq("id", segmentId);

  if (error) {
    console.error("Failed to reassign segment speaker:", error);
    return false;
  }
  return true;
}

export async function updateSpeakerNames(
  id: string,
  speakerNames: Record<string, string>,
) {
  const { error } = await supabase
    .from("transcriptions")
    .update({ speaker_names: speakerNames })
    .eq("id", id);

  if (error) {
    console.error("Failed to update speaker names:", error);
  }
}

export async function mergeSpeakersInDb(
  transcriptionId: string,
  fromSpeaker: string,
  toSpeaker: string,
  toSpeakerIndex: number,
) {
  const { error } = await supabase
    .from("transcription_segments")
    .update({ speaker: toSpeaker, speaker_index: toSpeakerIndex })
    .eq("transcription_id", transcriptionId)
    .eq("speaker", fromSpeaker);

  if (error) {
    console.error("Failed to merge speakers in DB:", error);
    return false;
  }

  const { data: segments } = await supabase
    .from("transcription_segments")
    .select("speaker")
    .eq("transcription_id", transcriptionId);

  if (segments) {
    const uniqueCount = new Set(segments.map((s) => s.speaker)).size;
    await supabase
      .from("transcriptions")
      .update({ speaker_count: uniqueCount })
      .eq("id", transcriptionId);
  }

  return true;
}

/**
 * Merge multiple transcriptions into a new one.
 * - Concatenates segments in the order of `ids` with cumulative time offsets.
 * - Unifies speakers by display name (auto by name): segments whose displayed
 *   speaker name matches an earlier file's speaker reuse that speaker key/index.
 *   Speakers without a matching name get a unique key with a suffix per source.
 * - Optionally deletes source transcriptions after a successful merge.
 * Returns the new transcription id, or null on failure.
 */
export async function mergeTranscriptions(
  ids: string[],
  newName: string,
  options: { deleteSources?: boolean; folderId?: string | null } = {},
): Promise<string | null> {
  if (ids.length < 2) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: sourceRecords, error: srcErr } = await supabase
    .from("transcriptions")
    .select("id, file_name, speaker_names, audio_path, folder_id, duration")
    .in("id", ids);

  if (srcErr || !sourceRecords) {
    console.error("Failed to load source transcriptions:", srcErr);
    return null;
  }

  const recordsById = new Map(sourceRecords.map((r) => [r.id, r]));
  const orderedSources = ids
    .map((id) => recordsById.get(id))
    .filter(Boolean) as typeof sourceRecords;

  const allSegmentsBySource = new Map<string, TranscriptSegment[]>();
  for (const src of orderedSources) {
    const segs = await loadTranscriptionSegments(src.id);
    allSegmentsBySource.set(src.id, segs);
  }

  const mergedSpeakerNames: Record<string, string> = {};
  const nameToCanonical = new Map<string, { key: string; index: number }>();
  let nextSpeakerIndex = 0;

  const mergedSegments: Omit<TranscriptSegment, "id">[] = [];
  let timeOffset = 0;

  orderedSources.forEach((src, srcIdx) => {
    const segs = allSegmentsBySource.get(src.id) || [];
    const srcSpeakerNames = (src.speaker_names || {}) as Record<string, string>;
    const localKeyMap = new Map<string, { key: string; index: number }>();

    for (const seg of segs) {
      let canonical = localKeyMap.get(seg.speaker);
      if (!canonical) {
        const displayName = (
          srcSpeakerNames[seg.speaker] || seg.speaker
        ).trim();
        const norm = displayName.toLowerCase();
        const wasRenamed = !!srcSpeakerNames[seg.speaker];
        if (wasRenamed && nameToCanonical.has(norm)) {
          canonical = nameToCanonical.get(norm)!;
        } else {
          const key = `Speaker_${nextSpeakerIndex}`;
          canonical = { key, index: nextSpeakerIndex };
          nextSpeakerIndex += 1;
          const finalDisplay = wasRenamed
            ? displayName
            : `${displayName} (часть ${srcIdx + 1})`;
          mergedSpeakerNames[key] = finalDisplay;
          if (wasRenamed) nameToCanonical.set(norm, canonical);
        }
        localKeyMap.set(seg.speaker, canonical);
      }

      mergedSegments.push({
        speaker: canonical.key,
        speakerIndex: canonical.index,
        text: seg.text,
        startTime: seg.startTime + timeOffset,
        endTime: seg.endTime + timeOffset,
        isEdited: seg.isEdited,
      });
    }

    const lastEnd = segs.length > 0 ? segs[segs.length - 1].endTime : 0;
    timeOffset += Math.max(src.duration || 0, lastEnd);
  });

  const folderId =
    options.folderId !== undefined
      ? options.folderId
      : (orderedSources[0]?.folder_id ?? null);
  const totalDuration =
    mergedSegments.length > 0
      ? mergedSegments[mergedSegments.length - 1].endTime
      : 0;
  const uniqueSpeakers = new Set(mergedSegments.map((s) => s.speaker));

  const sourceAudioPaths = orderedSources
    .map((s) => s.audio_path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  const sourceFileNames = orderedSources.map((s) => s.file_name);

  const { data: newTr, error: insErr } = await supabase
    .from("transcriptions")
    .insert({
      user_id: user.id,
      file_name: newName,
      duration: totalDuration,
      speaker_count: uniqueSpeakers.size,
      segment_count: mergedSegments.length,
      speaker_names: mergedSpeakerNames,
      audio_path: null,
      folder_id: folderId,
      source_audio_paths: sourceAudioPaths.length > 0 ? sourceAudioPaths : null,
      source_file_names: sourceFileNames.length > 0 ? sourceFileNames : null,
    } as any)
    .select()
    .single();

  if (insErr || !newTr) {
    console.error("Failed to create merged transcription:", insErr);
    return null;
  }

  const segmentRows = mergedSegments.map((s, i) => ({
    transcription_id: newTr.id,
    speaker: s.speaker,
    speaker_index: s.speakerIndex,
    text: s.text,
    start_time: s.startTime,
    end_time: s.endTime,
    segment_order: i,
    is_edited: s.isEdited ?? false,
  }));

  const BATCH = 500;
  for (let i = 0; i < segmentRows.length; i += BATCH) {
    const batch = segmentRows.slice(i, i + BATCH);
    const { error: segErr } = await supabase
      .from("transcription_segments")
      .insert(batch);
    if (segErr) {
      console.error(
        `Failed to insert merged segments batch ${i / BATCH + 1}:`,
        segErr,
      );
    }
  }

  if (options.deleteSources) {
    for (const id of ids) {
      await deleteTranscription(id);
    }
  }

  return newTr.id;
}
