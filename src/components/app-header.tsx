import { GraduationCapIcon } from "lucide-react";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-medium tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <GraduationCapIcon className="size-[18px]" />
      </span>
      <span className="text-[15px]">LUI</span>
    </Link>
  );
}

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
    </header>
  );
}
