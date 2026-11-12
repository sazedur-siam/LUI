"use client";

import { FileQuestionIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useCourseSource } from "@/components/source/course-source";
import { StatusNotice } from "@/components/status-notice";
import { Button } from "@/components/ui/button";

/** Shown instead of a viewer when the file is no longer in the course folder. */
export function MissingFile({ path, className }: { path: string; className?: string }) {
  const source = useCourseSource();
  const [busy, setBusy] = useState(false);
  const name = path.split("/").pop() ?? path;

  return (
    <StatusNotice
      icon={<FileQuestionIcon />}
      title="This file was moved or renamed"
      color="#FFA000"
      className={className}
    >
      <p>
        <span className="break-all font-medium text-foreground">{name}</span> isn&apos;t in the course folder any
        more. Rescan the folder to pick up the change.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {source.rescan && (
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await source.rescan?.();
              } catch {
                toast.error("Could not rescan the folder.");
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} Rescan folder
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href={source.basePath}>Back to course</Link>
        </Button>
      </div>
    </StatusNotice>
  );
}
