import { Suspense } from "react";

import { DeviceLessonPage } from "@/components/device/device-pages";

// Rendered in the browser from IndexedDB once folder access is confirmed, so the
// server has nothing to prerender here.
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <DeviceLessonPage />
    </Suspense>
  );
}
