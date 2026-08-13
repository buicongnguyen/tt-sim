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
  await access(new URL("TTSIM_DEBUGGING_PATH.md", root));
});

test("includes the layered mechanism debugging guide", async () => {
  const app = await readFile(new URL("../src/App.tsx", root), "utf8");
  const guide = await readFile(new URL("../docs/TTSIM_DEBUGGING_PATH.md", root), "utf8");
  assert.match(app, /id="debug"/);
  assert.match(app, /Follow one value through the machine/);
  assert.match(app, /Read and follow/);
  assert.match(app, /Single-core matmul debugging lab/);
  assert.match(app, /Compute engines and Tensix data flow/);
  assert.match(guide, /Host C\+\+ is a normal Linux process/);
  assert.match(guide, /BRISC, NCRISC, TRISC0, TRISC1 and TRISC2/);
  assert.match(guide, /TR0.*TR1.*TR2/);
});

test("provides a book-style chapter sidebar", async () => {
  const app = await readFile(new URL("../src/App.tsx", root), "utf8");
  const styles = await readFile(new URL("../src/styles.css", root), "utf8");
  assert.match(app, /className="book-sidebar"/);
  assert.match(app, /Reading progress/);
  assert.match(app, /aria-current=.*location/);
  assert.match(app, /id="notebook"/);
  assert.match(styles, /\.book-sidebar\s*{[^}]*position:sticky/s);
  assert.match(styles, /\.chapters-open \.book-sidebar/);
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
