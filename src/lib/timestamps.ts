/** "[3:21]" / "[1:02:03]" stamps inside notes. */
export const STAMP_RE = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]/g;

export function formatStamp(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export type NotePart = { text: string } | { stamp: string; seconds: number };

/** Split note text into plain text and timestamp parts, for rendering clickable stamps. */
export function splitStamps(text: string): NotePart[] {
  const parts: NotePart[] = [];
  let last = 0;
  for (const m of text.matchAll(STAMP_RE)) {
    const index = m.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index) });
    const seconds = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    parts.push({ stamp: m[0].slice(1, -1), seconds });
    last = index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Unique stamps in order of first appearance. */
export function listStamps(text: string) {
  const seen = new Set<number>();
  const out: { stamp: string; seconds: number }[] = [];
  for (const part of splitStamps(text)) {
    if ("stamp" in part && !seen.has(part.seconds)) {
      seen.add(part.seconds);
      out.push(part);
    }
  }
  return out;
}
