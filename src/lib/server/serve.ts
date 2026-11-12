import "server-only";

import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";

import { extOf } from "@/lib/files";

const MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/mp4",
  webm: "video/webm",
  mkv: "video/x-matroska",
  ogv: "video/ogg",
  ts: "video/mp2t",
  m3u8: "application/vnd.apple.mpegurl",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  m4b: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  pdf: "application/pdf",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  ipynb: "application/json; charset=utf-8",
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  tsv: "text/tab-separated-values; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const TEXT_EXTS = new Set(["py", "r", "sql", "sh", "yaml", "yml", "toml", "xml", "srt", "log", "ini", "cfg", "ts", "tsx", "jsx"]);

export function mimeFor(fileName: string) {
  const ext = extOf(fileName);
  if (MIME[ext]) return MIME[ext];
  if (TEXT_EXTS.has(ext)) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

/** Stream a file with HTTP Range support (needed for video seeking). */
export async function serveFile(
  request: Request,
  abs: string,
  opts?: { contentType?: string; download?: string; cache?: string; extraHeaders?: Record<string, string> },
) {
  const stat = await fs.stat(abs);
  const size = stat.size;
  const headers = new Headers({
    "Content-Type": opts?.contentType ?? mimeFor(abs),
    "Accept-Ranges": "bytes",
    "Last-Modified": stat.mtime.toUTCString(),
    "Cache-Control": opts?.cache ?? "private, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    ...opts?.extraHeaders,
  });
  if (opts?.download) {
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(opts.download)}`);
  }

  const range = request.headers.get("range");
  let start = 0;
  let end = size - 1;
  let status = 200;

  if (range && size > 0) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    if (m[1] === "") {
      start = Math.max(0, size - Number(m[2]));
    } else {
      start = Number(m[1]);
      end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }

  headers.set("Content-Length", String(size === 0 ? 0 : end - start + 1));
  if (request.method === "HEAD" || size === 0) return new Response(null, { status, headers });

  const nodeStream = createReadStream(abs, { start, end, highWaterMark: 1 << 20 });
  request.signal.addEventListener("abort", () => nodeStream.destroy(), { once: true });
  const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  return new Response(body, { status, headers });
}
