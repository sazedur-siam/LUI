"use server";

import os from "node:os";
import path from "node:path";

import { getCourse, invalidateCourse } from "@/lib/server/courses";
import { courseTitleFromPath } from "@/lib/server/scanner";
import { exportProgress, type MergeSummary, mergeProgress, parseProgressFile, type ProgressFile } from "@/lib/progress-transfer";
import {
  addCourse,
  getProgress,
  relocateCourse,
  removeCourse,
  replaceProgress,
  resetProgress,
  setCourseAccess,
} from "@/lib/server/store";
import type { CourseAccess } from "@/lib/types";

export async function addCourseAction(
  rawPath: string,
  access: CourseAccess = "open",
): Promise<{ id?: string; error?: string }> {
  const input = rawPath.trim().replace(/^["']|["']$/g, "");
  if (!input) return { error: "Enter a folder path." };
  const expanded = input.replace(/^~(?=$|\/)/, os.homedir());
  if (!path.isAbsolute(expanded)) return { error: "Use an absolute path, e.g. /Users/you/Courses/My course" };
  try {
    const record = await addCourse(expanded, courseTitleFromPath(expanded), access === "guided" ? "guided" : "open");
    invalidateCourse(record.id);
    const course = await getCourse(record.id, { fresh: true });
    if (!course || course.lessonCount === 0) {
      await removeCourse(record.id);
      return { error: "No lessons found in that folder." };
    }
    return { id: record.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function relocateCourseAction(id: string, rawPath: string): Promise<{ id?: string; error?: string }> {
  const input = rawPath.trim().replace(/^["']|["']$/g, "");
  if (!input) return { error: "Enter a folder path." };
  const expanded = input.replace(/^~(?=$|\/)/, os.homedir());
  if (!path.isAbsolute(expanded)) return { error: "Use an absolute path, e.g. /Users/you/Courses/My course" };
  try {
    const { previous } = await relocateCourse(id, expanded);
    invalidateCourse(id);
    const course = await getCourse(id, { fresh: true });
    if (!course || course.lessonCount === 0) {
      await relocateCourse(id, previous);
      invalidateCourse(id);
      return { error: "No lessons found in that folder." };
    }
    return { id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setCourseAccessAction(id: string, access: CourseAccess) {
  await setCourseAccess(id, access === "guided" ? "guided" : "open");
}

export async function removeCourseAction(id: string) {
  await removeCourse(id);
  invalidateCourse(id);
}

export async function rescanCourseAction(id: string) {
  invalidateCourse(id);
  const course = await getCourse(id, { fresh: true });
  return { lessons: course?.lessonCount ?? 0 };
}

export async function resetProgressAction(id: string) {
  await resetProgress(id);
}

export async function exportProgressAction(id: string): Promise<{ file?: ProgressFile; error?: string }> {
  const course = await getCourse(id);
  if (!course) return { error: "Course not found." };
  return { file: exportProgress(course, await getProgress(id), path.basename(course.root)) };
}

/** Merge a backup into a local course. With `apply: false` it only reports what would change. */
export async function importProgressAction(
  id: string,
  text: string,
  apply: boolean,
): Promise<{ summary?: MergeSummary; file?: ProgressFile; error?: string }> {
  try {
    const course = await getCourse(id);
    if (!course) return { error: "Course not found." };
    const file = parseProgressFile(text);
    const { merged, summary } = mergeProgress(course, await getProgress(id), file);
    if (apply) await replaceProgress(id, merged);
    return { summary, file };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
