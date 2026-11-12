import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { CourseMenu } from "@/components/course-menu";
import { CourseOverview, OverviewSkeleton } from "@/components/course-overview";
import { ServerSourceProvider } from "@/components/source/course-source";
import { getCourse } from "@/lib/server/courses";
import { getDurations } from "@/lib/server/durations";
import { getCourseRecord, getProgress } from "@/lib/server/store";

export async function generateMetadata({ params }: PageProps<"/course/[courseId]">): Promise<Metadata> {
  const { courseId } = await params;
  const record = await getCourseRecord(courseId);
  return { title: record?.title ?? "Course" };
}

export default function CoursePage({ params }: PageProps<"/course/[courseId]">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Suspense fallback={<OverviewSkeleton />}>
          <Overview params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Overview({ params }: { params: PageProps<"/course/[courseId]">["params"] }) {
  const { courseId } = await params;
  await connection();
  const course = await getCourse(courseId);
  if (!course) notFound();
  const [progress, { durations, pending }] = await Promise.all([getProgress(courseId), getDurations(course)]);

  return (
    <ServerSourceProvider courseId={course.id}>
      <CourseOverview
        course={course}
        progress={progress}
        durations={durations}
        durationsPending={pending > 0}
        basePath={`/course/${course.id}`}
        location={course.root}
        menu={<CourseMenu courseId={course.id} title={course.title} afterRemove="/" />}
      />
    </ServerSourceProvider>
  );
}
