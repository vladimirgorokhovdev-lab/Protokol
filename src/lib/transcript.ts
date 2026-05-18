export interface TranscriptSegment {
  id: string;
  speaker: string;
  speakerIndex: number;
  text: string;
  startTime: number;
  endTime: number;
  isEdited?: boolean;
}

export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface RawTranscriptionResponse {
  text?: string;
  words?: TranscriptionWord[];
}

export interface CompactTranscriptionResponse {
  segments?: TranscriptSegment[];
  metadata?: {
    totalSegments: number;
    totalSpeakers: number;
    duration: number;
  };
}

export type TranscriptionResponse = RawTranscriptionResponse &
  CompactTranscriptionResponse;

export function formatSpeakerName(speaker: string, index: number): string {
  if (speaker === "unknown") return `Спикер ${index + 1}`;

  if (speaker.startsWith("speaker_")) {
    const num = parseInt(speaker.split("_")[1], 10) + 1;
    return `Спикер ${num}`;
  }

  return speaker;
}

function joinWords(words: string[]): string {
  let result = "";
  for (const raw of words) {
    const w = raw ?? "";
    if (!w) continue;
    if (!result) {
      result = w.trimStart();
      continue;
    }
    const needsSpace =
      !/\s$/.test(result) && !/^\s/.test(w) && !/^[.,!?;:)\]»"'…%]/.test(w);
    result += (needsSpace ? " " : "") + w;
  }
  return result
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([.,!?;:)\]»…%])/g, "$1")
    .trim();
}

export function normalizeSegmentText(text: string): string {
  return (text ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([.,!?;:)\]»…%])/g, "$1")
    .trim();
}

/** Для экспорта: сохраняет абзацы и переносы строк */
export function formatSegmentTextForExport(text: string): string {
  return (text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function convertWordsToSegments(
  data: RawTranscriptionResponse,
): TranscriptSegment[] {
  if (!data.words || data.words.length === 0) {
    return [
      {
        id: "1",
        speaker: "Спикер",
        speakerIndex: 0,
        text: data.text || "",
        startTime: 0,
        endTime: 0,
      },
    ];
  }

  const segments: TranscriptSegment[] = [];
  const speakerMap = new Map<string, number>();
  let currentSpeaker = data.words[0].speaker || "unknown";
  let currentWords: string[] = [data.words[0].text];
  let startTime = data.words[0].start;
  let endTime = data.words[0].end;

  if (!speakerMap.has(currentSpeaker)) {
    speakerMap.set(currentSpeaker, speakerMap.size);
  }

  for (let i = 1; i < data.words.length; i++) {
    const word = data.words[i];
    const speaker = word.speaker || "unknown";

    if (speaker !== currentSpeaker) {
      segments.push({
        id: String(segments.length + 1),
        speaker: formatSpeakerName(
          currentSpeaker,
          speakerMap.get(currentSpeaker) ?? 0,
        ),
        speakerIndex: speakerMap.get(currentSpeaker) ?? 0,
        text: joinWords(currentWords),
        startTime,
        endTime,
      });

      currentSpeaker = speaker;
      if (!speakerMap.has(speaker)) {
        speakerMap.set(speaker, speakerMap.size);
      }

      currentWords = [word.text];
      startTime = word.start;
      endTime = word.end;
      continue;
    }

    currentWords.push(word.text);
    endTime = word.end;
  }

  segments.push({
    id: String(segments.length + 1),
    speaker: formatSpeakerName(
      currentSpeaker,
      speakerMap.get(currentSpeaker) ?? 0,
    ),
    speakerIndex: speakerMap.get(currentSpeaker) ?? 0,
    text: joinWords(currentWords),
    startTime,
    endTime,
  });

  return segments;
}

export function extractTranscriptSegments(
  data: TranscriptionResponse,
): TranscriptSegment[] {
  if (Array.isArray(data.segments) && data.segments.length > 0) {
    return data.segments;
  }

  return convertWordsToSegments(data);
}
