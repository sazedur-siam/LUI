/**
 * Guided courses unlock lessons in order. The lock state is always derived
 * from progress, never stored:
 *
 *   frontier = first lesson that isn't completed (none if all are)
 *   unlocked = completed OR index <= frontier
 *
 * Shared by client and server; must not import lib/server/*.
 */
import { flatLessons } from "./progress";
import type { Course, CourseAccess, Lesson, LessonProgress } from "./types";

export interface LessonAccess {
  guided: boolean;
  isUnlocked: (lessonId: string) => boolean;
  /** The first unfinished lesson (where a guided course "is"), or null when everything is done. */
  frontier: Lesson | null;
  /** For a locked lesson: the lesson right before it, which must be finished first. */
  blockerFor: (lessonId: string) => Lesson | null;
}

const OPEN: LessonAccess = { guided: false, isUnlocked: () => true, frontier: null, blockerFor: () => null };

export function lessonAccess(
  course: Pick<Course, "modules">,
  progress: Record<string, LessonProgress | undefined>,
  access: CourseAccess | undefined,
): LessonAccess {
  if (access !== "guided") return OPEN;
  const lessons = flatLessons(course);
  const frontierIndex = lessons.findIndex((l) => !progress[l.id]?.completed);
  const indexById = new Map(lessons.map((l, i) => [l.id, i]));
  const isUnlocked = (id: string) => {
    const i = indexById.get(id);
    if (i === undefined || frontierIndex < 0) return true;
    return !!progress[id]?.completed || i <= frontierIndex;
  };
  return {
    guided: true,
    isUnlocked,
    frontier: frontierIndex >= 0 ? lessons[frontierIndex] : null,
    blockerFor: (id) => {
      if (isUnlocked(id)) return null;
      const i = indexById.get(id) ?? 0;
      return lessons[i - 1] ?? null;
    },
  };
}
