/** Minimal WebVTT parser for transcripts. */
export interface Cue {
  start: number;
  end: number;
  text: string;
}

function toSeconds(stamp: string) {
  const parts = stamp.trim().replace(",", ".").split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function parseVtt(text: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    const timeIndex = lines.findIndex((l) => l.includes("-->"));
    if (timeIndex < 0) continue;
    const [from, rest] = lines[timeIndex].split("-->");
    const start = toSeconds(from);
    const end = toSeconds(rest.trim().split(/\s+/)[0]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const body = lines
      .slice(timeIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "") // <i>, <c.color>, <00:01.000> karaoke tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (!body) continue;
    // Merge exact repeats (common in auto-generated captions).
    const prev = cues[cues.length - 1];
    if (prev && prev.text === body) {
      prev.end = Math.max(prev.end, end);
      continue;
    }
    cues.push({ start, end, text: body });
  }
  return cues;
}
