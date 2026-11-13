"use client";

import type { CSSProperties } from "react";

import { ServerSourceProvider } from "@/components/source/course-source";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Course, CourseAccess, CourseProgress } from "@/lib/types";

import { CourseSidebar } from "./course-sidebar";
import { LessonAccessProvider } from "./lesson-access";
import { ProgressProvider, type ProgressSaver } from "./progress-context";

/** Sidebar + content frame shared by server (local) and device courses. */
export function LearnFrame({
  course,
  progress,
  durations,
  basePath,
  access,
  save,
  sidebarSlot,
  children,
}: {
  course: Course;
  progress: CourseProgress;
  durations: Record<string, number>;
  basePath: string;
  access?: CourseAccess;
  save?: ProgressSaver;
  sidebarSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ProgressProvider courseId={course.id} initial={progress} save={save}>
      <LessonAccessProvider course={course} access={access}>
        <SidebarProvider style={{ "--sidebar-width": "21rem" } as CSSProperties}>
          <CourseSidebar course={course} durations={durations} basePath={basePath} headerSlot={sidebarSlot} />
          <SidebarInset className="min-w-0 bg-white">{children}</SidebarInset>
        </SidebarProvider>
      </LessonAccessProvider>
    </ProgressProvider>
  );
}

export function LearnShell({
  course,
  progress,
  durations,
  access,
  children,
}: {
  course: Course;
  progress: CourseProgress;
  durations: Record<string, number>;
  access?: CourseAccess;
  children: React.ReactNode;
}) {
  return (
    <ServerSourceProvider courseId={course.id}>
      <LearnFrame
        course={course}
        progress={progress}
        durations={durations}
        basePath={`/course/${course.id}`}
        access={access}
      >
        {children}
      </LearnFrame>
    </ServerSourceProvider>
  );
}
