"use client";

import type { HighlighterCore } from "shiki/core";

const LANGS = {
  python: () => import("shiki/langs/python.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  bash: () => import("shiki/langs/bash.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  r: () => import("shiki/langs/r.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  php: () => import("shiki/langs/php.mjs"),
  ini: () => import("shiki/langs/ini.mjs"),
} as const;

export type Lang = keyof typeof LANGS;

const BY_EXT: Record<string, Lang> = {
  py: "python",
  ipynb: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  json: "json",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  xml: "xml",
  r: "r",
  java: "java",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  hpp: "cpp",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  ini: "ini",
  cfg: "ini",
  env: "ini",
};

export function langForExt(ext: string): Lang | null {
  return BY_EXT[ext.toLowerCase()] ?? null;
}

export function langForName(name: string | undefined | null): Lang | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n in LANGS) return n as Lang;
  if (n === "py" || n === "python3" || n === "ipython3") return "python";
  return BY_EXT[n] ?? null;
}

let core: Promise<HighlighterCore> | null = null;
const loaded = new Set<Lang>();

async function getCore() {
  core ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);
    return createHighlighterCore({
      themes: [import("shiki/themes/github-light.mjs")],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  })();
  return core;
}

export async function highlight(code: string, lang: Lang | null): Promise<string | null> {
  if (!lang) return null;
  const h = await getCore();
  if (!loaded.has(lang)) {
    await h.loadLanguage((await LANGS[lang]()).default);
    loaded.add(lang);
  }
  return h.codeToHtml(code, { lang, theme: "github-light" });
}
