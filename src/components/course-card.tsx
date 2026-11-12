import { ArrowRightIcon, LayersIcon, MonitorSmartphoneIcon, PlayIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { Bar } from "@/components/progress-visuals";
import { Button } from "@/components/ui/button";
import { colorFor } from "@/lib/colors";

export interface CourseCardProps {
  id: string;
  href: string;
  title: string;
  meta: string;
  stats: { done: number; total: number; percent: number } | null;
  resume: { href: string; title: string } | null;
  started: boolean;
  menu?: React.ReactNode;
  /** Device courses are saved in this browser only. */
  device?: boolean;
}

function initials(title: string) {
  const words = title.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "C").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

export function CourseCard({ id, href, title, meta, stats, resume, started, menu, device }: CourseCardProps) {
  const color = colorFor(id);
  return (
    <article className="group relative flex flex-col rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[0_6px_24px_-12px_rgba(30,136,229,0.35)]">
      <div className="flex items-start gap-3">
        <span
          className="tint flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-medium"
          style={{ "--c": color } as CSSProperties}
        >
          {initials(title)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 font-medium leading-snug">
            <Link href={href} className="after:absolute after:inset-0 after:rounded-2xl">
              {title}
            </Link>
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {device ? <MonitorSmartphoneIcon className="size-3.5" /> : <LayersIcon className="size-3.5" />}
            {meta}
          </p>
        </div>
        {menu && <div className="relative z-10 -mr-2 -mt-1">{menu}</div>}
      </div>

      <div className="mt-6 space-y-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">{stats ? `${stats.done} of ${stats.total} complete` : "—"}</span>
          <span className="font-medium" style={{ color }}>
            {stats?.percent ?? 0}%
          </span>
        </div>
        <Bar value={stats?.percent ?? 0} color={color} />
      </div>

      {resume && (
        <div className="relative z-10 mt-5 flex items-center justify-between gap-3 border-t pt-4">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {started ? "Next: " : "Start: "}
            <span className="text-foreground">{resume.title}</span>
          </p>
          <Button size="sm" asChild>
            <Link href={resume.href}>
              {started ? <ArrowRightIcon /> : <PlayIcon />}
              {started ? "Continue" : "Start"}
            </Link>
          </Button>
        </div>
      )}
    </article>
  );
}
