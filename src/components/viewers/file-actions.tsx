"use client";

import { DownloadIcon, ExternalLinkIcon, FolderSearchIcon } from "lucide-react";

import { useCourseSource, useFileUrl } from "@/components/source/course-source";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function fileNameOf(path: string) {
  return path.split("/").pop() ?? path;
}

export function FileActions({ path, newTab = true }: { path: string; newTab?: boolean }) {
  const source = useCourseSource();
  const url = useFileUrl(path);
  const downloadUrl = useFileUrl(path, { download: true });
  // A device file opened in its own tab would run with this app's origin; keep active content in the sandboxed viewer.
  const showNewTab = newTab && !(source.kind === "device" && /\.(x?html?|svg)$/i.test(path));

  return (
    <div className="flex items-center gap-0.5">
      {showNewTab && url && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={url} target="_blank" rel="noreferrer" aria-label="Open in new tab">
                <ExternalLinkIcon />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in new tab</TooltipContent>
        </Tooltip>
      )}
      {downloadUrl && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={downloadUrl} download={fileNameOf(path)} aria-label="Download">
                <DownloadIcon />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download</TooltipContent>
        </Tooltip>
      )}
      {source.openExternally && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Show in Finder"
              onClick={() => source.openExternally?.(path, "reveal")}
            >
              <FolderSearchIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Show in Finder</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
