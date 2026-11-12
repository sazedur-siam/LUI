"use client";

import type { CSSProperties } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Course, CourseProgress } from "@/lib/types";

import { CourseSidebar } from "./course-sidebar";
import { ProgressProvider } from "./progress-context";

export function LearnShell({
  course,
  progress,
  durations,
  children,
}: {
  course: Course;
  progress: CourseProgress;
  durations: Record<string, number>;
  children: React.ReactNode;
}) {
  return (
    <ProgressProvider courseId={course.id} initial={progress}>
      <SidebarProvider style={{ "--sidebar-width": "21rem" } as CSSProperties}>
        <CourseSidebar course={course} durations={durations} />
        <SidebarInset className="min-w-0 bg-white">{children}</SidebarInset>
      </SidebarProvider>
    </ProgressProvider>
  );
}
