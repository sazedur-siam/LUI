"use client";

import { Loader2Icon } from "lucide-react";
import Papa from "papaparse";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { langForExt } from "@/lib/client/highlighter";
import { extOf } from "@/lib/files";
import { cn } from "@/lib/utils";
import type { FileKind } from "@/lib/types";

import { CodeBlock } from "./code-block";
import { FileActions } from "./file-actions";
import { FileCard } from "./file-card";
import { useFileText } from "./use-text";

interface Props {
  path: string;
  name: string;
  kind: FileKind;
  size: number;
  className?: string;
}

function Frame({ path, label, children, className }: Omit<Props, "name" | "kind" | "size"> & { label: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border bg-white", className)}>
      <div className="flex items-center justify-between border-b px-4 py-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <FileActions path={path} />
      </div>
      <div className="scrollbar-thin flex-1 overflow-auto">{children}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-48 items-center justify-center text-muted-foreground">
      <Loader2Icon className="size-5 animate-spin" />
    </div>
  );
}

export default function TextViewer(props: Props) {
  const { path, name, kind, size, className } = props;
  const { text, error, loading } = useFileText(path, size);

  if (error === "too-large") {
    return <FileCard {...props} message="This file is too large to preview here." className={className} />;
  }

  const ext = extOf(name);
  let content: React.ReactNode = <Loading />;
  if (error) content = <p className="p-10 text-center text-sm text-destructive">Could not read this file.</p>;
  else if (!loading && text != null) {
    if (kind === "markdown") {
      content = (
        <article className="prose prose-sm mx-auto max-w-3xl px-6 py-8 prose-headings:font-medium prose-a:text-primary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </article>
      );
    } else if (kind === "csv") {
      content = <CsvTable text={text} tsv={ext === "tsv"} />;
    } else if (kind === "code") {
      content = <CodeBlock code={text} lang={langForExt(ext)} className="m-4 border-0 bg-transparent" />;
    } else {
      content = <pre className="whitespace-pre-wrap p-6 font-mono text-[13px] leading-relaxed">{text}</pre>;
    }
  }

  return (
    <Frame path={path} label={name} className={className}>
      {content}
    </Frame>
  );
}

const MAX_ROWS = 1000;

function CsvTable({ text, tsv }: { text: string; tsv: boolean }) {
  const rows = useMemo(
    () => Papa.parse<string[]>(text, { delimiter: tsv ? "\t" : "", skipEmptyLines: true }).data,
    [text, tsv],
  );
  if (rows.length === 0) return <p className="p-10 text-center text-sm text-muted-foreground">Empty file.</p>;
  const [head, ...body] = rows;
  return (
    <div>
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="border-b bg-[#f1f7fd] px-3 py-2 text-left font-medium text-muted-foreground">#</th>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap border-b bg-[#f1f7fd] px-3 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.slice(0, MAX_ROWS).map((row, r) => (
            <tr key={r} className="hover:bg-[#f7fbff]">
              <td className="border-b px-3 py-1.5 tabular-nums text-muted-foreground">{r + 1}</td>
              {row.map((cell, c) => (
                <td key={c} className="max-w-xs truncate border-b px-3 py-1.5" title={cell}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-muted-foreground">
        {body.length > MAX_ROWS ? `Showing ${MAX_ROWS} of ${body.length} rows` : `${body.length} rows`}
      </p>
    </div>
  );
}
