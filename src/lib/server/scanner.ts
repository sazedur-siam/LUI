import "server-only";

import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { extOf, kindOf, SUBTITLE_EXTS } from "@/lib/files";
import type { Course, FileKind, Lesson, Module, ResourceFile } from "@/lib/types";

import { hashId } from "./paths";

const NUMBERED = /^(\d+)\s*[-_.)]\s*(.*)$/;
const RESOURCES_DIR = /^(\d+)\s*[-_ ]\s*resources?$/i;
const MODULE_GROUP = /^(.+?)[_ ]Module[_ ](.+)$/;
const IGNORED = new Set(["thumbs.db", "desktop.ini", "__macosx", "node_modules", ".ipynb_checkpoints"]);

const KIND_ORDER: FileKind[] = [
  "video",
  "audio",
  "html",
  "pdf",
  "notebook",
  "markdown",
  "text",
  "code",
  "csv",
  "image",
  "document",
  "archive",
  "file",
];

function isHidden(name: string) {
  return name.startsWith(".") || name.startsWith("~$") || IGNORED.has(name.toLowerCase());
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** "Transcribing_Audio_with_OpenAI_s_Whisper" -> "Transcribing Audio with OpenAI's Whisper" */
export function humanize(raw: string) {
  return raw
    .replace(/([A-Za-z])_s(?=_|$)/g, "$1's")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumbered(name: string) {
  const m = NUMBERED.exec(name);
  if (!m) return { number: null as number | null, rest: name };
  return { number: Number(m[1]), rest: m[2] || name };
}

function stripExt(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function toPosix(rel: string) {
  return rel.split(path.sep).join("/");
}

async function readDir(dir: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function sizeOf(file: string) {
  try {
    return (await fs.stat(file)).size;
  } catch {
    return 0;
  }
}

async function collectResources(root: string, dir: string, prefix = ""): Promise<ResourceFile[]> {
  const out: ResourceFile[] = [];
  const entries = (await readDir(dir)).filter((e) => !isHidden(e.name));
  entries.sort((a, b) => collator.compare(a.name, b.name));
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectResources(root, abs, `${prefix}${entry.name}/`)));
    } else if (entry.isFile()) {
      out.push({
        name: `${prefix}${entry.name}`,
        path: toPosix(path.relative(root, abs)),
        kind: kindOf(entry.name),
        size: await sizeOf(abs),
      });
    }
  }
  return out;
}

function moduleTitle(dirName: string) {
  const { number, rest } = parseNumbered(dirName);
  const grouped = MODULE_GROUP.exec(rest);
  if (grouped) return { number, group: humanize(grouped[1]), title: humanize(grouped[2]) };
  return { number, group: null, title: humanize(rest) };
}

/**
 * Scan one directory into zero or more modules: its own files form a module,
 * and any non-resource sub-folders become further modules (flattened).
 */
async function scanDir(
  root: string,
  dir: string,
  meta: { number: number | null; group: string | null; title: string },
): Promise<Module[]> {
  const entries = (await readDir(dir)).filter((e) => !isHidden(e.name));
  const relDir = toPosix(path.relative(root, dir));
  const moduleId = hashId(`module:${relDir}`, 10);

  const resourcesByNumber = new Map<number, ResourceFile[]>();
  const subDirs: Dirent[] = [];
  const files: Dirent[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const res = RESOURCES_DIR.exec(entry.name);
      if (res) {
        const list = await collectResources(root, path.join(dir, entry.name));
        const n = Number(res[1]);
        resourcesByNumber.set(n, [...(resourcesByNumber.get(n) ?? []), ...list]);
      } else {
        subDirs.push(entry);
      }
    } else if (entry.isFile()) {
      files.push(entry);
    }
  }

  // Pair subtitle sidecars with the video that shares their base name.
  const videoBases = new Map<string, string>();
  for (const f of files) if (kindOf(f.name) === "video") videoBases.set(stripExt(f.name).toLowerCase(), f.name);
  const subtitlesFor = new Map<string, string[]>();
  const lessonFiles: Dirent[] = [];
  for (const f of files) {
    if (SUBTITLE_EXTS.has(extOf(f.name))) {
      const base = stripExt(f.name).toLowerCase();
      // Match "video.srt" and "video.en.srt".
      const owner = videoBases.get(base) ?? videoBases.get(base.replace(/\.[a-z]{2,3}(-[a-z]{2})?$/, ""));
      if (owner) {
        const rel = toPosix(path.relative(root, path.join(dir, f.name)));
        subtitlesFor.set(owner, [...(subtitlesFor.get(owner) ?? []), rel]);
        continue;
      }
    }
    lessonFiles.push(f);
  }

  const lessons: Lesson[] = [];
  for (const f of lessonFiles) {
    const abs = path.join(dir, f.name);
    const rel = toPosix(path.relative(root, abs));
    const { number, rest } = parseNumbered(f.name);
    lessons.push({
      id: hashId(`lesson:${rel}`, 12),
      number,
      title: humanize(stripExt(rest)),
      fileName: f.name,
      path: rel,
      ext: extOf(f.name),
      kind: kindOf(f.name),
      size: await sizeOf(abs),
      moduleId,
      resources: [],
      subtitles: subtitlesFor.get(f.name) ?? [],
    });
  }

  lessons.sort((a, b) => {
    if (a.number !== b.number) {
      if (a.number == null) return 1;
      if (b.number == null) return -1;
      return a.number - b.number;
    }
    const ka = KIND_ORDER.indexOf(a.kind);
    const kb = KIND_ORDER.indexOf(b.kind);
    if (ka !== kb) return ka - kb;
    return collator.compare(a.fileName, b.fileName);
  });

  // Attach "N-Resources" folders to lesson N; orphans become their own items.
  for (const [n, resources] of [...resourcesByNumber].sort((a, b) => a[0] - b[0])) {
    const owner = lessons.find((l) => l.number === n);
    if (owner) {
      owner.resources.push(...resources);
      continue;
    }
    for (const r of resources) {
      lessons.push({
        id: hashId(`lesson:${r.path}`, 12),
        number: n,
        title: humanize(stripExt(r.name.split("/").pop() ?? r.name)),
        fileName: r.name,
        path: r.path,
        ext: extOf(r.name),
        kind: r.kind,
        size: r.size,
        moduleId,
        resources: [],
        subtitles: [],
      });
    }
  }

  const modules: Module[] = [];
  if (lessons.length > 0) {
    modules.push({ id: moduleId, number: meta.number, title: meta.title, group: meta.group, dirName: relDir, lessons });
  }

  subDirs.sort((a, b) => {
    const na = parseNumbered(a.name).number;
    const nb = parseNumbered(b.name).number;
    if (na != null && nb != null && na !== nb) return na - nb;
    return collator.compare(a.name, b.name);
  });

  for (const sub of subDirs) {
    const subMeta = moduleTitle(sub.name);
    const nested = relDir !== "";
    modules.push(
      ...(await scanDir(root, path.join(dir, sub.name), {
        number: subMeta.number,
        group: nested ? (meta.group ?? meta.title) : subMeta.group,
        title: nested ? `${meta.title} › ${subMeta.title}` : subMeta.title,
      })),
    );
  }

  return modules;
}

export function courseTitleFromPath(root: string) {
  return humanize(path.basename(path.resolve(root)));
}

export async function scanCourse(id: string, root: string, title: string): Promise<Course> {
  const modules = await scanDir(root, root, { number: null, group: null, title });
  return {
    id,
    title,
    root,
    modules,
    lessonCount: modules.reduce((n, m) => n + m.lessons.length, 0),
  };
}
