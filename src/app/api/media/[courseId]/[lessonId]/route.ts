import path from "node:path";

import { fileUrl } from "@/lib/files";
import { findLesson, getCourse } from "@/lib/server/courses";
import { probe } from "@/lib/server/ffmpeg";
import {
  createHlsSession,
  decide,
  describe,
  jobKey,
  parseCaps,
  remuxFileName,
  startRemux,
} from "@/lib/server/media";
import { resolveInside } from "@/lib/server/paths";
import type { PlaybackPlan, SubtitleTrack } from "@/lib/types";

/**
 * Decide how a video/audio lesson (or resource) should be played in this
 * browser: directly, remuxed to MP4, or transcoded to HLS on demand.
 *
 * Query: caps=<comma list>, force=remux|transcode, file=<resource path>
 */
export async function GET(request: Request, ctx: RouteContext<"/api/media/[courseId]/[lessonId]">) {
  const { courseId, lessonId } = await ctx.params;
  const url = new URL(request.url);
  const course = await getCourse(courseId);
  if (!course) return Response.json({ error: "Unknown course" }, { status: 404 });
  const found = findLesson(course, lessonId);
  if (!found) return Response.json({ error: "Unknown lesson" }, { status: 404 });

  // Resources attached to the lesson can be played too.
  const resourcePath = url.searchParams.get("file");
  const relPath =
    resourcePath && found.lesson.resources.some((r) => r.path === resourcePath) ? resourcePath : found.lesson.path;
  const fileName = path.posix.basename(relPath);

  let abs: string;
  try {
    abs = await resolveInside(course.root, relPath);
  } catch {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  let info;
  try {
    info = await probe(abs);
  } catch (err) {
    return Response.json({ error: `Could not read this media file. ${String(err)}` }, { status: 422 });
  }
  if (!info.video && !info.audio) {
    return Response.json({ error: "This file has no playable audio or video." }, { status: 422 });
  }

  const caps = parseCaps(url.searchParams.get("caps"));
  let decision = decide(info, fileName, caps, url.searchParams.get("force"));

  const subtitles: SubtitleTrack[] =
    relPath === found.lesson.path
      ? [
          ...found.lesson.subtitles.map((s, i) => ({
            label: subtitleLabel(s, i),
            lang: langFromName(s),
            src: `/api/subs/${courseId}?lesson=${lessonId}&side=${i}`,
          })),
          ...info.subtitles.map((s, i) => ({
            label: s.tags?.title || s.tags?.language?.toUpperCase() || `Track ${i + 1}`,
            lang: s.tags?.language,
            src: `/api/subs/${courseId}?lesson=${lessonId}&stream=${s.index}`,
          })),
        ]
      : [];

  // English first, then alphabetical: courses often ship a dozen+ languages.
  const isEnglish = (t: SubtitleTrack) => /^(en|eng)$/i.test(t.lang ?? "") || /english/i.test(t.label);
  subtitles.sort((a, b) => Number(isEnglish(b)) - Number(isEnglish(a)) || a.label.localeCompare(b.label));

  const base = {
    duration: info.duration,
    hasVideo: !!info.video,
    subtitles,
    summary: describe(info, fileName),
  };

  if (decision.mode === "remux") {
    const key = await jobKey(abs, decision);
    const job = startRemux(key, abs, info, decision);
    if (job.status === "error" && info.video && info.duration) {
      // Remuxing failed (odd streams, broken timestamps): transcode instead.
      decision = { mode: "transcode", audioCopy: false };
    } else {
      const plan: PlaybackPlan = {
        ...base,
        mode: "remux",
        ready: job.status === "done",
        progress: job.progress,
        src: `/api/media/out/${key}/${remuxFileName(info)}`,
        type: info.video ? "video/mp4" : "audio/mp4",
        error: job.status === "error" ? job.error : undefined,
      };
      return Response.json(plan);
    }
  }

  if (decision.mode === "transcode") {
    const key = await jobKey(abs, decision);
    await createHlsSession(key, abs, info);
    const plan: PlaybackPlan = {
      ...base,
      mode: "transcode",
      ready: true,
      src: `/api/media/out/${key}/index.m3u8`,
      type: "application/vnd.apple.mpegurl",
    };
    return Response.json(plan);
  }

  const plan: PlaybackPlan = {
    ...base,
    mode: "direct",
    ready: true,
    src: fileUrl(courseId, relPath),
    type: "",
  };
  return Response.json(plan);
}

function langFromName(file: string) {
  const m = /\.([a-z]{2,3})(?:-[a-z]{2})?\.(?:srt|vtt)$/i.exec(file);
  return m?.[1]?.toLowerCase();
}

function subtitleLabel(file: string, i: number) {
  const lang = langFromName(file);
  if (lang) {
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang.toUpperCase();
    } catch {
      return lang.toUpperCase();
    }
  }
  return i === 0 ? "Subtitles" : `Subtitles ${i + 1}`;
}
