"use client";

import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { KindIcon } from "@/components/kind-icon";
import { Bar } from "@/components/progress-visuals";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { groupColors } from "@/lib/colors";
import { formatDuration, KIND_LABEL } from "@/lib/files";
import { countCompleted, groupModules, moduleStats, percent, sumDurations } from "@/lib/progress";
import type { LessonProgress, Module } from "@/lib/types";

export function Curriculum({
  courseId,
  modules,
  progress,
  durations,
  openModuleId,
}: {
  courseId: string;
  modules: Module[];
  progress: Record<string, LessonProgress>;
  durations: Record<string, number>;
  openModuleId?: string;
}) {
  const colors = groupColors(modules.map((m) => m.group));
  const groups = groupModules(modules);

  return (
    <div className="space-y-10">
      {groups.map((group, gi) => {
        const color = colors.get(group.name ?? "") ?? "#1E88E5";
        const lessons = group.modules.flatMap((m) => m.lessons);
        const done = countCompleted(lessons, progress);
        return (
          <section key={`${group.name}-${gi}`} style={{ "--c": color } as CSSProperties}>
            {group.name && (
              <div className="mb-3 flex items-center gap-3">
                <span className="size-2.5 rounded-full" style={{ background: color }} />
                <h3 className="font-medium">{group.name}</h3>
                <span className="text-xs text-muted-foreground">
                  {group.modules.length} {group.modules.length === 1 ? "module" : "modules"} · {done}/{lessons.length}
                </span>
                <Bar value={percent(done, lessons.length)} color={color} className="ml-auto h-1 max-w-32" />
              </div>
            )}
            <Accordion
              type="multiple"
              defaultValue={openModuleId ? [openModuleId] : []}
              className="overflow-hidden rounded-2xl border bg-white"
            >
              {group.modules.map((m) => {
                const stats = moduleStats(m, progress);
                const total = sumDurations(m.lessons, durations);
                return (
                  <AccordionItem key={m.id} value={m.id} className="border-b last:border-b-0">
                    <AccordionTrigger className="items-center gap-3 px-4 py-3.5 hover:bg-[#f7fbff] hover:no-underline">
                      <span className="tint flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-medium tabular-nums">
                        {m.number != null ? String(m.number).padStart(2, "0") : "•"}
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium">{m.title}</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {m.lessons.length} lessons{total > 0 ? ` · ${formatDuration(total, "short")}` : ""}
                        </span>
                      </span>
                      {stats.done === stats.total ? (
                        <CheckCircle2Icon className="size-[18px] shrink-0 text-success" />
                      ) : (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {stats.done}/{stats.total}
                        </span>
                      )}
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      <ul className="px-2">
                        {m.lessons.map((l) => {
                          const p = progress[l.id];
                          const d = durations[l.id];
                          const resumeAt = !p?.completed && p?.position && p.position > 5 ? p.position : null;
                          return (
                            <li key={l.id}>
                              <Link
                                href={`/course/${courseId}/learn/${l.id}`}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[#f1f7fd]"
                              >
                                {p?.completed ? (
                                  <CheckCircle2Icon className="size-4 shrink-0 text-success" />
                                ) : (
                                  <CircleIcon className="size-4 shrink-0 text-[#cfd8dc]" />
                                )}
                                <KindIcon kind={l.kind} />
                                <span className="min-w-0 flex-1 truncate">{l.title}</span>
                                {l.resources.length > 0 && (
                                  <span className="hidden rounded-full bg-[#e3f2fd] px-2 py-0.5 text-[11px] text-[#1565c0] sm:inline">
                                    {l.resources.length} {l.resources.length === 1 ? "resource" : "resources"}
                                  </span>
                                )}
                                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                  {resumeAt ? (
                                    <span className="text-primary">{formatDuration(resumeAt)}</span>
                                  ) : d ? (
                                    formatDuration(d)
                                  ) : (
                                    KIND_LABEL[l.kind]
                                  )}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </section>
        );
      })}
    </div>
  );
}
