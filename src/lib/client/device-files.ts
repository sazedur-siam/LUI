"use client";

import { buildCourse, cyrb53, type FileEntry, humanize, isHidden } from "@/lib/course-builder";
import { isVanishedFileException, MissingFileError } from "@/lib/errors";

import { type DeviceCourseRecord, getDeviceCourse, putDeviceCourse } from "./device-db";

/* Chromium's File System Access API surface we use (not all of it is in lib.dom yet). */
type PermissionMode = { mode: "read" };
interface DirHandle extends FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
  queryPermission?(desc: PermissionMode): Promise<PermissionState>;
  requestPermission?(desc: PermissionMode): Promise<PermissionState>;
}
type PickerWindow = Window & {
  showDirectoryPicker?: (opts?: { id?: string; mode?: "read" | "readwrite" }) => Promise<DirHandle>;
};

export function supportsDirectoryPicker() {
  return typeof window !== "undefined" && typeof (window as PickerWindow).showDirectoryPicker === "function";
}

export function deviceCourseId(folderName: string) {
  return `d${cyrb53(`device:${folderName}`, 11)}`;
}

/* --------------------------- in-memory file access -------------------------- */

// Files picked this session (fallback browsers) and lazily resolved handle files.
const files = new Map<string, Map<string, File>>();
const handles = new Map<string, DirHandle>();
const urls = new Map<string, string>();

function fileMap(courseId: string) {
  let map = files.get(courseId);
  if (!map) files.set(courseId, (map = new Map()));
  return map;
}

export function hasLiveAccess(courseId: string) {
  return handles.has(courseId) || (files.get(courseId)?.size ?? 0) > 0;
}

export async function getDeviceFile(courseId: string, path: string): Promise<File> {
  const cached = files.get(courseId)?.get(path);
  if (cached) return cached;
  const handle = handles.get(courseId);
  if (!handle) throw new Error("Folder access is needed to open this file.");
  try {
    const parts = path.split("/");
    let dir: FileSystemDirectoryHandle = handle;
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    const file = await (await dir.getFileHandle(parts[parts.length - 1])).getFile();
    fileMap(courseId).set(path, file);
    return file;
  } catch (err) {
    if (isVanishedFileException(err) || (err instanceof TypeError && /not found/i.test(err.message))) {
      throw new MissingFileError(path);
    }
    throw err;
  }
}

/** Read a device file as text, reporting vanished files as MissingFileError. */
export async function readDeviceText(courseId: string, path: string) {
  const file = await getDeviceFile(courseId, path);
  try {
    return await file.text();
  } catch (err) {
    if (isVanishedFileException(err)) throw new MissingFileError(path);
    throw err;
  }
}

/** Object URL for a device file (cached for the session; File-backed, so cheap). */
export async function getDeviceFileUrl(courseId: string, path: string) {
  const key = `${courseId}|${path}`;
  const hit = urls.get(key);
  if (hit) return hit;
  const file = await getDeviceFile(courseId, path);
  // Untyped for Matroska: the browser sniffs the content instead of rejecting a "video/x-matroska" label.
  const blob = /\.(mkv|mka)$/i.test(path) ? file.slice(0, file.size, "") : file;
  const url = URL.createObjectURL(blob);
  urls.set(key, url);
  return url;
}

/* --------------------------------- scanning -------------------------------- */

async function walkHandle(dir: DirHandle, prefix: string, out: FileEntry[], map: Map<string, File>) {
  for await (const entry of dir.values()) {
    if (isHidden(entry.name)) continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "directory") {
      await walkHandle(entry as DirHandle, path, out, map);
    } else {
      const file = await (entry as FileSystemFileHandle).getFile();
      map.set(path, file);
      out.push({ path, size: file.size });
    }
  }
}

