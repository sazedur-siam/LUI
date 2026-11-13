"use client";

import {
  DownloadIcon,
  EllipsisVerticalIcon,
  LockIcon,
  LockOpenIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  exportProgressAction,
  importProgressAction,
  removeCourseAction,
  rescanCourseAction,
  resetProgressAction,
  setCourseAccessAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadJson, pickJsonFile } from "@/lib/client/file-transfer";
import { backupFileName, describeSummary } from "@/lib/progress-transfer";
import type { CourseAccess } from "@/lib/types";

export function CourseMenu({
  courseId,
  title,
  access,
  afterRemove,
}: {
  courseId: string;
  title: string;
  access?: CourseAccess;
  afterRemove?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Course options" disabled={pending}>
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onSelect={() =>
            startTransition(async () => {
              const { lessons } = await rescanCourseAction(courseId);
              toast.success(`Rescanned · ${lessons} lessons`);
              router.refresh();
            })
          }
        >
          <RefreshCwIcon /> Rescan folder
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            if (!confirm(`Reset all progress for “${title}”?`)) return;
            startTransition(async () => {
              await resetProgressAction(courseId);
              toast.success("Progress reset");
              router.refresh();
            });
          }}
        >
          <RotateCcwIcon /> Reset progress
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            const next = access === "guided" ? "open" : "guided";
            if (next === "open" && !confirm(`Unlock every lesson in “${title}”?`)) return;
            startTransition(async () => {
              await setCourseAccessAction(courseId, next);
              toast.success(next === "guided" ? "Guided: lessons now unlock in order" : "All lessons unlocked");
              router.refresh();
            });
          }}
        >
          {access === "guided" ? <LockOpenIcon /> : <LockIcon />}
          {access === "guided" ? "Lessons: unlock all" : "Lessons: guided (in order)"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            startTransition(async () => {
              const result = await exportProgressAction(courseId);
              if (!result.file) return void toast.error(result.error ?? "Could not export progress.");
              downloadJson(result.file, backupFileName(title));
              toast.success("Progress exported");
            })
          }
        >
          <DownloadIcon /> Export progress
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            // Open the file picker straight from the click, then do the async work.
            const text = await pickJsonFile();
            if (!text) return;
            startTransition(async () => {
              const preview = await importProgressAction(courseId, text, false);
              if (!preview.file || !preview.summary) return void toast.error(preview.error ?? "Could not read that file.");
              if (!confirm(describeSummary(preview.file, preview.summary))) return;
              const result = await importProgressAction(courseId, text, true);
              if (result.error) return void toast.error(result.error);
              toast.success("Progress imported");
              router.refresh();
            });
          }}
        >
          <UploadIcon /> Import progress…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            if (!confirm(`Remove “${title}” from your library? Files on disk are not touched.`)) return;
            startTransition(async () => {
              await removeCourseAction(courseId);
              toast.success("Course removed");
              if (afterRemove) router.push(afterRemove);
              router.refresh();
            });
          }}
        >
          <Trash2Icon /> Remove from library
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
