import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** Centered card used for empty, error and "not found" states. */
export function StatusNotice({
  icon,
  title,
  children,
  color = "#1E88E5",
  className,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-64 flex-1 items-center justify-center px-4 py-10", className)}>
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border bg-linear-to-b from-white to-[#f1f7fd] px-8 py-10 text-center text-sm text-muted-foreground">
        <span
          className="tint flex size-12 items-center justify-center rounded-xl [&_svg]:size-6"
          style={{ "--c": color } as CSSProperties}
        >
          {icon}
        </span>
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        {children}
      </div>
    </div>
  );
}
