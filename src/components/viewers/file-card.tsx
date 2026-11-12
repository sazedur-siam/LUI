"use client";

import { DownloadIcon, ExternalLinkIcon, FolderSearchIcon } from "lucide-react";

import { KindIcon } from "@/components/kind-icon";
import { useCourseSource, useFileUrl } from "@/components/source/course-source";
import { Button } from "@/components/ui/button";
import { formatBytes, KIND_LABEL } from "@/lib/files";
import { cn } from "@/lib/utils";
import type { FileKind } from "@/lib/types";

export function FileCard({
  path,
  name,
  kind,
  size,
  message,
  className,
}: {
  path: string;
  name: string;
  kind: FileKind;
  size: number;
  message?: string;
  className?: string;
}) {
  const source = useCourseSource();
  const downloadUrl = useFileUrl(path, { download: true });

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border bg-linear-to-b from-white to-[#f1f7fd] px-6 py-14 text-center",
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
        <Button asChild disabled={!downloadUrl}>
          <a href={downloadUrl ?? undefined} download={name.split("/").pop()}>
            <DownloadIcon /> Download
          </a>
        </Button>
        {source.openExternally && (
          <>
            <Button variant="outline" onClick={() => source.openExternally?.(path, "open")}>
              <ExternalLinkIcon /> Open with default app
            </Button>
            <Button variant="ghost" onClick={() => source.openExternally?.(path, "reveal")}>
              <FolderSearchIcon /> Show in Finder
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
