import { Suspense } from "react";

import { LessonNotFound } from "@/components/lesson-not-found";

export default function NotFound() {
  return (
    <Suspense>
      <LessonNotFound />
    </Suspense>
  );
}
