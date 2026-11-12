"use client"; // Error boundaries must be Client Components

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { StatusNotice } from "@/components/status-notice";
import { Button } from "@/components/ui/button";

function describe(error: unknown) {
  if (error instanceof Error) {
    const digest = (error as Error & { digest?: string }).digest;
    return digest ? `${error.message} (ref ${digest})` : error.message;
  }
  return String(error);
}

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col">
      <StatusNotice icon={<TriangleAlertIcon />} title="Something went wrong" color="#FFA000">
        <p>This page hit an unexpected problem. Trying again usually fixes it.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>
            <RotateCcwIcon /> Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to my courses</Link>
          </Button>
        </div>
        <details className="w-full pt-2 text-left text-xs">
          <summary className="cursor-pointer text-center">Details</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 font-mono">
            {describe(error)}
          </pre>
        </details>
      </StatusNotice>
    </main>
  );
}
