export type FileKind =
  | "video"
  | "audio"
  | "pdf"
  | "html"
  | "notebook"
  | "csv"
  | "markdown"
  | "code"
  | "text"
  | "image"
  | "archive"
  | "document"
  | "file";

export interface ResourceFile {
  /** Display name (path relative to the resources folder). */
  name: string;
  /** POSIX path relative to the course root. */
  path: string;
  kind: FileKind;
  size: number;
}

export interface Lesson {
  id: string;
  number: number | null;
  title: string;
  fileName: string;
  /** POSIX path relative to the course root. */
  path: string;
  ext: string;
  kind: FileKind;
  size: number;
  moduleId: string;
  resources: ResourceFile[];
  /** Sidecar subtitle files (.srt / .vtt) next to a video, relative to course root. */
  subtitles: string[];
}

export interface Module {
  id: string;
  number: number | null;
  title: string;
  group: string | null;
  dirName: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  root: string;
  modules: Module[];
  lessonCount: number;
}

/** "guided" unlocks lessons in order; "open" (default when missing) leaves every lesson available. */
export type CourseAccess = "open" | "guided";

export interface CourseRecord {
  id: string;
  root: string;
  title: string;
  addedAt: number;
  access?: CourseAccess;
}

export interface LessonProgress {
  completed: boolean;
  /** Last playback position in seconds (video / audio). */
  position?: number;
  /** Last known media duration in seconds. */
  duration?: number;
  /** Last page viewed (PDF). */
  page?: number;
  /** Personal notes; may contain [m:ss] timestamps. */
  notes?: string;
  updatedAt: number;
}

export interface CourseProgress {
  lessons: Record<string, LessonProgress>;
  lastLessonId?: string;
  lastOpenedAt?: number;
}

export interface SubtitleTrack {
  label: string;
  lang?: string;
  src: string;
}

export type PlaybackMode = "direct" | "remux" | "transcode";

export interface PlaybackPlan {
  mode: PlaybackMode;
  /** Whether the source can be played now. Remux jobs need to finish first. */
  ready: boolean;
  /** 0..1 for remux jobs that are still running. */
  progress?: number;
  src: string;
  type: string;
  duration: number | null;
  hasVideo: boolean;
  subtitles: SubtitleTrack[];
  error?: string;
  /** Human readable codec summary, e.g. "H.264 · AAC · MKV". */
  summary: string;
}
