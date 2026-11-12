"use client";

import { FolderOpenIcon, MonitorSmartphoneIcon } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";

import { CourseCard } from "@/components/course-card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type DeviceCourseRecord,
  getDeviceProgress,
  listDeviceCourses,
  onDeviceCoursesChange,
} from "@/lib/client/device-db";
import { courseStats, resumeLesson } from "@/lib/progress";
import type { CourseProgress } from "@/lib/types";

import { DeviceCourseMenu } from "./device-course-menu";
import { OpenFolderButton } from "./open-folder";

type Item = { record: DeviceCourseRecord; progress: CourseProgress };

/** Courses opened from folders on this device (stored in this browser). */
export function DeviceLibrary({ hosted }: { hosted: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const records = await listDeviceCourses();
      const withProgress = await Promise.all(
        records.map(async (record) => ({ record, progress: await getDeviceProgress(record.id) })),
      );
      withProgress.sort(
        (a, b) =>
          (b.progress.lastOpenedAt ?? b.record.addedAt) - (a.progress.lastOpenedAt ?? a.record.addedAt),
      );
      if (!cancelled) setItems(withProgress);
    };
    load().catch(() => !cancelled && setItems([]));
    const off = onDeviceCoursesChange(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  if (items === null) {
    return hosted ? (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-52 rounded-2xl" />
      </div>
    ) : null;
  }

  if (items.length === 0) {
    if (!hosted) return null;
    return (
      <Empty className="rounded-2xl border border-dashed py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="tint size-12 rounded-xl" style={{ "--c": "#1E88E5" } as CSSProperties}>
            <FolderOpenIcon className="size-6" />
          </EmptyMedia>
          <EmptyTitle>Open a course folder</EmptyTitle>
          <EmptyDescription>
            Pick a folder of videos, PDFs and notes on this device. It is read by your browser and never uploaded.
            Each device keeps its own folders and progress.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <OpenFolderButton />
          <p className="max-w-sm text-xs text-muted-foreground">
            Chrome and Edge remember the folder. Safari and Firefox ask you to pick it again each visit. Phone browsers
            mostly can&apos;t open folders.
          </p>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <section className="space-y-4">
      {!hosted && (
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MonitorSmartphoneIcon className="size-4 text-[#039BE5]" /> Opened in this browser
        </h2>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ record, progress }) => {
          const stats = courseStats(record.course, progress.lessons);
          const resume = resumeLesson(record.course, progress);
          return (
            <CourseCard
              key={record.id}
              id={record.id}
              href={`/device/${record.id}`}
              title={record.title}
              meta={`On this device · ${record.course.modules.length} modules · ${record.course.lessonCount} lessons`}
              stats={stats}
              resume={resume && { href: `/device/${record.id}/learn/${resume.id}`, title: resume.title }}
              started={stats.done > 0 || !!progress.lastLessonId}
              menu={<DeviceCourseMenu record={record} />}
              device
            />
          );
        })}
      </div>
    </section>
  );
}
