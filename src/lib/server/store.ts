import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import type { CourseProgress, CourseRecord, LessonProgress } from "@/lib/types";

import { SERVER_FILES_DISABLED_MESSAGE, serverFilesEnabled } from "./mode";
import { DATA_DIR, hashId, readJson, writeJsonAtomic } from "./paths";

interface Db {
  courses: CourseRecord[];
  progress: Record<string, CourseProgress>;
}

const DB_FILE = path.join(DATA_DIR, "db.json");

// Survive dev-server hot reloads.
const g = globalThis as unknown as {
  __luiDb?: Promise<Db>;
  __luiDbWrite?: Promise<void>;
  __luiDbTimer?: NodeJS.Timeout;
};

function load(): Promise<Db> {
  g.__luiDb ??= readJson<Db>(DB_FILE).then((db) => ({
    courses: db?.courses ?? [],
    progress: db?.progress ?? {},
  }));
  return g.__luiDb;
}

function scheduleSave() {
  if (g.__luiDbTimer) clearTimeout(g.__luiDbTimer);
  g.__luiDbTimer = setTimeout(() => {
    g.__luiDbWrite = (g.__luiDbWrite ?? Promise.resolve())
      .then(async () => writeJsonAtomic(DB_FILE, await load()))
      .catch((err) => console.error("[lui] failed to save db", err));
  }, 250);
}

export function courseIdFor(root: string) {
  return hashId(path.resolve(root), 10);
}

export async function listCourses(): Promise<CourseRecord[]> {
  const db = await load();
  return [...db.courses].sort((a, b) => {
    const la = db.progress[a.id]?.lastOpenedAt ?? a.addedAt;
    const lb = db.progress[b.id]?.lastOpenedAt ?? b.addedAt;
    return lb - la;
  });
}

export async function getCourseRecord(id: string) {
  const db = await load();
  return db.courses.find((c) => c.id === id) ?? null;
}

export async function addCourse(rootInput: string, title: string): Promise<CourseRecord> {
  if (!serverFilesEnabled()) throw new Error(SERVER_FILES_DISABLED_MESSAGE);
  const root = path.resolve(rootInput);
  const stat = await fs.stat(root).catch(() => null);
  if (!stat?.isDirectory()) throw new Error("That folder does not exist.");
  const db = await load();
  const id = courseIdFor(root);
  const existing = db.courses.find((c) => c.id === id);
  if (existing) return existing;
  const record: CourseRecord = { id, root, title, addedAt: Date.now() };
  db.courses.push(record);
  scheduleSave();
  return record;
}

export async function removeCourse(id: string) {
  const db = await load();
  db.courses = db.courses.filter((c) => c.id !== id);
  delete db.progress[id];
  scheduleSave();
}

export async function getProgress(courseId: string): Promise<CourseProgress> {
  const db = await load();
  return db.progress[courseId] ?? { lessons: {} };
}

export interface ProgressPatch {
  lessonId: string;
  completed?: boolean;
  position?: number;
  duration?: number;
  page?: number;
  opened?: boolean;
}

export async function updateProgress(courseId: string, patch: ProgressPatch) {
  const db = await load();
  if (!db.courses.some((c) => c.id === courseId)) throw new Error("Unknown course");
  const course = (db.progress[courseId] ??= { lessons: {} });
  const prev: LessonProgress = course.lessons[patch.lessonId] ?? { completed: false, updatedAt: 0 };
  const next: LessonProgress = { ...prev, updatedAt: Date.now() };
  if (typeof patch.completed === "boolean") next.completed = patch.completed;
  if (isFiniteNumber(patch.position)) next.position = patch.position;
  if (isFiniteNumber(patch.duration)) next.duration = patch.duration;
  if (isFiniteNumber(patch.page)) next.page = patch.page;
  course.lessons[patch.lessonId] = next;
  if (patch.opened) {
    course.lastLessonId = patch.lessonId;
    course.lastOpenedAt = Date.now();
  }
  scheduleSave();
  return next;
}

export async function resetProgress(courseId: string) {
  const db = await load();
  db.progress[courseId] = { lessons: {} };
  scheduleSave();
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}
