import "server-only";

import type { Course, Lesson, Module } from "@/lib/types";

import { scanCourse } from "./scanner";
import { getCourseRecord } from "./store";

const TTL_MS = 15_000;

const g = globalThis as unknown as {
  __luiCourses?: Map<string, { at: number; course: Promise<Course> }>;
};
const cache = (g.__luiCourses ??= new Map());

export async function getCourse(id: string, opts?: { fresh?: boolean }): Promise<Course | null> {
  const record = await getCourseRecord(id);
  if (!record) return null;
  const hit = cache.get(id);
  if (!opts?.fresh && hit && Date.now() - hit.at < TTL_MS) return hit.course;
  const course = scanCourse(record.id, record.root, record.title);
  cache.set(id, { at: Date.now(), course });
  course.catch(() => cache.delete(id));
  return course;
}

export function invalidateCourse(id: string) {
  cache.delete(id);
}

export function allLessons(course: Course): Lesson[] {
  return course.modules.flatMap((m) => m.lessons);
}

export function findLesson(course: Course, lessonId: string) {
  const lessons = allLessons(course);
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index < 0) return null;
  const lesson = lessons[index];
  const mod = course.modules.find((m) => m.id === lesson.moduleId) as Module;
  return {
    lesson,
    module: mod,
    index,
    total: lessons.length,
    prev: lessons[index - 1] ?? null,
    next: lessons[index + 1] ?? null,
  };
}

/** Every file path that belongs to the course (lessons, resources, subtitles). */
export function courseFileSet(course: Course) {
  const set = new Set<string>();
  for (const l of allLessons(course)) {
    set.add(l.path);
    for (const r of l.resources) set.add(r.path);
    for (const s of l.subtitles) set.add(s);
  }
  return set;
}
