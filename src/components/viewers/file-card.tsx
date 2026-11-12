"use client";

import { DownloadIcon, ExternalLinkIcon, FolderSearchIcon } from "lucide-react";

import { KindIcon } from "@/components/kind-icon";
import { Button } from "@/components/ui/button";
import { fileUrl, formatBytes, KIND_LABEL } from "@/lib/files";
import { cn } from "@/lib/utils";
import type { FileKind } from "@/lib/types";

import { openExternally } from "./file-actions";

export function FileCard({
  courseId,
  path,
  name,
  kind,
  size,
  message,
  className,
}: {
  courseId: string;
  path: string;
  name: string;
  kind: FileKind;
  size: number;
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border bg-gradient-to-b from-white to-[#f1f7fd] px-6 py-14 text-center",
        className,
      )}
    >
      <KindIcon kind={kind} tinted className="size-14 rounded-2xl [&_svg]:size-7" />
      <div className="space-y-1">
        <p className="max-w-lg break-all font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">
          {KIND_LABEL[kind]} · {formatBytes(size)}
        </p>
        {message && <p className="pt-1 text-sm text-muted-foreground">{message}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <a href={fileUrl(courseId, path, { download: true })}>
            <DownloadIcon /> Download
          </a>
        </Button>
        <Button variant="outline" onClick={() => openExternally(courseId, path, "open")}>
          <ExternalLinkIcon /> Open with default app
        </Button>
        <Button variant="ghost" onClick={() => openExternally(courseId, path, "reveal")}>
          <FolderSearchIcon /> Show in Finder
        </Button>
      </div>
    </div>
  );
}