async function saveScan(opts: {
  folderName: string;
  entries: FileEntry[];
  map: Map<string, File>;
  handle?: DirHandle;
}): Promise<DeviceCourseRecord> {
  const id = deviceCourseId(opts.folderName);
  const title = humanize(opts.folderName);
  const course = buildCourse({ id, title, root: opts.folderName, files: opts.entries, hash: cyrb53 });
  if (course.lessonCount === 0) throw new Error("No lessons found in that folder.");

  // Keep object URLs for unchanged files (a video may be playing during a background rescan);
  // drop the ones whose file disappeared or changed.
  const previous = files.get(id);
  for (const [key, url] of urls) {
    if (!key.startsWith(`${id}|`)) continue;
    const path = key.slice(id.length + 1);
    const before = previous?.get(path);
    const after = opts.map.get(path);
    if (!after || (before && (before.size !== after.size || before.lastModified !== after.lastModified))) {
      URL.revokeObjectURL(url);
      urls.delete(key);
    }
  }
  files.set(id, opts.map);
  if (opts.handle) handles.set(id, opts.handle);

  const existing = await getDeviceCourse(id);
  const record: DeviceCourseRecord = {
    id,
    title,
    folderName: opts.folderName,
    addedAt: existing?.addedAt ?? Date.now(),
    scannedAt: Date.now(),
    course,
    handle: opts.handle ?? existing?.handle,
  };
  await putDeviceCourse(record);
  return record;
}

/** Chromium: pick a folder with a persistent handle. Returns null if the user cancels. */
export async function pickFolderWithHandle() {
  let handle: DirHandle;
  try {
    handle = await (window as PickerWindow).showDirectoryPicker!({ id: "lui-course", mode: "read" });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
  return scanHandle(handle);
}

export async function scanHandle(handle: DirHandle) {
  const entries: FileEntry[] = [];
  const map = new Map<string, File>();
  await walkHandle(handle, "", entries, map);
  return saveScan({ folderName: handle.name, entries, map, handle });
}

/** Safari / Firefox: files from an <input webkitdirectory> selection. */
export async function importFileList(list: FileList | File[]) {
  const all = Array.from(list);
  if (all.length === 0) return null;
  const folderName = (all[0].webkitRelativePath || all[0].name).split("/")[0];
  const entries: FileEntry[] = [];
  const map = new Map<string, File>();
  for (const file of all) {
    const rel = file.webkitRelativePath.split("/").slice(1).join("/");
    if (!rel) continue;
    entries.push({ path: rel, size: file.size });
    map.set(rel, file);
  }
  return saveScan({ folderName, entries, map });
}

/* ------------------------------ permissions -------------------------------- */

export type AccessState = "ready" | "needs-permission" | "needs-pick";

/** Whether this course's files can be read right now, without a user gesture. */
export async function checkAccess(record: DeviceCourseRecord): Promise<AccessState> {
  if (hasLiveAccess(record.id)) return "ready";
  const handle = record.handle as DirHandle | undefined;
  if (handle?.queryPermission) {
    const state = await handle.queryPermission({ mode: "read" }).catch(() => "denied" as PermissionState);
    if (state === "granted") {
      handles.set(record.id, handle);
      return "ready";
    }
    return "needs-permission";
  }
  return "needs-pick";
}

/** Must be called from a click handler (Chromium shows a one-click permission prompt). */
export async function requestAccess(record: DeviceCourseRecord): Promise<boolean> {
  const handle = record.handle as DirHandle | undefined;
  if (!handle?.requestPermission) return false;
  const state = await handle.requestPermission({ mode: "read" });
  if (state !== "granted") return false;
  handles.set(record.id, handle);
  return true;
}

/** Re-read a course's folder (after files were added or renamed). */
export async function rescanDeviceCourse(record: DeviceCourseRecord) {
  const handle = (handles.get(record.id) ?? record.handle) as DirHandle | undefined;
  if (!handle) return null;
  try {
    return await scanHandle(handle);
  } catch (err) {
    // The picked folder itself was moved, renamed or deleted.
    if (isVanishedFileException(err)) throw new MissingFileError(record.folderName);
    throw err;
  }
}
