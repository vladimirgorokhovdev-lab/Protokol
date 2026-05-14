import { supabase } from "@/integrations/supabase/client";
import type { TranscriptSegment } from "@/lib/transcript";
import type { ReplacementMatch } from "@/components/ReplacementConfirm";

interface Rule {
  find_text: string;
  replace_text: string;
}

export async function loadReplacementRules(): Promise<Rule[]> {
  const { data } = await supabase
    .from("replacement_rules")
    .select("find_text, replace_text");
  return data || [];
}

function normalizeWithMap(input: string): { norm: string; map: number[] } {
  const src = input.normalize("NFC");
  let norm = "";
  const map: number[] = [];
  let prevWasSpace = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const code = ch.charCodeAt(0);
    if (code === 0x200b || code === 0x200c || code === 0x200d || code === 0xfeff || code === 0x00ad) {
      continue;
    }
    const isSpace = ch === " " || ch === "\t" || ch === "\n" || ch === "\r" ||
      code === 0x00a0 || code === 0x2007 || code === 0x2009 || code === 0x202f || code === 0x200a;
    if (isSpace) {
      if (prevWasSpace) continue;
      norm += " ";
      map.push(i);
      prevWasSpace = true;
      continue;
    }
    prevWasSpace = false;
    let out = ch;
    if (ch === "\u2010" || ch === "\u2011" || ch === "\u2012" || ch === "\u2013" || ch === "\u2014" || ch === "\u2212") {
      out = "-";
    }
    else if (ch === "\u2018" || ch === "\u2019" || ch === "\u201A" || ch === "\u2032" || ch === "`") {
      out = "'";
    }
    else if (ch === "\u201C" || ch === "\u201D" || ch === "\u201E" || ch === "\u00AB" || ch === "\u00BB" || ch === "\u2033") {
      out = '"';
    }
    out = out.toLowerCase();
    if (out === "ё") out = "е";
    norm += out;
    map.push(i);
  }
  return { norm, map };
}

export function findMatches(
  segments: TranscriptSegment[],
  rules: Rule[]
): ReplacementMatch[] {
  const matches: ReplacementMatch[] = [];

  segments.forEach((seg, segIdx) => {
    const { norm: textNorm, map } = normalizeWithMap(seg.text);
    for (const rule of rules) {
      const findNorm = normalizeWithMap(rule.find_text).norm.trim();
      if (!findNorm) continue;
      let pos = 0;
      while ((pos = textNorm.indexOf(findNorm, pos)) !== -1) {
        const startInOriginal = map[pos];
        const endNormIdx = pos + findNorm.length - 1;
        const endInOriginal = map[endNormIdx] + 1;
        matches.push({
          segmentIndex: segIdx,
          find: seg.text.slice(startInOriginal, endInOriginal),
          replace: rule.replace_text,
          startPos: startInOriginal,
        });
        pos += findNorm.length;
      }
    }
  });

  return matches;
}


export function applyReplacements(
  segments: TranscriptSegment[],
  accepted: ReplacementMatch[]
): TranscriptSegment[] {
  const bySegment = new Map<number, ReplacementMatch[]>();
  for (const m of accepted) {
    const arr = bySegment.get(m.segmentIndex) || [];
    arr.push(m);
    bySegment.set(m.segmentIndex, arr);
  }

  return segments.map((seg, idx) => {
    const segMatches = bySegment.get(idx);
    if (!segMatches) return seg;

    const sorted = [...segMatches].sort((a, b) => b.startPos - a.startPos);
    let text = seg.text;
    for (const m of sorted) {
      text = text.slice(0, m.startPos) + m.replace + text.slice(m.startPos + m.find.length);
    }
    return { ...seg, text };
  });
}
