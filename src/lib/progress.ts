import type { Course, CourseAccess, CourseProgress, Lesson, LessonProgress, Module } from "./types";

type ProgressMap = Record<string, LessonProgress | undefined>;

export function flatLessons(course: Pick<Course, "modules">): Lesson[] {
  return course.modules.flatMap((m) => m.lessons);
}

export function countCompleted(lessons: Lesson[], progress: ProgressMap) {
  let n = 0;
  for (const l of lessons) if (progress[l.id]?.completed) n++;
  return n;
}

export function percent(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function moduleStats(module: Module, progress: ProgressMap) {
  const done = countCompleted(module.lessons, progress);
  return { done, total: module.lessons.length, percent: percent(done, module.lessons.length) };
}

export function courseStats(course: Pick<Course, "modules">, progress: ProgressMap) {
  const lessons = flatLessons(course);
  const done = countCompleted(lessons, progress);
  return { done, total: lessons.length, percent: percent(done, lessons.length) };
}

/** The lesson "Continue" should open: the last one opened if unfinished, else the next unfinished one. */
export function resumeLesson(
  course: Pick<Course, "modules">,
  progress: CourseProgress,
  access?: CourseAccess,
): Lesson | null {
  const lesson = resumeCandidate(course, progress);
  if (access !== "guided" || !lesson) return lesson;
  // Never resume into a locked lesson: fall back to the first unfinished one.
  const frontier = flatLessons(course).find((l) => !progress.lessons[l.id]?.completed);
  if (!frontier || progress.lessons[lesson.id]?.completed) return lesson;
  const lessons = flatLessons(course);
  return lessons.indexOf(lesson) <= lessons.indexOf(frontier) ? lesson : frontier;
}

function resumeCandidate(course: Pick<Course, "modules">, progress: CourseProgress): Lesson | null {
  const lessons = flatLessons(course);
  if (lessons.length === 0) return null;
  const lastIndex = progress.lastLessonId ? lessons.findIndex((l) => l.id === progress.lastLessonId) : -1;
  if (lastIndex >= 0) {
    if (!progress.lessons[lessons[lastIndex].id]?.completed) return lessons[lastIndex];
    const after = lessons.slice(lastIndex + 1).find((l) => !progress.lessons[l.id]?.completed);
    if (after) return after;
  }
  return lessons.find((l) => !progress.lessons[l.id]?.completed) ?? lessons[0];
}

/** Group consecutive modules that share a topic group ("Python", "NLP", ...). */
export function groupModules<M extends Pick<Module, "group">>(modules: M[]) {
  const groups: { name: string | null; modules: M[] }[] = [];
  for (const m of modules) {
    const last = groups[groups.length - 1];
    if (last && last.name === m.group) last.modules.push(m);
    else groups.push({ name: m.group, modules: [m] });
  }
  return groups;
}

export function sumDurations(lessons: Lesson[], durations: Record<string, number>) {
  let total = 0;
  for (const l of lessons) total += durations[l.id] ?? 0;
  return total;
}

export interface ProgressPatch {
  lessonId: string;
  completed?: boolean;
  position?: number;
  duration?: number;
  page?: number;
  notes?: string;
  opened?: boolean;
}

export const MAX_NOTES_LENGTH = 20_000;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/** Apply one progress update in place (shared by the server store and device storage). */
export function applyProgressPatch(course: CourseProgress, patch: ProgressPatch, now = Date.now()) {
  const prev: LessonProgress = course.lessons[patch.lessonId] ?? { completed: false, updatedAt: 0 };
  const next: LessonProgress = { ...prev, updatedAt: now };
  if (typeof patch.completed === "boolean") next.completed = patch.completed;
  if (isFiniteNumber(patch.position)) next.position = patch.position;
  if (isFiniteNumber(patch.duration)) next.duration = patch.duration;
  if (isFiniteNumber(patch.page)) next.page = patch.page;
  if (typeof patch.notes === "string") {
    const notes = patch.notes.slice(0, MAX_NOTES_LENGTH);
    if (notes.trim()) next.notes = notes;
    else delete next.notes;
  }
  course.lessons[patch.lessonId] = next;
  if (patch.opened) {
    course.lastLessonId = patch.lessonId;
    course.lastOpenedAt = now;
  }
  return next;
}

/** Find a lesson with its module and neighbours (client- and server-safe). */
export function locateLesson(course: Pick<Course, "modules">, lessonId: string) {
  const lessons = flatLessons(course);
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
