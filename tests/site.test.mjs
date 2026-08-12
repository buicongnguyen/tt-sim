import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../dist/", import.meta.url);

test("builds a GitHub Pages-ready field guide", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /TT•SIM Lab/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
  await access(new URL("og.png", root));
});

test("uses relative built asset paths for project Pages", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /(?:src|href)="\.\/assets\//);
});

test("ships a persistent system-aware light and dark theme", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("../src/App.tsx", root), "utf8");
  const styles = await readFile(new URL("../src/styles.css", root), "utf8");
  assert.match(html, /ttsim-theme/);
  assert.match(html, /prefers-color-scheme: dark/);
  assert.match(app, /className="theme-toggle"/);
  assert.match(app, /localStorage\.setItem\("ttsim-theme"/);
  assert.match(styles, /:root\[data-theme="light"\]/);
});
