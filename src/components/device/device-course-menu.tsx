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

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type DeviceCourseRecord,
  deleteDeviceCourse,
  getDeviceProgress,
  replaceDeviceProgress,
  resetDeviceProgress,
  setDeviceCourseAccess,
} from "@/lib/client/device-db";
import { rescanDeviceCourse } from "@/lib/client/device-files";
import { downloadJson, pickJsonFile } from "@/lib/client/file-transfer";
import {
  backupFileName,
  describeSummary,
  exportProgress,
  mergeProgress,
  parseProgressFile,
} from "@/lib/progress-transfer";

import { useFolderPicker } from "./open-folder";

export function DeviceCourseMenu({ record, afterRemove }: { record: DeviceCourseRecord; afterRemove?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const picker = useFolderPicker({
    onDone: (rec) => {
      toast.success(`Rescanned · ${rec.course.lessonCount} lessons`);
      window.location.reload();
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Course options" disabled={pending || picker.busy}>
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onSelect={() =>
              startTransition(async () => {
                try {
                  const rec = await rescanDeviceCourse(record);
                  if (!rec) {
                    // No remembered folder (Safari / Firefox): ask for it again.
                    picker.open();
                    return;
                  }
                  toast.success(`Rescanned · ${rec.course.lessonCount} lessons`);
                  window.location.reload();
                } catch {
                  picker.open();
                }
              })
            }
          >
            <RefreshCwIcon /> Rescan folder
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (!confirm(`Reset all progress for “${record.title}” on this device?`)) return;
              startTransition(async () => {
                await resetDeviceProgress(record.id);
                toast.success("Progress reset");
                window.location.reload();
              });
            }}
          >
            <RotateCcwIcon /> Reset progress
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const next = record.access === "guided" ? "open" : "guided";
              if (next === "open" && !confirm(`Unlock every lesson in “${record.title}”?`)) return;
              startTransition(async () => {
                await setDeviceCourseAccess(record.id, next);
                toast.success(next === "guided" ? "Guided: lessons now unlock in order" : "All lessons unlocked");
                window.location.reload();
              });
            }}
          >
            {record.access === "guided" ? <LockOpenIcon /> : <LockIcon />}
            {record.access === "guided" ? "Lessons: unlock all" : "Lessons: guided (in order)"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              startTransition(async () => {
                const progress = await getDeviceProgress(record.id);
                downloadJson(exportProgress(record.course, progress, record.folderName), backupFileName(record.title));
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
                try {
                  const file = parseProgressFile(text);
                  const { merged, summary } = mergeProgress(record.course, await getDeviceProgress(record.id), file);
                  if (!confirm(describeSummary(file, summary))) return;
                  await replaceDeviceProgress(record.id, merged);
                  toast.success("Progress imported");
                  window.location.reload();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not read that file.");
                }
              });
            }}
          >
            <UploadIcon /> Import progress…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              if (!confirm(`Remove “${record.title}” from this device? Your files are not touched.`)) return;
              startTransition(async () => {
                await deleteDeviceCourse(record.id);
                toast.success("Course removed");
                if (afterRemove) router.push(afterRemove);
              });
            }}
          >
            <Trash2Icon /> Remove from this device
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {picker.input}
    </>
  );
}
