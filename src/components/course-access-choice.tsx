"use client";

import { LockIcon, LockOpenIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CourseAccess } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { value: CourseAccess; title: string; description: string; icon: typeof LockIcon }[] = [
  {
    value: "open",
    title: "All unlocked",
    description: "Open any lesson at any time.",
    icon: LockOpenIcon,
  },
  {
    value: "guided",
    title: "Guided",
    description: "Lessons unlock in order. Finish one to open the next.",
    icon: LockIcon,
  },
];

/** "How should lessons open?" Used when adding a course (local and device). */
export function CourseAccessChoice({
  value,
  onChange,
  idPrefix = "access",
}: {
  value: CourseAccess;
  onChange: (value: CourseAccess) => void;
  idPrefix?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>How should lessons open?</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v === "guided" ? "guided" : "open")}
        className="grid gap-2 sm:grid-cols-2"
      >
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            htmlFor={`${idPrefix}-${o.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-[#f7fbff]",
              value === o.value && "border-[#90caf9] bg-[#f1f7fd]",
            )}
          >
            <RadioGroupItem id={`${idPrefix}-${o.value}`} value={o.value} className="mt-0.5" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <o.icon className="size-3.5 text-[#1E88E5]" /> {o.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{o.description}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
