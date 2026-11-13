"use client";

import { FolderOpenIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { CourseAccessChoice } from "@/components/course-access-choice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type DeviceCourseRecord, setDeviceCourseAccess } from "@/lib/client/device-db";
import {
  importFileList,
  isNewDeviceCourse,
  pickFolderWithHandle,
  supportsDirectoryPicker,
} from "@/lib/client/device-files";
import { plural } from "@/lib/files";
import type { CourseAccess } from "@/lib/types";

// React's types don't include the non-standard directory attributes.
const DIRECTORY_ATTRS = { webkitdirectory: "", directory: "" } as Record<string, string>;

/**
 * Opens a folder from this device: the File System Access API where available
 * (Chrome / Edge; remembered between visits), otherwise a directory <input>.
 */
export function useFolderPicker({ onDone }: { onDone: (record: DeviceCourseRecord) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<DeviceCourseRecord | null>) => {
    setBusy(true);
    try {
      const record = await task();
      if (record) onDone(record);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that folder.");
    } finally {
      setBusy(false);
    }
  };

  const open = () => {
    if (supportsDirectoryPicker()) void run(pickFolderWithHandle);
    else inputRef.current?.click();
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      hidden
      {...DIRECTORY_ATTRS}
      onChange={(e) => {
        const list = Array.from(e.currentTarget.files ?? []);
        e.currentTarget.value = "";
        if (list.length > 0) void run(() => importFileList(list));
      }}
    />
  );

  return { open, busy, input };
}

export function OpenFolderButton({
  variant = "default",
  label = "Open folder",
}: {
  variant?: "default" | "outline";
  label?: string;
}) {
  const router = useRouter();
  // A newly added course asks how lessons should open before it's shown.
  const [pendingNew, setPendingNew] = useState<DeviceCourseRecord | null>(null);
  const [access, setAccess] = useState<CourseAccess>("open");

  const go = (record: DeviceCourseRecord) => {
    toast.success(`Opened “${record.title}” · ${plural(record.course.lessonCount, "lesson")}`);
    router.push(`/device/${record.id}`);
  };

  const picker = useFolderPicker({
    onDone: (record) => {
      if (isNewDeviceCourse(record)) {
        setAccess("open");
        setPendingNew(record);
      } else {
        go(record);
      }
    },
  });

  return (
    <>
      <Button variant={variant} onClick={picker.open} disabled={picker.busy}>
        {picker.busy ? <Loader2Icon className="animate-spin" /> : <FolderOpenIcon />}
        {picker.busy ? "Reading folder…" : label}
      </Button>
      {picker.input}
      <Dialog open={!!pendingNew} onOpenChange={(o) => !o && pendingNew && go(pendingNew)}>
        <DialogContent className="gap-5 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{pendingNew?.title}</DialogTitle>
            <DialogDescription>
              {pendingNew &&
                `${plural(pendingNew.course.modules.length, "module")} · ${plural(pendingNew.course.lessonCount, "lesson")} found on this device.`}
            </DialogDescription>
          </DialogHeader>
          <CourseAccessChoice value={access} onChange={setAccess} idPrefix="device-access" />
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!pendingNew) return;
                const record = { ...pendingNew, access };
                if (access !== "open") await setDeviceCourseAccess(record.id, access);
                setPendingNew(null);
                go(record);
              }}
            >
              Start course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
