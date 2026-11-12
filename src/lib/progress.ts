import type { Course, CourseProgress, Lesson, LessonProgress, Module } from "./types";

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
export function resumeLesson(course: Pick<Course, "modules">, progress: CourseProgress): Lesson | null {
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
