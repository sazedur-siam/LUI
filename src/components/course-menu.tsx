"use client";

import { EllipsisVerticalIcon, RefreshCwIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { removeCourseAction, rescanCourseAction, resetProgressAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CourseMenu({ courseId, title, afterRemove }: { courseId: string; title: string; afterRemove?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Course options" disabled={pending}>
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
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
