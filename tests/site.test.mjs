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
  await access(new URL("BLACKHOLE_SMOKE_TEST.md", root));
  await access(new URL("SIMULATION_SEQUENCE.md", root));
  await access(new URL("QUASAR_CLUSTER_LAB.md", root));
});

test("documents the verified Blackhole smoke test", async () => {
  const app = await readFile(new URL("../src/App.tsx", root), "utf8");
  const record = await readFile(new URL("../docs/BLACKHOLE_SMOKE_TEST.md", root), "utf8");
  assert.match(app, /id="verified"/);
  assert.match(app, /50a82f83559/);
  assert.match(app, /device_id=0xb140/);
  assert.match(app, /Dispatch telemetry SMC buffer unavailable/);
  assert.match(app, /--build-programming-examples/);
  assert.match(record, /RESULT: PASS/);
  assert.match(record, /Success: Result is 21/);
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

test("documents detailed Blackhole and Quasar simulation sequences", async () => {
  const app = await readFile(new URL("../src/App.tsx", root), "utf8");
  const styles = await readFile(new URL("../src/styles.css", root), "utf8");
  const record = await readFile(new URL("../docs/SIMULATION_SEQUENCE.md", root), "utf8");
  assert.match(app, /id="sequences"/);
  assert.match(app, /Blackhole TT-Sim successful execution sequence/);
  assert.match(app, /Quasar TT-Sim successful execution sequence/);
  assert.match(app, /rv64_custom_0/);
  assert.match(app, /0x12345678/);
  assert.match(styles, /\.sequence-svg/);
  assert.match(styles, /\.detour-flow/);
  assert.match(record, /sequenceDiagram/);
  assert.match(record, /device_id=0xb140/);
  assert.match(record, /device_id=0xfeed/);
  assert.match(record, /NOC_API_V2/);
});

test("explains Quasar clusters and ships a repeatable architecture lab", async () => {
  const app = await readFile(new URL("../src/App.tsx", root), "utf8");
  const styles = await readFile(new URL("../src/styles.css", root), "utf8");
  const guide = await readFile(new URL("../docs/QUASAR_CLUSTER_LAB.md", root), "utf8");
  const script = await readFile(new URL("../scripts/03-quasar-cluster-lab.sh", root), "utf8");
  assert.match(app, /id="architecture"/);
  assert.match(app, /Quasar is cluster-oriented/);
  assert.match(app, /8 DM cores/);
  assert.match(app, /4 Tensix Neo engines/);
  assert.match(app, /4 MiB shared SRAM/);
  assert.match(app, /DM0–DM1 are reserved/);
  assert.match(app, /8×4 rectangle/);
  assert.match(app, /MeshDevice/);
  assert.match(styles, /\.cluster-anatomy/);
  assert.match(styles, /\.architecture-table/);
  assert.match(guide, /cluster-oriented inside the chip/);
  assert.match(guide, /two separate passes/);
  assert.match(script, /QuasarMeshDeviceSingleCardFixture\.SingleDmL1Write/);
  assert.match(script, /architecture-report\.md/);
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
