import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { resumeLesson } from "@/lib/progress";
import { getCourse } from "@/lib/server/courses";
import { getCourseRecord, getProgress } from "@/lib/server/store";

/** /course/:id/learn → the lesson to resume. */
export default function ResumePage({ params }: PageProps<"/course/[courseId]/learn">) {
  return (
    <Suspense>
      <Resume params={params} />
    </Suspense>
  );
}

async function Resume({ params }: { params: PageProps<"/course/[courseId]/learn">["params"] }): Promise<React.ReactNode> {
  const { courseId } = await params;
  await connection();
  const course = await getCourse(courseId);
  if (!course) notFound();
  const record = await getCourseRecord(courseId);
  const lesson = resumeLesson(course, await getProgress(courseId), record?.access);
  if (!lesson) notFound();
  redirect(`/course/${courseId}/learn/${lesson.id}`);
  return null;
}
