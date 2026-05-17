export interface TranscriptSegment {
  id: string;
  speaker: string;
  speakerIndex: number;
  text: string;
  startTime: number;
  endTime: number;
}

export interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
  speaker?: string;
  speaker_id?: string;
}

export interface ElevenLabsTranscription {
  text?: string;
  words?: ElevenLabsWord[];
}

export type WebhookJobMetadata = {
  job_id: string;
  num_speakers: number | null;
};

export function formatSpeakerName(speaker: string, index: number): string {
  if (speaker === "unknown") return `Спикер ${index + 1}`;
  if (speaker.startsWith("speaker_")) {
    return `Спикер ${Number.parseInt(speaker.split("_")[1], 10) + 1}`;
  }
  return speaker;
}

export function convertToSegments(
  data: ElevenLabsTranscription,
  maxSpeakers: number | null = null,
): TranscriptSegment[] {
  if (!data.words || data.words.length === 0) {
    return [
      {
        id: "1",
        speaker: "Спикер",
        speakerIndex: 0,
        text: data.text ?? "",
        startTime: 0,
        endTime: 0,
      },
    ];
  }

  const speakerRemap = new Map<string, string>();
  if (maxSpeakers && maxSpeakers >= 1) {
    const durations = new Map<string, number>();
    for (const w of data.words) {
      const sp = w.speaker_id ?? w.speaker ?? "unknown";
      durations.set(
        sp,
        (durations.get(sp) ?? 0) + Math.max(0, (w.end ?? 0) - (w.start ?? 0)),
      );
    }
    const sorted = [...durations.entries()].sort((a, b) => b[1] - a[1]);
    const keep = new Set(sorted.slice(0, maxSpeakers).map(([sp]) => sp));
    if (sorted.length > maxSpeakers) {
      const keepWords = data.words.filter((w) =>
        keep.has(w.speaker_id ?? w.speaker ?? "unknown"),
      );
      for (const [sp] of sorted.slice(maxSpeakers)) {
        const myWords = data.words.filter(
          (w) => (w.speaker_id ?? w.speaker ?? "unknown") === sp,
        );
        if (myWords.length === 0) continue;
        const myMid = (myWords[0].start + myWords[myWords.length - 1].end) / 2;
        let bestSp = sorted[0][0];
        let bestDist = Infinity;
        for (const w of keepWords) {
          const wMid = (w.start + w.end) / 2;
          const d = Math.abs(wMid - myMid);
          if (d < bestDist) {
            bestDist = d;
            bestSp = w.speaker_id ?? w.speaker ?? "unknown";
          }
        }
        speakerRemap.set(sp, bestSp);
      }
    }
  }

  const resolveSpeaker = (raw: string): string => speakerRemap.get(raw) ?? raw;

  const segments: TranscriptSegment[] = [];
  const speakerMap = new Map<string, number>();
  let currentSpeaker = resolveSpeaker(
    data.words[0].speaker_id ?? data.words[0].speaker ?? "unknown",
  );
  let currentWords: string[] = [data.words[0].text];
  let startTime = data.words[0].start;
  let endTime = data.words[0].end;

  if (!speakerMap.has(currentSpeaker)) {
    speakerMap.set(currentSpeaker, speakerMap.size);
  }

  for (let i = 1; i < data.words.length; i++) {
    const word = data.words[i];
    const speaker = resolveSpeaker(
      word.speaker_id ?? word.speaker ?? "unknown",
    );

    if (speaker !== currentSpeaker) {
      segments.push({
        id: String(segments.length + 1),
        speaker: formatSpeakerName(
          currentSpeaker,
          speakerMap.get(currentSpeaker) ?? 0,
        ),
        speakerIndex: speakerMap.get(currentSpeaker) ?? 0,
        text: currentWords.join(" ").trim(),
        startTime,
        endTime,
      });
      currentSpeaker = speaker;
      if (!speakerMap.has(speaker)) speakerMap.set(speaker, speakerMap.size);
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
    text: currentWords.join(" ").trim(),
    startTime,
    endTime,
  });

  return segments;
}

export async function formatSizeMbFromUrl(url: string): Promise<string> {
  try {
    const head = await fetch(url, { method: "HEAD" });
    const cl = head.headers.get("content-length");
    if (cl) return (Number(cl) / 1024 / 1024).toFixed(2);
  } catch {
    /* optional */
  }
  return "?";
}

export function buildElevenLabsForm(
  cloudStorageUrl: string,
  numSpeakers: number | null,
  jobId: string,
): FormData {
  const form = new FormData();
  form.append("model_id", "scribe_v2");
  form.append("diarize", "true");
  form.append("tag_audio_events", "true");
  form.append("language_code", "rus");
  form.append("cloud_storage_url", cloudStorageUrl);
  form.append("webhook", "true");
  const metadata: WebhookJobMetadata = {
    job_id: jobId,
    num_speakers: numSpeakers,
  };
  form.append("webhook_metadata", JSON.stringify(metadata));
  if (numSpeakers) form.append("num_speakers", String(numSpeakers));
  return form;
}
