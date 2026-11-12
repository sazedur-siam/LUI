"use client";

import DOMPurify from "dompurify";
import { Loader2Icon } from "lucide-react";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { langForName } from "@/lib/client/highlighter";
import { cn } from "@/lib/utils";

import { CodeBlock } from "./code-block";
import { FileActions } from "./file-actions";
import { useFileText } from "./use-text";

type Source = string | string[];
interface Output {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  name?: string;
  text?: Source;
  data?: Record<string, Source>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}
interface Cell {
  cell_type: "markdown" | "code" | "raw";
  source: Source;
  execution_count?: number | null;
  outputs?: Output[];
}
interface Notebook {
  cells: Cell[];
  metadata?: { kernelspec?: { language?: string }; language_info?: { name?: string } };
}

const join = (s: Source | undefined) => (Array.isArray(s) ? s.join("") : (s ?? ""));
// Strip ANSI colour codes from tracebacks.
const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");

export default function NotebookViewer({
  path,
  size,
  className,
}: {
  path: string;
  size: number;
  className?: string;
}) {
  const { text, error, loading } = useFileText(path, size, 60 * 1024 * 1024);
  const notebook = useMemo(() => {
    if (!text) return null;
    try {
      return JSON.parse(text) as Notebook;
    } catch {
      return null;
    }
  }, [text]);

  const lang = langForName(notebook?.metadata?.language_info?.name ?? notebook?.metadata?.kernelspec?.language ?? "python");

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border bg-white", className)}>
      <div className="flex items-center justify-between border-b px-4 py-1.5">
        <span className="text-xs text-muted-foreground">
          Jupyter notebook{notebook ? ` · ${notebook.cells.length} cells` : ""}
        </span>
        <FileActions path={path} newTab={false} />
      </div>
      <div className="scrollbar-thin flex-1 overflow-auto">
        {loading && (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        )}
        {(error || (!loading && !notebook)) && (
          <p className="p-10 text-center text-sm text-destructive">Could not read this notebook.</p>
        )}
        {notebook && (
          <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-8">
            {notebook.cells.map((cell, i) => (
              <NotebookCell key={i} cell={cell} lang={lang} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NotebookCell({ cell, lang }: { cell: Cell; lang: ReturnType<typeof langForName> }) {
  const source = join(cell.source);
  if (cell.cell_type === "markdown") {
    return (
      <div className="prose prose-sm max-w-none prose-headings:font-medium prose-a:text-primary prose-code:rounded prose-code:bg-[#e3f2fd] prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#fafcff] prose-pre:text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
      </div>
    );
  }
  if (cell.cell_type === "raw") {
    return <pre className="whitespace-pre-wrap rounded-xl bg-muted p-4 font-mono text-xs">{source}</pre>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-[3.5rem_1fr]">
      <span className="hidden pt-3 text-right font-mono text-[11px] text-[#90a4ae] sm:block">
        [{cell.execution_count ?? " "}]
      </span>
      <div className="min-w-0 space-y-2">
        <CodeBlock code={source} lang={lang} />
        {cell.outputs?.map((o, i) => (
          <CellOutput key={i} output={o} />
        ))}
      </div>
    </div>
  );
}

function CellOutput({ output }: { output: Output }) {
  if (output.output_type === "stream") {
    return (
      <pre
        className={cn(
          "scrollbar-thin max-h-96 overflow-auto whitespace-pre-wrap px-4 py-1 font-mono text-xs",
          output.name === "stderr" && "rounded-lg bg-[#fff8e1]",
        )}
      >
        {join(output.text)}
      </pre>
    );
  }
  if (output.output_type === "error") {
    return (
      <pre className="scrollbar-thin max-h-96 overflow-auto rounded-lg bg-[#ffebee] p-3 font-mono text-xs text-[#c62828]">
        {stripAnsi((output.traceback ?? [`${output.ename}: ${output.evalue}`]).join("\n"))}
      </pre>
    );
  }
  const data = output.data ?? {};
  for (const mime of ["image/png", "image/jpeg", "image/gif"]) {
    if (data[mime]) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="Cell output" className="max-w-full rounded-lg" src={`data:${mime};base64,${join(data[mime]).trim()}`} />
      );
    }
  }
  if (data["image/svg+xml"]) {
    return (
      <div
        className="max-w-full overflow-auto"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(join(data["image/svg+xml"]), { USE_PROFILES: { svg: true } }) }}
      />
    );
  }
  if (data["text/html"]) {
    return (
      <div
        className="nb-html scrollbar-thin max-h-[32rem] overflow-auto px-1 text-xs [&_table]:border-collapse [&_td]:border [&_td]:border-[#e1ecf7] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[#e1ecf7] [&_th]:bg-[#f1f7fd] [&_th]:px-2 [&_th]:py-1 [&_th]:font-medium"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(join(data["text/html"])) }}
      />
    );
  }
  if (data["text/markdown"]) {
    return (
      <div className="prose prose-sm max-w-none px-1">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{join(data["text/markdown"])}</ReactMarkdown>
      </div>
    );
  }
  if (data["text/plain"]) {
    return (
      <pre className="scrollbar-thin max-h-96 overflow-auto whitespace-pre-wrap px-4 py-1 font-mono text-xs">
        {join(data["text/plain"])}
      </pre>
    );
  }
  return null;
}
