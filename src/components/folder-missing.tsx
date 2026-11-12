import { FolderSearchIcon } from "lucide-react";
import Link from "next/link";

import { AddCourseDialog } from "@/components/add-course-dialog";
import { StatusNotice } from "@/components/status-notice";
import { Button } from "@/components/ui/button";

/** Local mode: the course folder is no longer at its saved path. */
export function FolderMissing({ courseId, title, root }: { courseId: string; title: string; root: string }) {
  return (
    <StatusNotice icon={<FolderSearchIcon />} title="Can't find this course's folder" color="#FFA000">
      <p>
        “{title}” was expected at{" "}
        <span className="break-all font-mono text-xs text-foreground">{root}</span>. It may have been moved, renamed
        or deleted.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <AddCourseDialog
          relocate={{ courseId, title, oldRoot: root }}
          trigger={
            <Button>
              <FolderSearchIcon /> Change folder…
            </Button>
          }
        />
        <Button variant="outline" asChild>
          <Link href="/">My courses</Link>
        </Button>
      </div>
    </StatusNotice>
  );
}
