import {
  ArrowRightIcon,
  ClockIcon,
  FolderIcon,
  LayersIcon,
  ListVideoIcon,
  PlayIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { CourseMenu } from "@/components/course-menu";
import { Curriculum } from "@/components/curriculum";
import { Ring } from "@/components/progress-visuals";
import { type ResourceRef, ResourceItem } from "@/components/resource-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDuration } from "@/lib/files";
import { courseStats, flatLessons, resumeLesson, sumDurations } from "@/lib/progress";
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

  const lessons = flatLessons(course);
  const stats = courseStats(course, progress.lessons);
  const resume = resumeLesson(course, progress);
  const started = stats.done > 0 || !!progress.lastLessonId;
  const totalSeconds = sumDurations(lessons, durations);
  const remainingSeconds = sumDurations(
    lessons.filter((l) => !progress.lessons[l.id]?.completed),
    durations,
  );
  const videoCount = lessons.filter((l) => l.kind === "video").length;

  // One entry per distinct resource file (courses often repeat the same notes PDF).
  const seen = new Set<string>();
  const resources: (ResourceRef & { moduleTitle: string })[] = [];
  for (const m of course.modules) {
    for (const l of m.lessons) {
      for (const r of l.resources) {
        const key = `${r.name.split("/").pop()}|${r.size}`;
        if (seen.has(key)) continue;
        seen.add(key);
        resources.push({ ...r, lessonId: l.id, moduleTitle: m.title });
      }
    }
  }

  return (
    <div className="space-y-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          My courses
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">{course.title}</span>
      </nav>

      <section className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-3xl font-medium leading-tight tracking-tight">{course.title}</h1>
            <CourseMenu courseId={course.id} title={course.title} afterRemove="/" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip icon={LayersIcon} label={`${course.modules.length} modules`} />
            <Chip icon={ListVideoIcon} label={`${course.lessonCount} lessons · ${videoCount} videos`} />
            <Chip
              icon={ClockIcon}
              label={pending > 0 && totalSeconds === 0 ? "Measuring length…" : `${formatDuration(totalSeconds, "short")} total`}
            />
          </div>
          <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <FolderIcon className="size-3.5 shrink-0 text-[#039BE5]" />
            <span className="truncate" title={course.root}>
              {course.root}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-5 rounded-2xl border bg-gradient-to-br from-white to-[#e3f2fd] p-5">
          <Ring value={stats.percent} size={92} stroke={8}>
            <span className="text-xl font-medium tabular-nums">{stats.percent}%</span>
          </Ring>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium">
                {stats.done} of {stats.total} done
              </p>
              {remainingSeconds > 0 && (
                <p className="text-xs text-muted-foreground">{formatDuration(remainingSeconds, "short")} of video left</p>
              )}
            </div>
            {resume && (
              <Button asChild className="w-full">
                <Link href={`/course/${course.id}/learn/${resume.id}`}>
                  {started ? <ArrowRightIcon /> : <PlayIcon />}
                  {started ? "Continue" : "Start course"}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {resume && started && (
        <Link
          href={`/course/${course.id}/learn/${resume.id}`}
          className="flex items-center gap-3 rounded-2xl border border-[#bbdefb] bg-[#f5faff] px-4 py-3 text-sm transition-colors hover:bg-[#e3f2fd]"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <PlayIcon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Up next</span>
            <span className="block truncate font-medium">{resume.title}</span>
          </span>
          <ArrowRightIcon className="size-4 text-primary" />
        </Link>
      )}

      <Tabs defaultValue="curriculum" className="gap-6">
        <TabsList>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="resources">Resources · {resources.length}</TabsTrigger>
        </TabsList>
        <TabsContent value="curriculum">
          <Curriculum
            courseId={course.id}
            modules={course.modules}
            progress={progress.lessons}
            durations={durations}
            openModuleId={resume?.moduleId}
          />
        </TabsContent>
        <TabsContent value="resources">
          {resources.length === 0 ? (
            <p className="rounded-2xl border border-dashed py-14 text-center text-sm text-muted-foreground">
              This course has no attached resources.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {resources.map((r) => (
                <ResourceItem
                  key={r.path}
                  courseId={course.id}
                  resource={r}
                  subtitle={r.moduleTitle}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Chip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs text-muted-foreground">
      <Icon className="size-3.5 text-[#1E88E5]" />
      {label}
    </span>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        <Skeleton className="h-32 rounded-2xl" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
