import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LessonView } from "@/components/learn/lesson-view";
import { Skeleton } from "@/components/ui/skeleton";
import { findLesson, getCourse } from "@/lib/server/courses";

export default function LessonPage({ params }: PageProps<"/course/[courseId]/learn/[lessonId]">) {
  return (
    <Suspense fallback={<LessonSkeleton />}>
      <Lesson params={params} />
    </Suspense>
  );
}

async function Lesson({ params }: { params: PageProps<"/course/[courseId]/learn/[lessonId]">["params"] }) {
  const { courseId, lessonId } = await params;
  await connection();
  const course = await getCourse(courseId);
  const found = course && findLesson(course, lessonId);
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

function LessonSkeleton() {
  return (
    <div>
      <div className="flex h-14 items-center border-b px-4">
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="mx-auto max-w-6xl space-y-4 px-6 py-5">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    </div>
  );
}
