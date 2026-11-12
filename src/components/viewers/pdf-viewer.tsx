"use client";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { ChevronDownIcon, ChevronUpIcon, Loader2Icon, MinusIcon, PlusIcon, ScanIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { Button } from "@/components/ui/button";
import { useFileUrl } from "@/components/source/course-source";
import { cn } from "@/lib/utils";

import { FileActions } from "./file-actions";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export interface PdfViewerProps {
  path: string;
  initialPage?: number;
  onPage?: (page: number, total: number) => void;
  className?: string;
}

export default function PdfViewer({ path, initialPage, onPage, className }: PdfViewerProps) {
  const url = useFileUrl(path);
  const scroller = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [visible, setVisible] = useState<Set<number>>(() => new Set([1, 2]));
  const [pageInput, setPageInput] = useState("1");

  // Fit pages to the container width.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.min(entry.contentRect.width - 48, 960)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Only render pages near the viewport.
  useEffect(() => {
    const root = scroller.current;
    if (!root || numPages === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev);
          for (const e of entries) if (e.isIntersecting) next.add(Number((e.target as HTMLElement).dataset.page));
          return next.size === prev.size ? prev : next;
        });
      },
      { root, rootMargin: "1200px 0px" },
    );
    pageRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [numPages]);

  const scrollToPage = useCallback((page: number, smooth = true) => {
    const el = pageRefs.current[page - 1];
    if (el && scroller.current) {
      scroller.current.scrollTo({ top: el.offsetTop - 16, behavior: smooth ? "smooth" : "auto" });
    }
  }, []);

  // Track the current page while scrolling.
  const onScroll = () => {
    const root = scroller.current;
    if (!root) return;
    const probe = root.scrollTop + root.clientHeight * 0.35;
    let page = 1;
    for (let i = 0; i < pageRefs.current.length; i++) {
      const el = pageRefs.current[i];
      if (el && el.offsetTop <= probe) page = i + 1;
    }
    if (page !== current) {
      setCurrent(page);
      setPageInput(String(page));
      onPage?.(page, numPages);
    }
  };

  const pageWidth = Math.max(240, width * zoom);
  const placeholderHeight = Math.round(pageWidth * 1.294);

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border bg-white", className)}>
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <Button variant="ghost" size="icon-sm" disabled={current <= 1} onClick={() => scrollToPage(current - 1)}>
          <ChevronUpIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={current >= numPages}
          onClick={() => scrollToPage(current + 1)}
        >
          <ChevronDownIcon />
        </Button>
        <form
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Math.min(numPages, Math.max(1, Number(pageInput) || 1));
            scrollToPage(n);
          }}
        >
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
            className="h-7 w-10 rounded-md border bg-white text-center text-xs text-foreground outline-none focus:border-primary"
            aria-label="Page number"
          />
          <span>/ {numPages || "–"}</span>
        </form>
        <div className="mx-2 h-4 w-px bg-border" />
        <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}>
          <MinusIcon />
        </Button>
        <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}>
          <PlusIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setZoom(1)} aria-label="Fit width">
          <ScanIcon />
        </Button>
        <div className="ml-auto">
          <FileActions path={path} />
        </div>
      </div>

      <div ref={scroller} onScroll={onScroll} className="scrollbar-thin relative flex-1 overflow-auto bg-[#f4f5f8]">
        {url && (
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n);
            const start = Math.min(n, Math.max(1, initialPage ?? 1));
            setCurrent(start);
            setPageInput(String(start));
            if (start > 1) {
              setVisible(new Set([start - 1, start, start + 1]));
              requestAnimationFrame(() => requestAnimationFrame(() => scrollToPage(start, false)));
            }
          }}
          loading={
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <Loader2Icon className="size-5 animate-spin" />
            </div>
          }
          error={<p className="p-10 text-center text-sm text-destructive">Could not open this PDF.</p>}
          className="flex flex-col items-center gap-4 px-6 py-6"
        >
          {Array.from({ length: numPages }, (_, i) => (
            <div
              key={i}
              ref={(el) => {
                pageRefs.current[i] = el;
              }}
              data-page={i + 1}
              className="overflow-hidden rounded-md bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_-8px_rgba(0,0,0,0.15)]"
              style={{ width: pageWidth, minHeight: visible.has(i + 1) ? undefined : placeholderHeight }}
            >
              {visible.has(i + 1) && (
                <Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  loading={<div style={{ height: placeholderHeight }} />}
                  renderAnnotationLayer
                  renderTextLayer
                />
              )}
            </div>
          ))}
        </Document>
        )}
      </div>
    </div>
  );
}
