# LUI: course player for your own folders

LUI turns a folder of videos, PDFs, notebooks and notes into a course you can work through in the browser. You get modules and lessons, a video player, notes, transcripts, and progress tracking that remembers where you stopped. Your files are never uploaded, and your course folders are never modified.

Built with Next.js 16, React 19, shadcn/ui, Tailwind CSS 4, Video.js 10, ffmpeg and Mediabunny.

## Two ways to use it

| | **Hosted** ([luilearn.vercel.app](https://luilearn.vercel.app)) | **Local** (`pnpm dev` on your computer) |
|---|---|---|
| How you add a course | **Open folder** picks a folder on the device you're using; the browser reads it | **Add course** picks any folder on that computer; the LUI server reads it |
| Where progress is saved | In that browser, per device | `.data/db.json` on that computer |
| Video formats | What the browser plays, plus MKV repackaged in the browser (see [Playback](#video-and-audio-playback)) | Almost anything: ffmpeg repackages or converts on the fly |
| Embedded subtitles (inside MKV) | Not available; `.srt` / `.vtt` files next to the video work | Yes |
| Open in default app / Show in Finder | No | Yes |

Each device keeps its own folders and progress. To move progress between devices or modes, use **Export progress** / **Import progress** in the course menu (⋮).

### Browser support for opening folders (hosted)

| Browser | Folder access |
|---|---|
| Chrome / Edge (desktop) | Remembers the folder. After a restart, click **Allow access** once. |
| Safari / Firefox (desktop) | Pick the folder again each visit. Progress is kept. |
| Phones / tablets | Mostly can't open folders. |

## Running it locally

Requirements:
- Node.js 20 or newer (tested on 24)
- pnpm 11 (`corepack enable` sets it up)
- macOS, Linux or Windows. On macOS, video conversion uses the hardware encoder (VideoToolbox).

You don't need to install ffmpeg. `ffmpeg-static` and `ffprobe-static` download it during `pnpm install`.

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:3000, click **Add course**, and pick the course folder. You can browse to it or paste its full path. **Open in browser** also works locally if you want a device-style course.

## How folders become courses

LUI reads the folder structure the way most downloaded courses are laid out:

```
My Course/
├── 01-Intro_to_AI_Module_Getting_started/     → module 1, topic "Intro to AI"
│   ├── 1-Welcome.mkv                          → lesson 1
│   ├── 1-Resources/                           → files attached to lesson 1
│   │   └── Course-notes.pdf
│   ├── 2-Weak_vs_Strong_AI.mkv                → lesson 2
│   ├── 2-Weak_vs_Strong_AI.en.srt             → subtitles for lesson 2
│   └── 2-Weak_vs_Strong_AI_-_Quiz.html        → lesson (quiz)
└── 02-Python_Module_Why_Python/               → module 2, topic "Python"
```

- Each sub-folder becomes a module, and each file becomes a lesson. Both are sorted by their leading number.
- `N-Resources/` folders are attached to lesson `N` as downloadable resources.
- `.srt` / `.vtt` files with the same name as a video are loaded as its subtitles.
- Folder names like `Topic_Module_Title` are grouped under "Topic". Underscores become spaces.
- Hidden files and system files (`.DS_Store`, `Thumbs.db`, …) are ignored.
- Folders nested deeper than one level become their own modules ("Parent › Child").

### When the folder changes

- **Local:** the scan refreshes on its own within seconds.
- **Hosted, Chrome/Edge:** the folder is re-read when you open the course, and a toast says what changed ("Course updated · 3 new").
- **Rescan:** you can also use **Rescan folder** in the course menu (⋮).
- **A file that moved or was renamed** shows "This file was moved or renamed" with a **Rescan** button.
- **A local course folder that moved:** the course offers **Change folder…**, which keeps all progress.

## Video and audio playback

**Local:** LUI checks each video's container and codecs with ffprobe, compares them with what your browser can play, and picks a route:

| Route | Used when | What happens |
|---|---|---|
| **Direct play** | The browser can play the file as it is, e.g. MP4, WebM, or H.264/AAC MKV in Chrome | The original file is streamed with seeking |
| **Optimized** | The video codec works but the container or audio doesn't, e.g. MKV in Safari, AC-3 or WMA audio | Repackaged into MP4 once, without re-encoding, and cached |
| **Converting** | The browser can't decode the video, e.g. AVI (MPEG-4/Xvid), WMV, FLV, MPEG-2 | Converted on the fly to HLS. Playback starts in about a second, and seeking ahead restarts conversion from that point. |

**Hosted:**
- Files play directly in the browser.
- In Safari and Firefox, MKV videos are **repackaged to MP4 inside the browser** (same video and audio, no quality loss, usually under a second). You'll see an "Optimizing for your browser…" step.
- Formats the browser can't decode at all (AVI, WMV, FLV) need the local version.

The route in use is shown under the player. If a file plays with a broken picture or sound, use **Playback issues? Convert / Repackage**. If direct play fails, LUI falls back to the next route automatically.

Subtitles come from sidecar `.srt` / `.vtt` files and, locally, from text tracks embedded in the video, with English listed first.

## Other file types

| Type | Viewer |
|---|---|
| PDF | Built-in viewer with zoom and page jump. It remembers the last page you read. |
| HTML (articles, quizzes, flashcards) | Shown in a sandboxed frame. Quizzes stay interactive. |
| Jupyter notebooks (`.ipynb`) | Read-only view with highlighted code, outputs, images and tables |
| Markdown, code, text | Rendered or syntax-highlighted |
| CSV / TSV | Table view (first 1,000 rows) |
| Images | Inline preview |
| Archives, Office documents, others | Download (locally also: open with your default app, or show in Finder) |

## Learning features

- **Progress:**
  - Videos resume where you stopped and count as complete at 90%.
  - Other lessons use **Mark complete** or **Complete & continue**.
  - The course page shows overall and per-module progress, time left, and **Continue**.
- **Autoplay next:** an "Up next" countdown starts when a video ends.
- **Playback speed:** remembered across lessons and visits. Use the `1×` chip under the player or the player's own menu.
- **Notes:**
  - Every lesson has a notes box.
  - While a video plays, press `N` to stamp the current time (`[3:21]`). Click a stamp to jump there.
  - The course page's **Notes** tab collects all notes, and its timestamps open the lesson at that moment.
- **Transcript:** on lessons with subtitles, **Transcript** (or `T`) shows the text under the video. It highlights the current line, and you can click any line to jump there, search it, switch language or copy it.
- **Guided courses:** when adding a course, choose **All unlocked** or **Guided**.
  - In a guided course, lessons unlock in order: finish one to open the next.
  - Next, autoplay and links stop at the first unfinished lesson.
  - Switch modes any time from the course menu; progress is kept.
  - This is a study aid, not access control. The files are yours and stay readable.
- **Hide completed:** the eye toggle in the sidebar hides finished lessons and modules.
- **Backup:** **Export progress** downloads a JSON file. **Import progress** merges it back, and completed lessons are never un-completed.
- **Shortcuts:**
  - `Shift+N` / `Shift+P` move to the next / previous lesson.
  - `N` adds a timestamped note, and `T` toggles the transcript.
  - In the player: `Space`/`K` play/pause, `←`/`→` seek, `F` fullscreen, `C` captions, `<`/`>` speed.

## Where data is stored

**Local** (in `.data/`, git-ignored):

| Path | Contents |
|---|---|
| `.data/db.json` | Library, progress, notes and course settings |
| `.data/cache/` | Probe results, durations, repackaged MP4s, HLS segments, extracted subtitles |

You can delete `.data/cache/` at any time; it is rebuilt as needed. Delete `db.json` only to reset your library and progress.

**Hosted:** courses, progress, notes and measured durations are stored in your browser's IndexedDB (`lui-device`). Clearing site data removes them, so export a backup first.

### Environment variables

| Variable | Purpose |
|---|---|
| `LUI_DATA_DIR` | Store data somewhere other than `./.data` |
| `LUI_FFMPEG` / `LUI_FFPROBE` | Use your own ffmpeg / ffprobe binaries |
| `LUI_SERVER_FILES` | `1` / `0` forces server file access on / off. The default is on, except on Vercel. |

## Security

**Local:**
- LUI serves files from the folders you add and can open them with your default apps, so it's meant for your own machine only.
- The `dev` and `start` scripts bind to `127.0.0.1`. Don't run it on `0.0.0.0` or expose it to a network.

**Hosted:**
- All server file access is disabled when LUI runs on Vercel.
- The file APIs return 403, so the server's own disk is never exposed.
- Course folders are read only by your browser.

Always:
- File requests can't reach outside a course folder, and symlinks that point elsewhere are rejected.
- Course HTML runs in a sandboxed, opaque origin, so quiz scripts can't reach the app or its storage.
- Notebook HTML output is sanitized before it's displayed.

## Development

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on http://127.0.0.1:3000 |
| `LUI_SERVER_FILES=0 pnpm dev` | Same, but behaving like the hosted site |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build on 127.0.0.1 |
| `pnpm lint` | ESLint, including the React Compiler rules |
| `pnpm typecheck` | TypeScript, without emitting files |

### Project layout

```
src/
├── app/
│   ├── page.tsx                     Library (local + device courses)
│   ├── actions.ts                   Server actions: add / relocate / rescan / reset / remove, import / export
│   ├── course/[courseId]/           Local course overview + learn/ (sidebar layout, lesson pages)
│   ├── device/[courseId]/           Device (browser-read) course overview + learn/
│   ├── not-found.tsx, error.tsx     Themed 404 and error pages
│   └── api/                         file, media, subs, progress, fs, reveal (local mode only)
├── proxy.ts                         Blocks the file APIs when server files are disabled (hosted)
├── components/
│   ├── source/                      CourseSource: where files come from (server or browser)
│   ├── device/                      Folder picker, device course gate, device pages and menu
│   ├── learn/                       Sidebar, lesson view, notes, transcript, progress + lock state
│   ├── viewers/                     Video player, PDF, notebook, text, file card, missing-file card
│   └── ui/                          shadcn/ui components
└── lib/
    ├── course-builder.ts            Folder → course (shared by server and browser)
    ├── lesson-access.ts             Guided-course lock rule
    ├── progress.ts, progress-transfer.ts, timestamps.ts, vtt.ts, subtitles.ts, …
    ├── server/                      Scanner, JSON store, ffprobe, media pipeline, mode switch
    └── client/                      IndexedDB, folder access, in-browser remux, codec detection
```

### Contributing

Work happens on short-lived branches (`feat/…`, `fix/…`, `docs/…`, `chore/…`) with [Conventional Commits](https://www.conventionalcommits.org/), merged into `main` through pull requests. `main` deploys to Vercel. Run `pnpm typecheck`, `pnpm lint` and `pnpm build` before opening a PR.
