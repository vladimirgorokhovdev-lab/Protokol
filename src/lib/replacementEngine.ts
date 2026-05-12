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

// Нормализация символов для устойчивого поиска:
// - NFC unicode-нормализация
// - все виды пробелов (NBSP, узкие, табы) → обычный пробел
// - схлопывание подряд идущих пробелов
// - все виды дефисов/тире → "-"
// - типографские кавычки/апострофы → обычные
// - удаление zero-width символов
// - lowercase, ё → е
// Возвращает нормализованную строку И массив, отображающий каждый
// индекс нормализованной строки обратно в индекс исходной строки.
function normalizeWithMap(input: string): { norm: string; map: number[] } {
  const src = input.normalize("NFC");
  let norm = "";
  const map: number[] = [];
  let prevWasSpace = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const code = ch.charCodeAt(0);
    // zero-width / BOM / soft hyphen — пропускаем
    if (code === 0x200b || code === 0x200c || code === 0x200d || code === 0xfeff || code === 0x00ad) {
      continue;
    }
    // пробельные символы (включая NBSP 0xA0, узкие 0x202F/0x2009 и т.п.)
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
    // дефисы/тире
    if (ch === "\u2010" || ch === "\u2011" || ch === "\u2012" || ch === "\u2013" || ch === "\u2014" || ch === "\u2212") {
      out = "-";
    }
    // кавычки/апострофы
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
  // Group by segment and sort by position descending (to preserve positions)
  const bySegment = new Map<number, ReplacementMatch[]>();
  for (const m of accepted) {
    const arr = bySegment.get(m.segmentIndex) || [];
    arr.push(m);
    bySegment.set(m.segmentIndex, arr);
  }

  return segments.map((seg, idx) => {
    const segMatches = bySegment.get(idx);
    if (!segMatches) return seg;

    // Sort descending by position to replace from end
    const sorted = [...segMatches].sort((a, b) => b.startPos - a.startPos);
    let text = seg.text;
    for (const m of sorted) {
      text = text.slice(0, m.startPos) + m.replace + text.slice(m.startPos + m.find.length);
    }
    return { ...seg, text };
  });
}
