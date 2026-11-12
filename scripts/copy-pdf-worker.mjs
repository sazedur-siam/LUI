// Copies the pdf.js worker into /public so react-pdf can load it without bundler tricks.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const dest = path.join(process.cwd(), "public", "pdf.worker.min.mjs");
mkdirSync(path.dirname(dest), { recursive: true });
copyFileSync(src, dest);
