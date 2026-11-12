"use client";

import { EllipsisVerticalIcon, RefreshCwIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
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
import { type DeviceCourseRecord, deleteDeviceCourse, resetDeviceProgress } from "@/lib/client/device-db";
import { rescanDeviceCourse } from "@/lib/client/device-files";

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
