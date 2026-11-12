import { ArrowRightIcon, FolderPlusIcon, LayersIcon, PlayIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { type CSSProperties, Suspense } from "react";

import { AddCourseDialog } from "@/components/add-course-dialog";
import { AppHeader } from "@/components/app-header";
import { CourseMenu } from "@/components/course-menu";
import { Bar } from "@/components/progress-visuals";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { colorFor } from "@/lib/colors";
import { courseStats, resumeLesson } from "@/lib/progress";
import { getCourse } from "@/lib/server/courses";
import { getProgress, listCourses } from "@/lib/server/store";

export default function LibraryPage() {
  return (
    <>
      <AppHeader>
        <AddCourseDialog />
      </AppHeader>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-medium tracking-tight">My courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick up right where you left off.</p>
        </div>
        <Suspense fallback={<GridSkeleton />}>
          <CourseGrid />
        </Suspense>
      </main>
    </>
  );
}

async function CourseGrid() {
  await connection();
  const records = await listCourses();
  if (records.length === 0) return <EmptyLibrary />;

  const items = await Promise.all(
    records.map(async (record) => {
      const [course, progress] = await Promise.all([getCourse(record.id).catch(() => null), getProgress(record.id)]);
      return { record, course, progress };
    }),
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ record, course, progress }) => {
        const color = colorFor(record.id);
        const stats = course ? courseStats(course, progress.lessons) : null;
        const resume = course ? resumeLesson(course, progress) : null;
        const started = (stats?.done ?? 0) > 0 || !!progress.lastLessonId;
        return (
          <article
            key={record.id}
            className="group relative flex flex-col rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[0_6px_24px_-12px_rgba(31,35,41,0.25)]"
          >
            <div className="flex items-start gap-3">
              <span
                className="tint flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-medium"
                style={{ "--c": color } as CSSProperties}
              >
                {initials(record.title)}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 font-medium leading-snug">
                  <Link href={`/course/${record.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
                    {record.title}
                  </Link>
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LayersIcon className="size-3.5" />
                  {course ? `${course.modules.length} modules · ${course.lessonCount} lessons` : "Folder unavailable"}
                </p>
              </div>
              <div className="relative z-10 -mr-2 -mt-1">
                <CourseMenu courseId={record.id} title={record.title} />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">
                  {stats ? `${stats.done} of ${stats.total} complete` : "—"}
                </span>
                <span className="font-medium" style={{ color }}>
                  {stats?.percent ?? 0}%
                </span>
              </div>
              <Bar value={stats?.percent ?? 0} color={color} />
            </div>

            {resume && (
              <div className="relative z-10 mt-5 flex items-center justify-between gap-3 border-t pt-4">
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                  {started ? "Next: " : "Start: "}
                  <span className="text-foreground">{resume.title}</span>
                </p>
                <Button size="sm" asChild>
                  <Link href={`/course/${record.id}/learn/${resume.id}`}>
                    {started ? <ArrowRightIcon /> : <PlayIcon />}
                    {started ? "Continue" : "Start"}
                  </Link>
                </Button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function initials(title: string) {
  const words = title.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "C").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
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
