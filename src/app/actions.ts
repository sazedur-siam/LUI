"use server";

import os from "node:os";
import path from "node:path";

import { getCourse, invalidateCourse } from "@/lib/server/courses";
import { courseTitleFromPath } from "@/lib/server/scanner";
import { addCourse, removeCourse, resetProgress } from "@/lib/server/store";

export async function addCourseAction(rawPath: string): Promise<{ id?: string; error?: string }> {
  const input = rawPath.trim().replace(/^["']|["']$/g, "");
  if (!input) return { error: "Enter a folder path." };
  const expanded = input.replace(/^~(?=$|\/)/, os.homedir());
  if (!path.isAbsolute(expanded)) return { error: "Use an absolute path, e.g. /Users/you/Courses/My course" };
  try {
    const record = await addCourse(expanded, courseTitleFromPath(expanded));
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
