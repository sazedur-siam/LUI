"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { CourseOverview, OverviewSkeleton } from "@/components/course-overview";
import { LearnFrame } from "@/components/learn/learn-shell";
import { LessonView } from "@/components/learn/lesson-view";
import { locateLesson, resumeLesson } from "@/lib/progress";

import { DeviceCourseGate, useDeviceCourse } from "./device-course";
import { DeviceCourseMenu } from "./device-course-menu";

function useCourseIdParam() {
  return useParams<{ courseId: string }>().courseId;
}

export function DeviceOverviewPage() {
  const courseId = useCourseIdParam();
  return (
    <DeviceCourseGate courseId={courseId} fallback={<OverviewSkeleton />}>
      {(ctx) => (
        <CourseOverview
          course={ctx.course}
          progress={ctx.progress}
          durations={ctx.durations}
          durationsPending={ctx.durationsPending}
          basePath={`/device/${courseId}`}
          location={`“${ctx.record.folderName}” on this device`}
          device
          access={ctx.record.access}
          menu={<DeviceCourseMenu record={ctx.record} afterRemove="/" />}
        />
      )}
    </DeviceCourseGate>
  );
}

export function DeviceLearnLayout({ children }: { children: React.ReactNode }) {
  const courseId = useCourseIdParam();
  return (
    <div className="flex min-h-svh flex-col">
      <DeviceCourseGate courseId={courseId}>
        {(ctx) => (
          <LearnFrame
            course={ctx.course}
            progress={ctx.progress}
            durations={ctx.durations}
            basePath={`/device/${courseId}`}
            access={ctx.record.access}
            save={ctx.save}
          >
            {children}
          </LearnFrame>
        )}
      </DeviceCourseGate>
    </div>
  );
}

export function DeviceLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { course } = useDeviceCourse();
  const found = locateLesson(course, lessonId);
  if (!found) notFound();
  const { lesson, module, index, total, prev, next } = found;
  return (
    <LessonView
      key={lesson.id}
      lesson={lesson}
      moduleTitle={module.title}
      moduleNumber={module.number}
      index={index}
      total={total}
      prev={prev && { id: prev.id, title: prev.title }}
      next={next && { id: next.id, title: next.title }}
    />
  );
}

/** /device/:id/learn → the lesson to resume. */
export function DeviceResumePage() {
  const router = useRouter();
  const { course, progress, record } = useDeviceCourse();
  useEffect(() => {
    const lesson = resumeLesson(course, progress, record.access);
    if (lesson) router.replace(`/device/${course.id}/learn/${lesson.id}`);
  }, [course, progress, record.access, router]);
  return null;
}
