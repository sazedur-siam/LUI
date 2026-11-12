import { Suspense } from "react";

import { DeviceLearnLayout } from "@/components/device/device-pages";

// Rendered in the browser from IndexedDB once folder access is confirmed, so the
// server has nothing to prerender here.
export const instant = false;

export default function Layout({ children }: LayoutProps<"/device/[courseId]/learn">) {
  return (
    <Suspense>
      <DeviceLearnLayout>{children}</DeviceLearnLayout>
    </Suspense>
  );
}
