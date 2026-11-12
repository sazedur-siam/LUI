"use client";

import { FileQuestionIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { StatusNotice } from "@/components/status-notice";
import { Button } from "@/components/ui/button";

/** Shown inside the learn layout, so the course sidebar stays available. */
export function LessonNotFound() {
  // "/course/<id>/learn/<lesson>" or "/device/<id>/learn/<lesson>" → course base path.
  const pathname = usePathname();
  const base = pathname.split("/learn")[0] || "/";
  return (
    <StatusNotice icon={<FileQuestionIcon />} title="Lesson not found">
      <p>It may have been renamed or removed from the course folder. Rescan the course, or pick another lesson.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href={base}>Back to course</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">My courses</Link>
        </Button>
      </div>
    </StatusNotice>
  );
}
