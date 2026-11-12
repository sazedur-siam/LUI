/**
 * Progress backup files. Lessons are matched by relative path, because local
 * (sha1) and device (cyrb53) courses hash the same files to different ids.
 */
import { flatLessons } from "./progress";
import type { Course, CourseProgress, LessonProgress } from "./types";

export const PROGRESS_FILE_VERSION = 1;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface ProgressFile {
  app: "lui";
  version: number;
  exportedAt: string;
  course: { title: string; folderName: string; lessonCount: number };
  progress: CourseProgress;
  /** lessonId → path relative to the course folder. */
  lessonPaths: Record<string, string>;
}

export interface MergeSummary {
  /** Lessons in the file that exist in this course. */
  matched: number;
  /** Lessons in the file that don't exist here (renamed / removed). */
  unmatched: number;
  /** Matched lessons marked complete in the file. */
  completedInFile: number;
  /** Lessons whose stored progress changes. */
  changed: number;
  lastLessonTitle: string | null;
}

export function exportProgress(course: Course, progress: CourseProgress, folderName: string): ProgressFile {
  const wanted = new Set(Object.keys(progress.lessons));
  if (progress.lastLessonId) wanted.add(progress.lastLessonId);
  const lessonPaths: Record<string, string> = {};
  const lessons: Record<string, LessonProgress> = {};
  for (const l of flatLessons(course)) {
    if (!wanted.has(l.id)) continue;
    lessonPaths[l.id] = l.path;
    if (progress.lessons[l.id]) lessons[l.id] = progress.lessons[l.id];
  }
  return {
    app: "lui",
    version: PROGRESS_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    course: { title: course.title, folderName, lessonCount: course.lessonCount },
    progress: { lessons, lastLessonId: progress.lastLessonId, lastOpenedAt: progress.lastOpenedAt },
    lessonPaths,
  };
}

export function parseProgressFile(text: string): ProgressFile {
  if (text.length > MAX_FILE_BYTES) throw new Error("That file is too large to be a LUI progress backup.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const file = data as Partial<ProgressFile>;
  if (file?.app !== "lui" || typeof file.version !== "number") throw new Error("That isn't a LUI progress backup.");
  if (file.version > PROGRESS_FILE_VERSION) throw new Error("This backup was made by a newer version of LUI.");
  if (!file.progress || typeof file.progress.lessons !== "object" || typeof file.lessonPaths !== "object") {
    throw new Error("The backup is missing its progress data.");
  }
  return file as ProgressFile;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);

/** Merge a backup into current progress. Completed never goes back to incomplete; newer edits win otherwise. */
export function mergeProgress(course: Course, current: CourseProgress, file: ProgressFile) {
  const lessons = flatLessons(course);
  const idByPath = new Map(lessons.map((l) => [l.path, l.id]));
  const titleById = new Map(lessons.map((l) => [l.id, l.title]));
  const merged: CourseProgress = { ...current, lessons: { ...current.lessons } };
  const summary: MergeSummary = { matched: 0, unmatched: 0, completedInFile: 0, changed: 0, lastLessonTitle: null };

  const resolve = (fileId: string) => {
    const path = file.lessonPaths[fileId];
    return (path && idByPath.get(path)) ?? (titleById.has(fileId) ? fileId : null);
  };

  for (const [fileId, incoming] of Object.entries(file.progress.lessons)) {
    const id = resolve(fileId);
    if (!id || !incoming || typeof incoming !== "object") {
      summary.unmatched++;
      continue;
    }
    summary.matched++;
    if (incoming.completed === true) summary.completedInFile++;

    const mine = merged.lessons[id];
    const theirsNewer = (num(incoming.updatedAt) ?? 0) > (mine?.updatedAt ?? 0);
    const next: LessonProgress = {
      ...(mine ?? { completed: false, updatedAt: 0 }),
      completed: !!mine?.completed || incoming.completed === true,
      updatedAt: Math.max(mine?.updatedAt ?? 0, num(incoming.updatedAt) ?? 0),
    };
    if (theirsNewer || !mine) {
      if (num(incoming.position) !== undefined) next.position = num(incoming.position);
      if (num(incoming.duration) !== undefined) next.duration = num(incoming.duration);
      if (num(incoming.page) !== undefined) next.page = num(incoming.page);
      if (typeof incoming.notes === "string") next.notes = incoming.notes;
    }
    if (JSON.stringify(next) !== JSON.stringify(mine)) summary.changed++;
    merged.lessons[id] = next;
  }

  const fileLast = file.progress.lastLessonId ? resolve(file.progress.lastLessonId) : null;
  if (fileLast && (num(file.progress.lastOpenedAt) ?? 0) > (current.lastOpenedAt ?? 0)) {
    merged.lastLessonId = fileLast;
    merged.lastOpenedAt = file.progress.lastOpenedAt;
  }
  summary.lastLessonTitle = merged.lastLessonId ? (titleById.get(merged.lastLessonId) ?? null) : null;
  return { merged, summary };
}

export function describeSummary(file: ProgressFile, s: MergeSummary) {
  const lines = [
    `Backup of “${file.course.title}” from ${new Date(file.exportedAt).toLocaleString()}.`,
    `${s.matched} lessons matched (${s.completedInFile} completed in the backup), ${s.changed} will change.`,
  ];
  if (s.unmatched) lines.push(`${s.unmatched} lessons in the backup no longer exist here and will be skipped.`);
  if (s.lastLessonTitle) lines.push(`Continue point: “${s.lastLessonTitle}”.`);
  lines.push("", "Completed lessons stay completed. Apply?");
  return lines.join("\n");
}

export function backupFileName(title: string) {
  const safe = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `${safe || "Course"} – progress.json`;
}
