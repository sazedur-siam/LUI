"use client";

import { FolderOpenIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { DeviceCourseRecord } from "@/lib/client/device-db";
import { importFileList, pickFolderWithHandle, supportsDirectoryPicker } from "@/lib/client/device-files";

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
  const picker = useFolderPicker({
    onDone: (record) => {
      toast.success(`Opened “${record.title}” · ${record.course.lessonCount} lessons`);
      router.push(`/device/${record.id}`);
    },
  });
  return (
    <>
      <Button variant={variant} onClick={picker.open} disabled={picker.busy}>
        {picker.busy ? <Loader2Icon className="animate-spin" /> : <FolderOpenIcon />}
        {picker.busy ? "Reading folder…" : label}
      </Button>
      {picker.input}
    </>
  );
}
