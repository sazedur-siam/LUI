import {
  FileArchiveIcon,
  FileCode2Icon,
  FileIcon,
  FileTextIcon,
  HeadphonesIcon,
  ImageIcon,
  type LucideIcon,
  MonitorPlayIcon,
  NewspaperIcon,
  NotebookPenIcon,
  ScrollTextIcon,
  SheetIcon,
  TextIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import type { FileKind } from "@/lib/types";

export const KIND_META: Record<FileKind, { icon: LucideIcon; color: string }> = {
  video: { icon: MonitorPlayIcon, color: "#1E88E5" },
  audio: { icon: HeadphonesIcon, color: "#5C6BC0" },
  pdf: { icon: FileTextIcon, color: "#EF5350" },
  html: { icon: NewspaperIcon, color: "#00ACC1" },
  notebook: { icon: NotebookPenIcon, color: "#FF8A65" },
  csv: { icon: SheetIcon, color: "#26A69A" },
  markdown: { icon: ScrollTextIcon, color: "#039BE5" },
  code: { icon: FileCode2Icon, color: "#0097A7" },
  text: { icon: TextIcon, color: "#546E7A" },
  image: { icon: ImageIcon, color: "#7986CB" },
  archive: { icon: FileArchiveIcon, color: "#78909C" },
  document: { icon: FileTextIcon, color: "#1976D2" },
  file: { icon: FileIcon, color: "#78909C" },
};

export function KindIcon({ kind, className, tinted }: { kind: FileKind; className?: string; tinted?: boolean }) {
  const { icon: Icon, color } = KIND_META[kind];
  if (tinted) {
    return (
      <span
        className={cn("tint inline-flex size-9 shrink-0 items-center justify-center rounded-lg", className)}
        style={{ "--c": color } as CSSProperties}
      >
        <Icon className="size-[18px]" />
      </span>
    );
  }
  return <Icon className={cn("size-4 shrink-0", className)} style={{ color }} />;
}
