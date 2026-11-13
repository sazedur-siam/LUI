"use client";

import { LockIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useMemo } from "react";

import { StatusNotice } from "@/components/status-notice";
import { Button } from "@/components/ui/button";
import { type LessonAccess, lessonAccess } from "@/lib/lesson-access";
import type { Course, CourseAccess, Lesson } from "@/lib/types";

import { useProgress } from "./progress-context";

const Ctx = createContext<LessonAccess | null>(null);

/**
 * Derives which lessons are open from live (optimistic) progress, so completing
 * a lesson unlocks the next one immediately, before the server store catches up.
 */
export function LessonAccessProvider({
  course,
  access,
  children,
}: {
  course: Pick<Course, "modules">;
  access: CourseAccess | undefined;
  children: React.ReactNode;
}) {
  const { lessons } = useProgress();
  const value = useMemo(() => lessonAccess(course, lessons, access), [course, lessons, access]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLessonAccess(): LessonAccess {
  return (
    useContext(Ctx) ?? { guided: false, isUnlocked: () => true, frontier: null, blockerFor: () => null }
  );
}

/** Shown instead of a lesson that a guided course hasn't unlocked yet. */
export function LockedLesson({
  lesson,
  blocker,
  frontier,
  basePath,
}: {
  lesson: Lesson;
  blocker: Lesson | null;
  frontier: Lesson | null;
  basePath: string;
}) {
  return (
    <StatusNotice icon={<LockIcon />} title="Locked" className="py-16">
      <p>
        <span className="font-medium text-foreground">{lesson.title}</span> unlocks after you finish{" "}
        <span className="font-medium text-foreground">{blocker?.title ?? "the lessons before it"}</span>. This course
        is guided, so lessons open in order.
      </p>
      {frontier && (
        <Button asChild>
          <Link href={`${basePath}/learn/${frontier.id}`}>Go to {frontier.title}</Link>
        </Button>
      )}
    </StatusNotice>
  );
}
