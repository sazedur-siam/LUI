import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LearnShell } from "@/components/learn/learn-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderMissing } from "@/components/folder-missing";
import { courseFolderExists, getCourse } from "@/lib/server/courses";
import { getDurations } from "@/lib/server/durations";
import { getCourseRecord, getProgress } from "@/lib/server/store";

export default function LearnLayout({ children, params }: LayoutProps<"/course/[courseId]/learn">) {
  return (
    <Suspense fallback={<LearnSkeleton />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

async function Shell({
  params,
  children,
}: {
  params: LayoutProps<"/course/[courseId]/learn">["params"];
  children: React.ReactNode;
}) {
  const { courseId } = await params;
  await connection();
  const record = await getCourseRecord(courseId);
  if (!record) notFound();
  if (!(await courseFolderExists(record.root))) {
    return (
      <div className="flex min-h-svh flex-col">
        <FolderMissing courseId={record.id} title={record.title} root={record.root} />
      </div>
    );
  }
  const course = await getCourse(courseId);
  if (!course) notFound();
  const [progress, { durations }] = await Promise.all([getProgress(courseId), getDurations(course)]);
  return (
    <LearnShell course={course} progress={progress} durations={durations}>
      {children}
    </LearnShell>
  );
}

function LearnSkeleton() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-[21rem] space-y-3 border-r bg-[#f7fbff] p-4 md:block">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-2 w-full" />
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="aspect-video w-full max-w-5xl rounded-2xl" />
      </div>
    </div>
  );
}
