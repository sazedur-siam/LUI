"use client";

import { applyProgressPatch, type ProgressPatch } from "@/lib/progress";
import type { Course, CourseProgress } from "@/lib/types";

/** A course whose folder lives on this device and is read by the browser. */
export interface DeviceCourseRecord {
  id: string;
  title: string;
  /** Name of the folder the user picked (used to match a re-opened folder). */
  folderName: string;
  addedAt: number;
  scannedAt: number;
  course: Course;
  /** Chromium only: persistent handle so the folder can be reopened without picking it again. */
  handle?: FileSystemDirectoryHandle;
}

const DB_NAME = "lui-device";
const VERSION = 1;
const COURSES = "courses";
const PROGRESS = "progress";
const DURATIONS = "durations";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(COURSES)) db.createObjectStore(COURSES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PROGRESS)) db.createObjectStore(PROGRESS);
      if (!db.objectStoreNames.contains(DURATIONS)) db.createObjectStore(DURATIONS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function store(name: string, mode: IDBTransactionMode = "readonly") {
  const db = await openDb();
  const tx = db.transaction(name, mode);
  return { tx, store: tx.objectStore(name) };
}

const EVENT = "lui:device-courses";

/** Let lists elsewhere in the app refresh after a change. */
function notify() {
  window.dispatchEvent(new Event(EVENT));
}

export function onDeviceCoursesChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export async function listDeviceCourses(): Promise<DeviceCourseRecord[]> {
  const { store: s } = await store(COURSES);
  return wrap(s.getAll() as IDBRequest<DeviceCourseRecord[]>);
}

export async function getDeviceCourse(id: string): Promise<DeviceCourseRecord | null> {
  const { store: s } = await store(COURSES);
  return ((await wrap(s.get(id))) as DeviceCourseRecord | undefined) ?? null;
}

export async function putDeviceCourse(record: DeviceCourseRecord) {
  const { tx, store: s } = await store(COURSES, "readwrite");
  s.put(record);
  await done(tx);
  notify();
}

export async function deleteDeviceCourse(id: string) {
  const db = await openDb();
  const tx = db.transaction([COURSES, PROGRESS, DURATIONS], "readwrite");
  tx.objectStore(COURSES).delete(id);
  tx.objectStore(PROGRESS).delete(id);
  tx.objectStore(DURATIONS).delete(id);
  await done(tx);
  notify();
}

export async function getDeviceProgress(id: string): Promise<CourseProgress> {
  const { store: s } = await store(PROGRESS);
  return ((await wrap(s.get(id))) as CourseProgress | undefined) ?? { lessons: {} };
}

export async function resetDeviceProgress(id: string) {
  const { tx, store: s } = await store(PROGRESS, "readwrite");
  s.put({ lessons: {} } satisfies CourseProgress, id);
  await done(tx);
  notify();
}

/** Read-modify-write in one transaction so concurrent saves don't clobber each other. */
export async function saveDeviceProgress(id: string, patches: ProgressPatch[]) {
  const { tx, store: s } = await store(PROGRESS, "readwrite");
  const req = s.get(id);
  req.onsuccess = () => {
    const progress = (req.result as CourseProgress | undefined) ?? { lessons: {} };
    for (const patch of patches) applyProgressPatch(progress, patch);
    s.put(progress, id);
  };
  await done(tx);
}

export async function getDeviceDurations(id: string): Promise<Record<string, number>> {
  const { store: s } = await store(DURATIONS);
  return ((await wrap(s.get(id))) as Record<string, number> | undefined) ?? {};
}

export async function putDeviceDurations(id: string, durations: Record<string, number>) {
  const { tx, store: s } = await store(DURATIONS, "readwrite");
  s.put(durations, id);
  await done(tx);
}
