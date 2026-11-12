"use client";

import { DownloadIcon, ExternalLinkIcon, FolderSearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fileUrl } from "@/lib/files";

export async function openExternally(courseId: string, path: string, action: "open" | "reveal") {
  const res = await fetch("/api/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId, path, action }),
  });
  if (!res.ok) toast.error("Could not open the file");
}

export function FileActions({ courseId, path, newTab = true }: { courseId: string; path: string; newTab?: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {newTab && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={fileUrl(courseId, path)} target="_blank" rel="noreferrer" aria-label="Open in new tab">
                <ExternalLinkIcon />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in new tab</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={fileUrl(courseId, path, { download: true })} aria-label="Download">
              <DownloadIcon />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Download</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Show in Finder"
            onClick={() => openExternally(courseId, path, "reveal")}
          >
            <FolderSearchIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Show in Finder</TooltipContent>
      </Tooltip>
    </div>
  );
}
