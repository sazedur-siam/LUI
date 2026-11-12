import { CompassIcon } from "lucide-react";
import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { StatusNotice } from "@/components/status-notice";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <StatusNotice icon={<CompassIcon />} title="We couldn't find that">
          <p>The course or lesson may have been removed, renamed, or opened on another device.</p>
          <Button asChild>
            <Link href="/">Back to my courses</Link>
          </Button>
        </StatusNotice>
      </main>
    </>
  );
}
