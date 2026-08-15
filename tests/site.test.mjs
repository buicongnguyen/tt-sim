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
  await access(new URL("COMPILER_RUNTIME_CAPSTONE.md", root));
  await access(new URL("TENSTORRENT_GENERATION_COMPARISON.md", root));
  await access(new URL("BLACKHOLE_VS_HUAWEI_ASCEND.md", root));
  await access(new URL("huawei.html", root));
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

test("publishes the fused linear compiler and runtime capstone", async () => {
  const app = await readFile(new URL("../src/App.tsx", root), "utf8");
  const styles = await readFile(new URL("../src/styles.css", root), "utf8");
  const guide = await readFile(new URL("../docs/COMPILER_RUNTIME_CAPSTONE.md", root), "utf8");
  const input = await readFile(new URL("../experiments/fused-linear-relu/input.mlir", root), "utf8");
  const expected = await readFile(new URL("../experiments/fused-linear-relu/expected.mlir", root), "utf8");
  const oracle = await readFile(new URL("../experiments/fused-linear-relu/oracle.py", root), "utf8");
  assert.match(app, /id="capstone"/);
  assert.match(app, /Y = ReLU\(A × B \+ bias\)/);
  assert.match(app, /const capstoneExperiments/);
  assert.match(app, /Recommended runtime lane/);
  assert.match(app, /Pre-silicon bring-up lane/);
  assert.match(styles, /\.capstone-roadmap/);
  assert.match(styles, /\.fusion-workbench/);
  assert.match(guide, /## The eight experiments/);
  assert.match(guide, /Simulator wall time predicts Blackhole silicon performance/);
  assert.match(input, /"lab\.matmul"/);
  assert.match(expected, /"lab\.fused_linear_relu"/);
  assert.match(oracle, /np\.testing\.assert_allclose/);
});

test("publishes a guarded Wormhole, Blackhole and Quasar source comparison", async () => {
  const app = await readFile(new URL("../src/App.tsx", root), "utf8");
  const report = await readFile(new URL("../docs/TENSTORRENT_GENERATION_COMPARISON.md", root), "utf8");
  const publishedReport = await readFile(new URL("TENSTORRENT_GENERATION_COMPARISON.md", root), "utf8");
  const script = await readFile(new URL("../scripts/05-architecture-evidence.sh", root), "utf8");
  assert.match(app, /id="generations"/);
  assert.match(app, /Better is a vector, not a verdict/);
  assert.match(app, /Quasar is pre-silicon, binary-only/);
  assert.match(app, /PACK_COUNT=1/);
  assert.match(report, /Quasar is not publicly proven faster than Blackhole/);
  assert.match(report, /28 Blackhole-only paths/);
  assert.match(report, /Not supported.*Quasar is already faster/s);
  assert.match(script, /Blackhole-only vs Wormhole/);
  assert.match(script, /early bring-up/);
  assert.equal(publishedReport, report);
});

test("builds a dedicated Blackhole versus Huawei Ascend page", async () => {
  const html = await readFile(new URL("huawei.html", root), "utf8");
  const app = await readFile(new URL("../src/HuaweiApp.tsx", root), "utf8");
  const styles = await readFile(new URL("../src/huawei.css", root), "utf8");
  const report = await readFile(new URL("../docs/BLACKHOLE_VS_HUAWEI_ASCEND.md", root), "utf8");
  const publishedReport = await readFile(new URL("BLACKHOLE_VS_HUAWEI_ASCEND.md", root), "utf8");
  assert.match(html, /Blackhole × Huawei Ascend/);
  assert.match(html, /(?:src|href)="\.\/assets\//);
  assert.match(app, /HBM is one axis/);
  assert.match(app, /not silently assigned to 910B\/910C/);
  assert.match(app, /144 GB \/ 4 TB\/s HBM/);
  assert.match(styles, /\.flow-pair/);
  assert.match(styles, /\.comparison-table/);
  assert.match(report, /There is no architecture-only winner/);
  assert.match(report, /future vendor roadmap/);
  assert.match(report, /32 GB HBM Gen2/);
  assert.equal(publishedReport, report);
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
