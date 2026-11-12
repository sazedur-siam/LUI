"use client";

import { useState } from "react";

import { KindIcon } from "@/components/kind-icon";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileViewer } from "@/components/viewers/file-viewer";
import { formatBytes, KIND_LABEL } from "@/lib/files";
import { cn } from "@/lib/utils";
import type { ResourceFile } from "@/lib/types";

export interface ResourceRef extends ResourceFile {
  lessonId: string;
}

/** A clickable resource row that opens the file in a large preview dialog. */
export function ResourceItem({
  resource,
  subtitle,
  className,
}: {
  resource: ResourceRef;
  subtitle?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const fileName = resource.name.split("/").pop() ?? resource.name;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Don't keep a lesson video talking over the resource.
          document.querySelectorAll("video, audio").forEach((m) => (m as HTMLMediaElement).pause());
          setOpen(true);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition-colors hover:border-[#bbdefb] hover:bg-[#f7fbff]",
          className,
        )}
      >
        <KindIcon kind={resource.kind} tinted />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{fileName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle ?? `${KIND_LABEL[resource.kind]} · ${formatBytes(resource.size)}`}
          </span>
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[90svh] flex-col gap-3 p-4 sm:max-w-6xl">
          <DialogHeader className="pr-8">
            <DialogTitle className="truncate text-base font-medium">{fileName}</DialogTitle>
            <DialogDescription>
              {KIND_LABEL[resource.kind]} · {formatBytes(resource.size)}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            {open && (
              <FileViewer
                lessonId={resource.lessonId}
                file={{ path: resource.path, name: fileName, kind: resource.kind, size: resource.size }}
                isResource
                frameClassName="h-full min-h-0"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
