import "server-only";

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

import { CACHE_DIR, hashId, readJson, writeJsonAtomic } from "./paths";

export const FFMPEG = process.env.LUI_FFMPEG || (ffmpegStatic as unknown as string | null) || "ffmpeg";
export const FFPROBE = process.env.LUI_FFPROBE || ffprobeStatic.path || "ffprobe";

export interface ProbeStream {
  index: number;
  codec_type: "video" | "audio" | "subtitle" | "data" | "attachment";
  codec_name?: string;
  profile?: string;
  pix_fmt?: string;
  width?: number;
  height?: number;
  channels?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  disposition?: Record<string, number>;
  tags?: Record<string, string>;
}

export interface ProbeResult {
  format: { format_name?: string; duration?: string; bit_rate?: string };
  streams: ProbeStream[];
}

export interface MediaInfo {
  duration: number | null;
  formatName: string;
  video: ProbeStream | null;
  audio: ProbeStream | null;
  subtitles: ProbeStream[];
}

const TEXT_SUB_CODECS = new Set(["subrip", "ass", "ssa", "webvtt", "mov_text", "text"]);

export function run(
  bin: string,
  args: string[],
  opts?: { timeoutMs?: number },
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = opts?.timeoutMs ? setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs) : null;
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

const g = globalThis as unknown as { __luiProbe?: Map<string, Promise<MediaInfo>> };
const memo = (g.__luiProbe ??= new Map());

async function fileKey(abs: string) {
  const st = await fs.stat(abs);
  return `${abs}|${st.size}|${Math.floor(st.mtimeMs)}`;
}

/** Probe a media file. Results are cached in memory and on disk. */
export async function probe(abs: string): Promise<MediaInfo> {
  const key = await fileKey(abs);
  let p = memo.get(key);
  if (!p) {
    p = probeUncached(abs, key);
    memo.set(key, p);
    p.catch(() => memo.delete(key));
  }
  return p;
}

async function probeUncached(abs: string, key: string): Promise<MediaInfo> {
  const cacheFile = path.join(CACHE_DIR, "probe", `${hashId(key, 20)}.json`);
  let raw = await readJson<ProbeResult>(cacheFile);
  if (!raw) {
    const { code, stdout, stderr } = await run(
      FFPROBE,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", abs],
      { timeoutMs: 30_000 },
    );
    if (code !== 0) throw new Error(`ffprobe failed: ${stderr.trim().slice(0, 300)}`);
    raw = JSON.parse(stdout) as ProbeResult;
    await writeJsonAtomic(cacheFile, raw);
  }
  return toMediaInfo(raw);
}

function toMediaInfo(raw: ProbeResult): MediaInfo {
  const streams = raw.streams ?? [];
  const video =
    streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic && s.codec_name !== "mjpeg") ??
    null;
  const audio =
    streams.find((s) => s.codec_type === "audio" && s.disposition?.default) ??
    streams.find((s) => s.codec_type === "audio") ??
    null;
  const subtitles = streams.filter((s) => s.codec_type === "subtitle" && TEXT_SUB_CODECS.has(s.codec_name ?? ""));
  const duration = Number(raw.format?.duration);
  return {
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    formatName: raw.format?.format_name ?? "",
    video,
    audio,
    subtitles,
  };
}

/** Parse ffmpeg `-progress pipe:1` output and report out_time in seconds. */
export function onProgress(chunk: string, cb: (seconds: number) => void) {
  for (const line of chunk.split("\n")) {
    const m = /^out_time_(?:us|ms)=(\d+)/.exec(line);
    if (m) cb(Number(m[1]) / 1_000_000);
  }
}
