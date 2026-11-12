/**
 * Turns a flat list of files (relative POSIX paths) into a Course. Pure and
 * environment-agnostic: used by the server scanner (Node fs) and by device
 * folders opened in the browser, so both build identical courses.
 */
import { extOf, kindOf, SUBTITLE_EXTS } from "./files";
import type { Course, FileKind, Lesson, Module, ResourceFile } from "./types";

export interface FileEntry {
  /** POSIX path relative to the course root, e.g. "01-Intro/1-Welcome.mkv". */
  path: string;
  size: number;
}

export type HashFn = (input: string, length: number) => string;

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

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function isHidden(name: string) {
  return name.startsWith(".") || name.startsWith("~$") || IGNORED.has(name.toLowerCase());
}

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

interface DirNode {
  name: string;
  /** Relative path of this directory ("" for the root). */
  path: string;
  dirs: Map<string, DirNode>;
  files: { name: string; path: string; size: number }[];
}

function buildTree(entries: FileEntry[]): DirNode {
  const root: DirNode = { name: "", path: "", dirs: new Map(), files: [] };
  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    if (parts.length === 0 || parts.some(isHidden)) continue;
    let node = root;
    for (const part of parts.slice(0, -1)) {
      let next = node.dirs.get(part);
      if (!next) {
        next = { name: part, path: node.path ? `${node.path}/${part}` : part, dirs: new Map(), files: [] };
        node.dirs.set(part, next);
      }
      node = next;
    }
    node.files.push({ name: parts[parts.length - 1], path: parts.join("/"), size: entry.size });
  }
  return root;
}

function collectResources(node: DirNode, prefix = ""): ResourceFile[] {
  const out: ResourceFile[] = [];
  const items: ({ dir: DirNode } | { file: DirNode["files"][number] })[] = [
    ...[...node.dirs.values()].map((dir) => ({ dir })),
    ...node.files.map((file) => ({ file })),
  ];
  items.sort((a, b) => collator.compare("dir" in a ? a.dir.name : a.file.name, "dir" in b ? b.dir.name : b.file.name));
  for (const item of items) {
    if ("dir" in item) {
      out.push(...collectResources(item.dir, `${prefix}${item.dir.name}/`));
    } else {
      out.push({ name: `${prefix}${item.file.name}`, path: item.file.path, kind: kindOf(item.file.name), size: item.file.size });
    }
  }
  return out;
}

function moduleMeta(dirName: string) {
  const { number, rest } = parseNumbered(dirName);
  const grouped = MODULE_GROUP.exec(rest);
  if (grouped) return { number, group: humanize(grouped[1]), title: humanize(grouped[2]) };
  return { number, group: null, title: humanize(rest) };
}

/**
 * One directory becomes zero or more modules: its own files form a module, and
 * any non-resource sub-folders become further modules (flattened).
 */
function scanDir(
  node: DirNode,
  meta: { number: number | null; group: string | null; title: string },
  hash: HashFn,
): Module[] {
  const moduleId = hash(`module:${node.path}`, 10);

  const resourcesByNumber = new Map<number, ResourceFile[]>();
  const subDirs: DirNode[] = [];
  for (const dir of node.dirs.values()) {
    const res = RESOURCES_DIR.exec(dir.name);
    if (res) {
      const n = Number(res[1]);
      resourcesByNumber.set(n, [...(resourcesByNumber.get(n) ?? []), ...collectResources(dir)]);
    } else {
      subDirs.push(dir);
    }
  }

  // Pair subtitle sidecars with the video that shares their base name.
  const videoBases = new Map<string, string>();
  for (const f of node.files) if (kindOf(f.name) === "video") videoBases.set(stripExt(f.name).toLowerCase(), f.name);
  const subtitlesFor = new Map<string, string[]>();
  const lessonFiles: DirNode["files"] = [];
  for (const f of node.files) {
    if (SUBTITLE_EXTS.has(extOf(f.name))) {
      const base = stripExt(f.name).toLowerCase();
      // Match "video.srt" and "video.en.srt".
      const owner = videoBases.get(base) ?? videoBases.get(base.replace(/\.[a-z]{2,3}(-[a-z]{2})?$/, ""));
      if (owner) {
        subtitlesFor.set(owner, [...(subtitlesFor.get(owner) ?? []), f.path]);
        continue;
      }
    }
    lessonFiles.push(f);
  }

  const lessons: Lesson[] = lessonFiles.map((f) => {
    const { number, rest } = parseNumbered(f.name);
    return {
      id: hash(`lesson:${f.path}`, 12),
      number,
      title: humanize(stripExt(rest)),
      fileName: f.name,
      path: f.path,
      ext: extOf(f.name),
      kind: kindOf(f.name),
      size: f.size,
      moduleId,
      resources: [],
      subtitles: subtitlesFor.get(f.name) ?? [],
    };
  });

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
        id: hash(`lesson:${r.path}`, 12),
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
    modules.push({ id: moduleId, number: meta.number, title: meta.title, group: meta.group, dirName: node.path, lessons });
  }

  subDirs.sort((a, b) => {
    const na = parseNumbered(a.name).number;
    const nb = parseNumbered(b.name).number;
    if (na != null && nb != null && na !== nb) return na - nb;
    return collator.compare(a.name, b.name);
  });

  const nested = node.path !== "";
  for (const sub of subDirs) {
    const subMeta = moduleMeta(sub.name);
    modules.push(
      ...scanDir(
        sub,
        {
          number: subMeta.number,
          group: nested ? (meta.group ?? meta.title) : subMeta.group,
          title: nested ? `${meta.title} › ${subMeta.title}` : subMeta.title,
        },
        hash,
      ),
    );
  }

  return modules;
}

export function buildCourse(opts: { id: string; title: string; root: string; files: FileEntry[]; hash: HashFn }): Course {
  const modules = scanDir(buildTree(opts.files), { number: null, group: null, title: opts.title }, opts.hash);
  return {
    id: opts.id,
    title: opts.title,
    root: opts.root,
    modules,
    lessonCount: modules.reduce((n, m) => n + m.lessons.length, 0),
  };
}

/** Small, fast, synchronous string hash (cyrb53) for ids in the browser. */
export function cyrb53(input: string, length: number) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
  return hex.repeat(Math.ceil(length / 16)).slice(0, length);
}
