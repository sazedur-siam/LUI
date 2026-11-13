import type { FileKind } from "./types";

const KIND_BY_EXT: Record<string, FileKind> = {};

function register(kind: FileKind, exts: string) {
  for (const ext of exts.split(" ")) KIND_BY_EXT[ext] = kind;
}

register(
  "video",
  "mp4 m4v mkv webm mov avi wmv flv mpg mpeg m2v ts m2ts mts 3gp 3g2 ogv vob f4v asf rm rmvb divx xvid",
);
register("audio", "mp3 m4a m4b aac wav flac ogg oga opus wma aiff aif alac ape amr");
register("pdf", "pdf");
register("html", "html htm xhtml");
register("notebook", "ipynb");
register("csv", "csv tsv");
register("markdown", "md markdown mdx");
register(
  "code",
  "py js mjs cjs ts tsx jsx json yaml yml toml sh bash zsh r sql java c cc cpp h hpp go rs rb php css scss xml kt swift cs lua pl ini cfg env",
);
register("text", "txt log srt vtt rtf");
register("image", "png jpg jpeg gif webp svg bmp avif ico");
register("archive", "zip rar 7z tar gz tgz bz2 xz");
register("document", "doc docx ppt pptx xls xlsx odt ods odp key pages numbers epub");

export const SUBTITLE_EXTS = new Set(["srt", "vtt"]);

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function kindOf(name: string): FileKind {
  return KIND_BY_EXT[extOf(name)] ?? "file";
}

export const KIND_LABEL: Record<FileKind, string> = {
  video: "Video",
  audio: "Audio",
  pdf: "PDF",
  html: "Article",
  notebook: "Notebook",
  csv: "Data",
  markdown: "Notes",
  code: "Code",
  text: "Text",
  image: "Image",
  archive: "Archive",
  document: "Document",
  file: "File",
};

/** Kinds that the app can show inline. */
export function isViewable(kind: FileKind) {
  return kind !== "archive" && kind !== "document" && kind !== "file";
}

export function formatDuration(seconds: number | null | undefined, style: "clock" | "short" = "clock") {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (style === "short") {
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    if (m > 0) return `${m}m`;
    return `${sec}s`;
  }
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

/** URL for streaming a file that lives inside a course. */
export function fileUrl(courseId: string, relPath: string, opts?: { download?: boolean }) {
  const encoded = relPath.split("/").map(encodeURIComponent).join("/");
  return `/api/file/${courseId}/${encoded}${opts?.download ? "?download=1" : ""}`;
}

/** "1 lesson", "3 lessons" */
export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
