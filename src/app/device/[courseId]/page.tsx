import type { Metadata } from "next";
import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { OverviewSkeleton } from "@/components/course-overview";
import { DeviceOverviewPage } from "@/components/device/device-pages";

export const metadata: Metadata = { title: "Course" };

export default function DeviceCoursePage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Suspense fallback={<OverviewSkeleton />}>
          <DeviceOverviewPage />
        </Suspense>
      </main>
    </>
  );
}
