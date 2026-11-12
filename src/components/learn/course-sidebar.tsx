"use client";

import { ArrowLeftIcon, CheckCircle2Icon, ChevronRightIcon, CircleIcon, PlayCircleIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { KindIcon } from "@/components/kind-icon";
import { Bar } from "@/components/progress-visuals";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { groupColors } from "@/lib/colors";
import { formatDuration } from "@/lib/files";
import { courseStats, groupModules, moduleStats } from "@/lib/progress";
import { cn } from "@/lib/utils";
import type { Course, Lesson } from "@/lib/types";

import { useProgress } from "./progress-context";

export function CourseSidebar({ course, durations }: { course: Course; durations: Record<string, number> }) {
  const params = useParams<{ lessonId?: string }>();
  const currentId = params.lessonId;
  const { lessons: progress } = useProgress();
  const [query, setQuery] = useState("");
  const stats = courseStats(course, progress);
  const colors = useMemo(() => groupColors(course.modules.map((m) => m.group)), [course.modules]);
  const groups = useMemo(() => groupModules(course.modules), [course.modules]);

  const currentModuleId = useMemo(
    () => course.modules.find((m) => m.lessons.some((l) => l.id === currentId))?.id,
    [course.modules, currentId],
  );
  const [open, setOpen] = useState<Set<string>>(() => new Set(currentModuleId ? [currentModuleId] : []));
  // Expand the module of the lesson being viewed (adjusting state during render, not in an effect).
  const [openedFor, setOpenedFor] = useState(currentModuleId);
  if (currentModuleId !== openedFor) {
    setOpenedFor(currentModuleId);
    if (currentModuleId && !open.has(currentModuleId)) setOpen(new Set(open).add(currentModuleId));
  }

  // Keep the active lesson visible.
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    const t = setTimeout(() => activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 80);
    return () => clearTimeout(t);
  }, [currentId]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return course.modules.flatMap((m) =>
      m.lessons.filter((l) => l.title.toLowerCase().includes(q) || l.fileName.toLowerCase().includes(q)),
    );
  }, [query, course.modules]);

  const lessonRow = (l: Lesson) => (
    <LessonRow
      key={l.id}
      courseId={course.id}
      lesson={l}
      active={l.id === currentId}
      completed={!!progress[l.id]?.completed}
      duration={durations[l.id]}
      activeRef={l.id === currentId ? activeRef : undefined}
    />
  );

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="gap-3 border-b px-4 pb-4 pt-3">
        <Link
          href={`/course/${course.id}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" /> Course overview
        </Link>
        <p className="line-clamp-2 text-sm font-medium leading-snug">{course.title}</p>
        <div className="space-y-1.5">
          <Bar value={stats.percent} />
          <p className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              {stats.done}/{stats.total} lessons
            </span>
            <span className="font-medium text-primary">{stats.percent}% complete</span>
          </p>
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <SidebarInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lessons"
            className="bg-white pl-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin gap-0">
        {results ? (
          <SidebarGroup>
            <SidebarGroupLabel>{results.length} results</SidebarGroupLabel>
            <SidebarMenu>{results.slice(0, 200).map(lessonRow)}</SidebarMenu>
          </SidebarGroup>
        ) : (
          groups.map((group, gi) => {
            const color = colors.get(group.name ?? "") ?? "#1E88E5";
            return (
              <SidebarGroup key={`${group.name}-${gi}`} className="py-1" style={{ "--c": color } as CSSProperties}>
                {group.name && (
                  <SidebarGroupLabel className="gap-2 text-[11px] uppercase tracking-wide">
                    <span className="size-1.5 rounded-full" style={{ background: color }} />
                    {group.name}
                  </SidebarGroupLabel>
                )}
                <SidebarMenu className="gap-0.5">
                  {group.modules.map((m) => {
                    const ms = moduleStats(m, progress);
                    const isOpen = open.has(m.id);
                    return (
                      <Collapsible
                        key={m.id}
                        open={isOpen}
                        onOpenChange={(o) =>
                          setOpen((prev) => {
                            const next = new Set(prev);
                            if (o) next.add(m.id);
                            else next.delete(m.id);
                            return next;
                          })
                        }
                        asChild
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              className={cn("h-auto items-start gap-2.5 py-2", m.id === currentModuleId && "font-medium")}
                            >
                              <span className="tint mt-px flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-medium tabular-nums">
                                {m.number != null ? String(m.number).padStart(2, "0") : "•"}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 text-[13px] leading-snug">{m.title}</span>
                                <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                                  {ms.done}/{ms.total} done
                                </span>
                              </span>
                              {ms.done === ms.total ? (
                                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" />
                              ) : (
                                <ChevronRightIcon
                                  className={cn(
                                    "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                                    isOpen && "rotate-90",
                                  )}
                                />
                              )}
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <ul className="mb-1 ml-3 mt-0.5 border-l border-[#e1ecf7] pl-1.5">{m.lessons.map(lessonRow)}</ul>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            );
          })
        )}
      </SidebarContent>
    </Sidebar>
  );
}

function LessonRow({
  courseId,
  lesson,
  active,
  completed,
  duration,
  activeRef,
}: {
  courseId: string;
  lesson: Lesson;
  active: boolean;
  completed: boolean;
  duration?: number;
  activeRef?: React.Ref<HTMLAnchorElement>;
}) {
  return (
    <li>
      <Link
        ref={activeRef}
        href={`/course/${courseId}/learn/${lesson.id}`}
        className={cn(
          "flex items-start gap-2 rounded-md px-2 py-1.5 text-[13px] leading-snug transition-colors hover:bg-[#e3f2fd]/70",
          active && "bg-[#e3f2fd] text-[#1565c0]",
        )}
        aria-current={active ? "page" : undefined}
      >
        <span className="mt-px">
          {completed ? (
            <CheckCircle2Icon className="size-4 text-success" />
          ) : active ? (
            <PlayCircleIcon className="size-4 text-primary" />
          ) : (
            <CircleIcon className="size-4 text-[#cfd8dc]" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2">{lesson.title}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <KindIcon kind={lesson.kind} className="size-3" />
            {duration ? formatDuration(duration) : lesson.ext.toUpperCase()}
            {lesson.resources.length > 0 && <span>· {lesson.resources.length} files</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}
