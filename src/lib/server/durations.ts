import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import type { Course } from "@/lib/types";

import { allLessons } from "./courses";
import { probe } from "./ffmpeg";
import { CACHE_DIR, readJson, writeJsonAtomic } from "./paths";

type DurationFile = Record<string, { size: number; d: number | null }>;

const g = globalThis as unknown as { __luiDurations?: Map<string, Promise<void>> };
const running = (g.__luiDurations ??= new Map());

function fileFor(courseId: string) {
  return path.join(CACHE_DIR, `durations-${courseId}.json`);
}

/**
 * Known media durations keyed by lesson id. Missing ones are probed in the
 * background; `pending` tells the UI whether totals are still incomplete.
 */
export async function getDurations(course: Course) {
  const cached = (await readJson<DurationFile>(fileFor(course.id))) ?? {};
  const durations: Record<string, number> = {};
  const missing: { path: string; size: number }[] = [];
  for (const l of allLessons(course)) {
    if (l.kind !== "video" && l.kind !== "audio") continue;
    const hit = cached[l.path];
    if (hit && hit.size === l.size) {
      if (hit.d != null) durations[l.id] = hit.d;
    } else {
      missing.push({ path: l.path, size: l.size });
    }
  }
  if (missing.length > 0 && !running.has(course.id)) {
    const job = probeAll(course, cached, missing).finally(() => running.delete(course.id));
    running.set(course.id, job);
  }
  return { durations, pending: missing.length };
}

async function probeAll(course: Course, cached: DurationFile, missing: { path: string; size: number }[]) {
  const queue = [...missing];
  let sinceSave = 0;
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        const abs = path.join(course.root, ...item.path.split("/"));
        await fs.access(abs);
        const info = await probe(abs);
        cached[item.path] = { size: item.size, d: info.duration };
      } catch {
        cached[item.path] = { size: item.size, d: null };
      }
      if (++sinceSave >= 25) {
        sinceSave = 0;
        await writeJsonAtomic(fileFor(course.id), cached);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  await writeJsonAtomic(fileFor(course.id), cached);
}
