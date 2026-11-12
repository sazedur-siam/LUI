"use client";

import { Loader2Icon } from "lucide-react";
import dynamic from "next/dynamic";

import { fileUrl } from "@/lib/files";
import { cn } from "@/lib/utils";
import type { FileKind } from "@/lib/types";

import { FileActions } from "./file-actions";
import { FileCard } from "./file-card";
import type { MediaPlayerProps } from "./media-player";

const loading = () => (
  <div className="flex h-64 items-center justify-center rounded-2xl border bg-[#f7fbff] text-[#1E88E5]">
    <Loader2Icon className="size-5 animate-spin" />
  </div>
);

const MediaPlayer = dynamic(() => import("./media-player").then((m) => m.MediaPlayer), { ssr: false, loading });
const PdfViewer = dynamic(() => import("./pdf-viewer"), { ssr: false, loading });
const NotebookViewer = dynamic(() => import("./notebook-viewer"), { ssr: false, loading });
const TextViewer = dynamic(() => import("./text-viewer"), { ssr: false, loading });

export interface ViewerFile {
  path: string;
  name: string;
  kind: FileKind;
  size: number;
}

export interface FileViewerProps {
  courseId: string;
  lessonId: string;
  file: ViewerFile;
  /** True when showing a resource attached to the lesson rather than the lesson file. */
  isResource?: boolean;
  /** Height classes for document-like viewers. */
  frameClassName?: string;
  media?: Omit<MediaPlayerProps, "courseId" | "lessonId" | "resourcePath" | "filePath" | "kind">;
  pdf?: { initialPage?: number; onPage?: (page: number, total: number) => void };
}

export function FileViewer({ courseId, lessonId, file, isResource, frameClassName, media, pdf }: FileViewerProps) {
  const frame = cn("h-[calc(100svh-11rem)] min-h-[420px]", frameClassName);

  switch (file.kind) {
    case "video":
    case "audio":
      return (
        <MediaPlayer
          courseId={courseId}
          lessonId={lessonId}
          resourcePath={isResource ? file.path : undefined}
          filePath={file.path}
          kind={file.kind}
          {...media}
        />
      );
    case "pdf":
      return <PdfViewer courseId={courseId} path={file.path} className={frame} {...pdf} />;
    case "html":
      return (
        <div className={cn("flex flex-col overflow-hidden rounded-2xl border bg-white", frame)}>
          <div className="flex items-center justify-between border-b px-4 py-1.5">
            <span className="truncate text-xs text-muted-foreground">{file.name}</span>
            <FileActions courseId={courseId} path={file.path} />
          </div>
          <iframe
            key={file.path}
            title={file.name}
            src={fileUrl(courseId, file.path)}
            // Scripts (quizzes, flashcards) may run, but in an opaque origin with no access to this app.
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            className="w-full flex-1 bg-white"
          />
        </div>
      );
    case "notebook":
      return <NotebookViewer courseId={courseId} path={file.path} size={file.size} className={frame} />;
    case "markdown":
    case "code":
    case "text":
    case "csv":
      return (
        <TextViewer
          courseId={courseId}
          path={file.path}
          name={file.name}
          kind={file.kind}
          size={file.size}
          className={frame}
        />
      );
    case "image":
      return (
        <div className={cn("flex flex-col overflow-hidden rounded-2xl border bg-white", frame)}>
          <div className="flex items-center justify-between border-b px-4 py-1.5">
            <span className="truncate text-xs text-muted-foreground">{file.name}</span>
            <FileActions courseId={courseId} path={file.path} />
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto bg-[#f7fbff] p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(courseId, file.path)} alt={file.name} className="max-h-full max-w-full rounded-lg shadow-sm" />
          </div>
        </div>
      );
    default:
      return (
        <FileCard
          courseId={courseId}
          path={file.path}
          name={file.name}
          kind={file.kind}
          size={file.size}
          message="This file type opens outside the browser."
        />
      );
  }
}
