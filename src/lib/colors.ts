/** Cool Material tones (blue family) used as accents on a white UI. */
export const MATERIAL = [
  "#1E88E5", // blue 600
  "#039BE5", // light blue 600
  "#00ACC1", // cyan 600
  "#5C6BC0", // indigo 400
  "#26A69A", // teal 400
  "#42A5F5", // blue 400
  "#0288D1", // light blue 700
  "#7986CB", // indigo 300
  "#0097A7", // cyan 700
  "#1976D2", // blue 700
  "#4DB6AC", // teal 300
  "#546E7A", // blue grey 600
] as const;

export function colorAt(index: number) {
  return MATERIAL[((index % MATERIAL.length) + MATERIAL.length) % MATERIAL.length];
}

export function colorFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return colorAt(Math.abs(h));
}

/** Map each distinct module group to a stable colour, in course order. */
export function groupColors(groups: (string | null)[]) {
  const map = new Map<string, string>();
  for (const g of groups) {
    const key = g ?? "";
    if (!map.has(key)) map.set(key, colorAt(map.size));
  }
  return map;
}
