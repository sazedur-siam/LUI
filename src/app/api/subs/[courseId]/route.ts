import fs from "node:fs/promises";
import path from "node:path";

import { findLesson, getCourse } from "@/lib/server/courses";
import { FFMPEG, run } from "@/lib/server/ffmpeg";
import { CACHE_DIR, ensureDir, hashId, resolveInside } from "@/lib/server/paths";
import { toVtt } from "@/lib/subtitles";

function vtt(text: string) {
  return new Response(text, {
    headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, max-age=3600" },
  });
}

/** WebVTT for a sidecar subtitle (?side=i) or an embedded text track (?stream=index). */
export async function GET(request: Request, ctx: RouteContext<"/api/subs/[courseId]">) {
  const { courseId } = await ctx.params;
  const url = new URL(request.url);
  const course = await getCourse(courseId);
  const found = course && findLesson(course, url.searchParams.get("lesson") ?? "");
  if (!course || !found) return new Response("Not found", { status: 404 });

  const side = url.searchParams.get("side");
  if (side != null) {
    const rel = found.lesson.subtitles[Number(side)];
    if (!rel) return new Response("Not found", { status: 404 });
    const text = await fs.readFile(await resolveInside(course.root, rel), "utf8");
    return vtt(toVtt(text, rel));
  }

  const stream = Number(url.searchParams.get("stream"));
  if (!Number.isInteger(stream) || stream < 0) return new Response("Bad request", { status: 400 });
  const abs = await resolveInside(course.root, found.lesson.path);
  const stat = await fs.stat(abs);
  const out = path.join(CACHE_DIR, "subs", `${hashId(`${abs}|${stat.size}|${stat.mtimeMs}|${stream}`, 20)}.vtt`);
  try {
    return vtt(await fs.readFile(out, "utf8"));
  } catch {
    // Not cached yet.
  }
  const result = await run(FFMPEG, ["-v", "error", "-i", abs, "-map", `0:${stream}`, "-f", "webvtt", "-"], {
    timeoutMs: 60_000,
  });
  if (result.code !== 0) return new Response("Could not extract subtitles", { status: 422 });
  await ensureDir(path.dirname(out));
  await fs.writeFile(out, result.stdout);
  return vtt(result.stdout);
}
