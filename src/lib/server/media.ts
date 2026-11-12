import "server-only";

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { extOf } from "@/lib/files";
import type { PlaybackMode } from "@/lib/types";

import { FFMPEG, type MediaInfo, onProgress, type ProbeStream } from "./ffmpeg";
import { CACHE_DIR, ensureDir, hashId, readJson, writeJsonAtomic } from "./paths";

const MEDIA_DIR = path.join(CACHE_DIR, "media");
const PIPELINE_VERSION = "1";

/* -------------------------------------------------------------------------- */
/*                                Capabilities                                */
/* -------------------------------------------------------------------------- */

/** What the browser told us it can play, e.g. "mp4,mkv,h264,aac,opus". */
export type Caps = Set<string>;

export function parseCaps(raw: string | null): Caps {
  const caps = new Set((raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  // Every browser we care about handles these.
  caps.add("mp4");
  caps.add("h264");
  caps.add("aac");
  caps.add("mp3");
  return caps;
}

function containerOf(info: MediaInfo, fileName: string) {
  const f = info.formatName;
  const ext = extOf(fileName);
  if (f.includes("matroska") || f.includes("webm")) return ext === "webm" ? "webm" : "mkv";
  if (f.includes("mp4") || f.includes("mov")) return "mp4";
  if (f === "mp3") return "mp3";
  if (f === "ogg") return "ogg";
  if (f === "wav") return "wav";
  if (f === "flac") return "flac";
  if (f === "aac") return "aacfile";
  return f.split(",")[0] || "unknown";
}

function videoToken(s: ProbeStream | null) {
  if (!s) return null;
  const c = s.codec_name ?? "";
  const pix = s.pix_fmt ?? "";
  if (c === "h264") {
    // Browsers only decode 8-bit 4:2:0 H.264.
    return /^(yuv420p|yuvj420p|nv12)$/.test(pix) || pix === "" ? "h264" : null;
  }
  if (c === "hevc" || c === "vp8" || c === "vp9" || c === "av1") return c;
  return null;
}

function audioToken(s: ProbeStream | null) {
  if (!s) return null;
  const c = s.codec_name ?? "";
  if (c.startsWith("pcm_")) return "pcm";
  if (["aac", "mp3", "opus", "vorbis", "flac", "ac3", "eac3", "alac"].includes(c)) return c;
  return null;
}

const MP4_VIDEO = new Set(["h264", "hevc", "av1", "vp9"]);
const MP4_AUDIO = new Set(["aac", "mp3", "opus", "flac", "ac3", "eac3", "alac"]);

const LABELS: Record<string, string> = {
  h264: "H.264",
  hevc: "HEVC",
  vp8: "VP8",
  vp9: "VP9",
  av1: "AV1",
  mpeg4: "MPEG-4",
  mpeg2video: "MPEG-2",
  wmv3: "WMV",
  vc1: "VC-1",
  flv1: "FLV",
  aac: "AAC",
  mp3: "MP3",
  opus: "Opus",
  vorbis: "Vorbis",
  flac: "FLAC",
  ac3: "AC-3",
  eac3: "E-AC-3",
  dts: "DTS",
  wmav2: "WMA",
};

export function describe(info: MediaInfo, fileName: string) {
  const parts: string[] = [];
  if (info.video) parts.push(LABELS[info.video.codec_name ?? ""] ?? (info.video.codec_name ?? "").toUpperCase());
  if (info.audio) parts.push(LABELS[info.audio.codec_name ?? ""] ?? (info.audio.codec_name ?? "").toUpperCase());
  parts.push(extOf(fileName).toUpperCase());
  return parts.filter(Boolean).join(" · ");
}

export interface Decision {
  mode: PlaybackMode;
  audioCopy: boolean;
}

export function decide(info: MediaInfo, fileName: string, caps: Caps, force?: string | null): Decision {
  const container = containerOf(info, fileName);
  const vTok = videoToken(info.video);
  const aTok = audioToken(info.audio);

  const containerOk =
    caps.has(container) || (container === "wav" && caps.has("wav")) || (container === "ogg" && caps.has("ogg"));
  const videoOk = !info.video || (vTok != null && caps.has(vTok));
  const audioOk = !info.audio || (aTok != null && (caps.has(aTok) || (aTok === "pcm" && container === "wav")));

  const audioCopy = !!info.audio && aTok != null && caps.has(aTok) && MP4_AUDIO.has(aTok);
  const videoCopy = !!info.video && vTok != null && caps.has(vTok) && MP4_VIDEO.has(vTok);

  if (!info.video) {
    if (!force && containerOk && audioOk) return { mode: "direct", audioCopy };
    return { mode: "remux", audioCopy: force ? false : audioCopy };
  }
  if (force === "transcode") return { mode: "transcode", audioCopy: false };
  if (force === "remux") return videoCopy ? { mode: "remux", audioCopy } : { mode: "transcode", audioCopy: false };
  if (containerOk && videoOk && audioOk) return { mode: "direct", audioCopy };
  if (videoCopy) return { mode: "remux", audioCopy };
  return { mode: "transcode", audioCopy: false };
}

async function fileSignature(abs: string) {
  const st = await fs.stat(abs);
  return `${abs}|${st.size}|${Math.floor(st.mtimeMs)}`;
}

export async function jobKey(abs: string, decision: Decision) {
  return hashId(`${PIPELINE_VERSION}|${await fileSignature(abs)}|${decision.mode}|${decision.audioCopy}`, 16);
}

export function jobDir(key: string) {
  if (!/^[a-f0-9]{16}$/.test(key)) throw new Error("Bad media key");
  return path.join(MEDIA_DIR, key);
}

/* -------------------------------------------------------------------------- */
/*                         Remux (fast, no re-encode)                          */
/* -------------------------------------------------------------------------- */

interface RemuxJob {
  status: "running" | "done" | "error";
  progress: number;
  error?: string;
  file: string;
}

const g = globalThis as unknown as {
  __luiRemux?: Map<string, RemuxJob>;
  __luiHls?: Map<string, HlsSession>;
};
const remuxJobs = (g.__luiRemux ??= new Map());

export function remuxFileName(info: MediaInfo) {
  return info.video ? "media.mp4" : "media.m4a";
}

export function startRemux(key: string, abs: string, info: MediaInfo, decision: Decision): RemuxJob {
  const dir = jobDir(key);
  const out = path.join(dir, remuxFileName(info));
  const existing = remuxJobs.get(key);
  if (existing && existing.status !== "error") return existing;
  if (existsSync(out)) {
    const done: RemuxJob = { status: "done", progress: 1, file: out };
    remuxJobs.set(key, done);
    return done;
  }

  const job: RemuxJob = { status: "running", progress: 0, file: out };
  remuxJobs.set(key, job);

  void (async () => {
    await ensureDir(dir);
    const tmp = path.join(dir, `partial-${Date.now()}.mp4`);
    const args = ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-i", abs];
    if (info.video) {
      args.push("-map", `0:${info.video.index}`, "-c:v", "copy");
      if (info.video.codec_name === "hevc") args.push("-tag:v", "hvc1");
    } else {
      args.push("-vn");
    }
    if (info.audio) {
      args.push("-map", `0:${info.audio.index}`);
      if (decision.audioCopy) args.push("-c:a", "copy");
      else args.push("-c:a", "aac", "-b:a", "192k", "-ac", "2");
    }
    args.push("-sn", "-dn", "-map_metadata", "-1", "-movflags", "+faststart", "-f", "mp4");
    args.push("-progress", "pipe:1", "-nostats", tmp);

    const child = spawn(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stdout.on("data", (d: Buffer) =>
      onProgress(d.toString(), (t) => {
        if (info.duration) job.progress = Math.min(0.99, t / info.duration);
      }),
    );
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      job.status = "error";
      job.error = err.message;
    });
    child.on("close", async (code) => {
      if (code === 0) {
        await fs.rename(tmp, out);
        job.status = "done";
        job.progress = 1;
      } else {
        job.status = "error";
        job.error = stderr.trim().split("\n").slice(-3).join(" ") || `ffmpeg exited with ${code}`;
        await fs.rm(tmp, { force: true });
      }
    });
  })().catch((err) => {
    job.status = "error";
    job.error = String(err);
  });

  return job;
}

export function remuxStatus(key: string) {
  return remuxJobs.get(key) ?? null;
}

/* -------------------------------------------------------------------------- */
/*                   On-demand HLS transcoding (any codec)                     */
/* -------------------------------------------------------------------------- */

const SEG = 4;
const MAX_ACTIVE_RUNS = 2;
const LOOKAHEAD = 8;

interface SessionMeta {
  abs: string;
  duration: number;
  videoIndex: number;
  audioIndex: number | null;
  height: number;
}

interface Run {
  proc: ChildProcess;
  start: number;
  cursor: number;
  exited: boolean;
  code: number | null;
  stderr: string;
}

interface HlsSession {
  key: string;
  dir: string;
  meta: SessionMeta;
  segments: number;
  run: Run | null;
  lastAccess: number;
  encoder: "videotoolbox" | "x264";
  failures: number;
}

const sessions = (g.__luiHls ??= new Map());

export async function createHlsSession(key: string, abs: string, info: MediaInfo) {
  const existing = sessions.get(key);
  if (existing) return existing;
  if (!info.video || !info.duration) throw new Error("Cannot transcode a file without a known video duration");
  const dir = jobDir(key);
  await ensureDir(dir);
  const meta: SessionMeta = {
    abs,
    duration: info.duration,
    videoIndex: info.video.index,
    audioIndex: info.audio?.index ?? null,
    height: info.video.height ?? 720,
  };
  await writeJsonAtomic(path.join(dir, "session.json"), meta);
  return registerSession(key, dir, meta);
}

function registerSession(key: string, dir: string, meta: SessionMeta) {
  const session: HlsSession = {
    key,
    dir,
    meta,
    segments: Math.max(1, Math.ceil(meta.duration / SEG - 0.01)),
    run: null,
    lastAccess: Date.now(),
    encoder: process.platform === "darwin" ? "videotoolbox" : "x264",
    failures: 0,
  };
  sessions.set(key, session);
  return session;
}

async function getSession(key: string) {
  const existing = sessions.get(key);
  if (existing) return existing;
  const dir = jobDir(key);
  const meta = await readJson<SessionMeta>(path.join(dir, "session.json"));
  if (!meta) return null;
  return registerSession(key, dir, meta);
}

export async function hlsPlaylist(key: string) {
  const s = await getSession(key);
  if (!s) return null;
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    `#EXT-X-TARGETDURATION:${SEG + 1}`,
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-INDEPENDENT-SEGMENTS",
  ];
  for (let i = 0; i < s.segments; i++) {
    const len = i === s.segments - 1 ? s.meta.duration - SEG * i : SEG;
    lines.push(`#EXTINF:${Math.max(0.1, len).toFixed(6)},`, `seg_${String(i).padStart(5, "0")}.ts`);
  }
  lines.push("#EXT-X-ENDLIST", "");
  return lines.join("\n");
}

