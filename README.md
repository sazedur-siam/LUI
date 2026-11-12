# LUI: local course player

LUI turns a folder on your computer into a course you can work through in the browser. Point it at a folder of videos, PDFs, notebooks and notes, and you get modules, lessons, a video player that handles almost any format, and progress tracking that remembers where you stopped.

It runs entirely on your machine. Nothing is uploaded, and your course folders are never modified.

Built with Next.js 16, React 19, shadcn/ui, Tailwind CSS 4, Video.js 10 and ffmpeg.

## Requirements

- Node.js 20 or newer (tested on 24)
- pnpm 11 (`corepack enable` sets it up)
- macOS, Linux or Windows. On macOS, video conversion uses the hardware encoder (VideoToolbox).

You don't need to install ffmpeg. `ffmpeg-static` and `ffprobe-static` download it during `pnpm install`.

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:3000, click **Add course**, and pick the course folder. You can browse to it or paste its full path.

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

If you add or rename files, use **Rescan folder** in the course menu (⋮).

## Video and audio playback

When you open a video, LUI checks its container and codecs with ffprobe, compares them with what your browser can play, and picks a route:

| Route | Used when | What happens |
|---|---|---|
| **Direct play** | The browser can play the file as it is, e.g. MP4, WebM, or H.264/AAC MKV in Chrome | The original file is streamed with seeking |
| **Optimized** | The video codec works but the container or audio doesn't, e.g. MKV in Safari, AC-3 or WMA audio | The file is repackaged into MP4 once without re-encoding (a few seconds) and cached |
| **Converting** | The browser can't decode the video, e.g. AVI (MPEG-4/Xvid), WMV, FLV, MPEG-2 | It's converted on the fly to HLS. Playback starts in about a second, and seeking ahead restarts conversion from that point. |

The route in use is shown under the player. If a file plays with a broken picture or sound, use **Playback issues? Convert**. If direct play fails, LUI falls back to the next route automatically.

Subtitles come from sidecar `.srt` / `.vtt` files and from text tracks embedded in the video, with English listed first.

## Other file types

| Type | Viewer |
|---|---|
| PDF | Built-in viewer with zoom and page jump. It remembers the last page you read. |
| HTML (articles, quizzes, flashcards) | Shown in a sandboxed frame. Quizzes stay interactive. |
| Jupyter notebooks (`.ipynb`) | Read-only view with highlighted code, outputs, images and tables |
| Markdown, code, text | Rendered or syntax-highlighted |
| CSV / TSV | Table view (first 1,000 rows) |
| Images | Inline preview |
| Archives, Office documents, others | Download, open with your default app, or show in Finder |

## Tracking progress

- Videos resume where you stopped and count as complete once you've watched 90%.
- Other lessons are marked with **Mark complete** or **Complete & continue**.
- With **Autoplay next** on, an "Up next" countdown starts when a video ends.
- The course page shows overall and per-module progress, the time left, and a **Continue** button that opens the right lesson.
- Shortcuts: `Shift+N` next lesson, `Shift+P` previous lesson. In the player: `Space`/`K` play/pause, `←`/`→` seek, `F` fullscreen, `C` captions, `<`/`>` speed.

## Where data is stored

Everything LUI saves lives in `.data/` in the project folder (git-ignored):

| Path | Contents |
|---|---|
| `.data/db.json` | Your course library and progress |
| `.data/cache/` | Probe results, durations, repackaged MP4s, HLS segments, extracted subtitles |

You can delete `.data/cache/` at any time; it is rebuilt as needed. Delete `db.json` only if you want to reset your library and progress.

### Environment variables

| Variable | Purpose |
|---|---|
| `LUI_DATA_DIR` | Store data somewhere other than `./.data` |
| `LUI_FFMPEG` / `LUI_FFPROBE` | Use your own ffmpeg / ffprobe binaries |

## Security

LUI serves files from the folders you add and can open them with your default apps, so it's meant for your own machine only. The `dev` and `start` scripts bind to `127.0.0.1`. Don't run it on `0.0.0.0` or expose it to a network.

- File requests can't reach outside a course folder, and symlinks that point elsewhere are rejected.
- Course HTML runs in a sandboxed, opaque origin, so quiz scripts can't reach the app's API.
- Notebook HTML output is sanitized before it's displayed.

## Development

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on http://127.0.0.1:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build on 127.0.0.1 |
| `pnpm lint` | ESLint, including the React Compiler rules |
| `pnpm typecheck` | TypeScript, without emitting files |

### Project layout

```
src/
├── app/
│   ├── page.tsx                     Library (course cards)
│   ├── actions.ts                   Server actions: add / rescan / reset / remove course
│   ├── course/[courseId]/           Course overview
│   │   └── learn/                   Lesson player (layout = sidebar, [lessonId] = lesson)
│   └── api/
│       ├── file/                    Course file streaming (Range support)
│       ├── media/                   Playback plans and ffmpeg output (MP4 / HLS)
│       ├── subs/                    Subtitles as WebVTT
│       ├── progress/                Save progress
│       ├── fs/                      Folder browser for "Add course"
│       └── reveal/                  Open file / show in Finder
├── components/
│   ├── viewers/                     Video player, PDF, notebook, text, file card
│   ├── learn/                       Sidebar, lesson view, progress context
│   └── ui/                          shadcn/ui components
└── lib/
    ├── server/                      Scanner, JSON store, ffprobe, media pipeline
    ├── client/                      Browser codec detection, syntax highlighting
    └── progress.ts, files.ts, …     Shared helpers and types
```

### Contributing

Work happens on short-lived branches (`feat/…`, `fix/…`, `docs/…`, `chore/…`) with [Conventional Commits](https://www.conventionalcommits.org/), merged into `main` through pull requests. Run `pnpm typecheck`, `pnpm lint` and `pnpm build` before opening one.
