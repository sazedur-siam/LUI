"use client";

import { useEffect, useState } from "react";

import { highlight, type Lang } from "@/lib/client/highlighter";
import { cn } from "@/lib/utils";

export function CodeBlock({ code, lang, className }: { code: string; lang: Lang | null; className?: string }) {
  const [result, setResult] = useState<{ code: string; lang: Lang | null; html: string } | null>(null);
  const html = result && result.code === code && result.lang === lang ? result.html : null;

  useEffect(() => {
    let cancelled = false;
    if (lang && code.length < 400_000) {
      highlight(code, lang)
        .then((out) => !cancelled && out && setResult({ code, lang, html: out }))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const base = cn(
    "scrollbar-thin overflow-x-auto rounded-xl border bg-[#fafcff] text-[13px] leading-relaxed [&_pre]:!bg-transparent [&_pre]:p-4 [&_code]:font-mono",
    className,
  );

  if (html) return <div className={base} dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <div className={base}>
      <pre className="p-4">
        <code>{code}</code>
      </pre>
    </div>
  );
}