function segPath(s: HlsSession, i: number) {
  return path.join(s.dir, `seg_${String(i).padStart(5, "0")}.ts`);
}

function bitrateFor(height: number) {
  if (height >= 1440) return "10M";
  if (height >= 1080) return "6M";
  if (height >= 720) return "3500k";
  if (height >= 480) return "2M";
  return "1200k";
}

function startRun(s: HlsSession, start: number) {
  stopRun(s);
  // Keep the number of concurrent encoders bounded: stop the least recently used one.
  const active = [...sessions.values()].filter((x) => x.run && !x.run.exited && x !== s);
  if (active.length >= MAX_ACTIVE_RUNS) {
    active.sort((a, b) => a.lastAccess - b.lastAccess);
    stopRun(active[0]);
  }

  const t = start * SEG;
  const { meta } = s;
  const args = ["-hide_banner", "-nostdin", "-loglevel", "error", "-y"];
  if (t > 0) args.push("-ss", String(t));
  args.push("-i", meta.abs, "-map", `0:${meta.videoIndex}`);
  if (meta.audioIndex != null) args.push("-map", `0:${meta.audioIndex}`);
  args.push("-sn", "-dn", "-map_metadata", "-1");
  args.push("-vf", "scale=-2:'min(1080,ih)':flags=bicubic,format=yuv420p");
  if (s.encoder === "videotoolbox") {
    args.push("-c:v", "h264_videotoolbox", "-b:v", bitrateFor(Math.min(1080, meta.height)), "-profile:v", "high");
    args.push("-allow_sw", "1");
  } else {
    args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-profile:v", "high");
  }
  args.push("-force_key_frames", `expr:gte(t,n_forced*${SEG})`);
  if (meta.audioIndex != null) args.push("-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000");
  args.push(
    "-f",
    "hls",
    "-hls_time",
    String(SEG),
    "-hls_list_size",
    "0",
    "-hls_flags",
    "temp_file",
    "-hls_segment_type",
    "mpegts",
    "-start_number",
    String(start),
    "-hls_segment_filename",
    path.join(s.dir, "seg_%05d.ts"),
  );
  if (t > 0) args.push("-output_ts_offset", String(t));
  args.push(path.join(s.dir, "run.m3u8"));

  const proc = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
  const run: Run = { proc, start, cursor: start, exited: false, code: null, stderr: "" };
  proc.stderr?.on("data", (d) => {
    run.stderr = (run.stderr + d).slice(-4000);
  });
  proc.on("error", (err) => {
    run.exited = true;
    run.stderr += String(err);
  });
  proc.on("close", (code) => {
    run.exited = true;
    run.code = code;
    if (code !== 0 && code !== null && run.cursor === run.start) {
      s.failures++;
      if (s.encoder === "videotoolbox") s.encoder = "x264";
      console.error(`[lui] transcode failed (${s.key} @${start}): ${run.stderr.trim().slice(-500)}`);
    }
  });
  s.run = run;
}

function stopRun(s: HlsSession) {
  if (s.run && !s.run.exited) s.run.proc.kill("SIGKILL");
  s.run = null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Return the path of segment `i`, encoding it if needed. */
export async function hlsSegment(key: string, i: number, signal: AbortSignal) {
  const s = await getSession(key);
  if (!s || i < 0 || i >= s.segments) return null;
  const file = segPath(s, i);
  s.lastAccess = Date.now();
  if (existsSync(file)) return file;

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !signal.aborted) {
    if (existsSync(file)) return file;
    const run = s.run;
    if (run) {
      while (existsSync(segPath(s, run.cursor))) run.cursor++;
    }
    if (s.failures >= 3) throw new Error("Transcoding failed repeatedly");
    // No encoder, it stopped, or the request is behind / far ahead of it: restart there.
    if (!run || run.exited || i < run.start || i > run.cursor + LOOKAHEAD) startRun(s, i);
    await sleep(120);
  }
  return existsSync(file) ? file : null;
}
