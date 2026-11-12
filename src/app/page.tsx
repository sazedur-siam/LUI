import { FolderPlusIcon } from "lucide-react";
import { connection } from "next/server";
import { type CSSProperties, Suspense } from "react";

import { AddCourseDialog } from "@/components/add-course-dialog";
import { AppHeader } from "@/components/app-header";
import { CourseCard } from "@/components/course-card";
import { CourseMenu } from "@/components/course-menu";
import { DeviceLibrary } from "@/components/device/device-library";
import { OpenFolderButton } from "@/components/device/open-folder";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { courseStats, resumeLesson } from "@/lib/progress";
import { getCourse } from "@/lib/server/courses";
import { serverFilesEnabled } from "@/lib/server/mode";
import { getProgress, listCourses } from "@/lib/server/store";

export default function LibraryPage() {
  return (
    <>
      <AppHeader>
        <Suspense>
          <HeaderActions />
        </Suspense>
      </AppHeader>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">My courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick up right where you left off.</p>
        </div>
        <Suspense fallback={<GridSkeleton />}>
          <Library />
        </Suspense>
      </main>
    </>
  );
}

async function HeaderActions() {
  await connection();
  if (!serverFilesEnabled()) return <OpenFolderButton />;
  return (
    <>
      <OpenFolderButton variant="outline" label="Open in browser" />
      <AddCourseDialog />
    </>
  );
}

async function Library() {
  await connection();
  const hosted = !serverFilesEnabled();
  if (hosted) return <DeviceLibrary hosted />;

  const records = await listCourses();
  const items = await Promise.all(
    records.map(async (record) => {
      const [course, progress] = await Promise.all([getCourse(record.id).catch(() => null), getProgress(record.id)]);
      return { record, course, progress };
    }),
  );

  return (
    <>
      {items.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ record, course, progress }) => {
            const stats = course ? courseStats(course, progress.lessons) : null;
            const resume = course ? resumeLesson(course, progress) : null;
            return (
              <CourseCard
                key={record.id}
                id={record.id}
                href={`/course/${record.id}`}
                title={record.title}
                meta={course ? `${course.modules.length} modules · ${course.lessonCount} lessons` : "Folder unavailable"}
                stats={stats}
                resume={resume && { href: `/course/${record.id}/learn/${resume.id}`, title: resume.title }}
                started={(stats?.done ?? 0) > 0 || !!progress.lastLessonId}
                menu={<CourseMenu courseId={record.id} title={record.title} />}
              />
            );
          })}
        </div>
      )}
      <DeviceLibrary hosted={false} />
    </>
  );
}

function EmptyLibrary() {
  return (
    <Empty className="rounded-2xl border border-dashed py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="tint size-12 rounded-xl" style={{ "--c": "#1E88E5" } as CSSProperties}>
          <FolderPlusIcon className="size-6" />
        </EmptyMedia>
        <EmptyTitle>No courses yet</EmptyTitle>
        <EmptyDescription>
          Point LUI at a folder of videos, PDFs and notes. It becomes a course with modules, lessons and progress
          tracking.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <AddCourseDialog />
      </EmptyContent>
    </Empty>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-52 rounded-2xl" />
      ))}
    </div>
  );
}
