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
  await access(new URL("WSL_AGENT_HOST_DEVICE_DEBUGGING.md", root));
  await access(new URL("BLACKHOLE_SMOKE_TEST.md", root));
  await access(new URL("SIMULATION_SEQUENCE.md", root));
  await access(new URL("QUASAR_CLUSTER_LAB.md", root));
  await access(new URL("COMPILER_RUNTIME_CAPSTONE.md", root));
  await access(new URL("TENSTORRENT_GENERATION_COMPARISON.md", root));
  await access(new URL("BLACKHOLE_VS_HUAWEI_ASCEND.md", root));
  await access(new URL("ASYNC_KERNELS_AND_MATRIX_GRANULARITY.md", root));
  await access(new URL("CONTRIBUTION_ROADMAP.md", root));
  await access(new URL("RISC_FIRMWARE_TO_KERNEL_FLOW.md", root));
  await access(new URL("huawei.html", root));
  await access(new URL("async-kernels.html", root));
  await access(new URL("firmware-flow.html", root));
});

test("publishes the WSL agent and host-to-device trace plan", async () => {
  const app = await readFile(new URL("../src/App.tsx", root), "utf8");
  const styles = await readFile(new URL("../src/styles.css", root), "utf8");
  const guide = await readFile(new URL("../docs/WSL_AGENT_HOST_DEVICE_DEBUGGING.md", root), "utf8");
  const publishedGuide = await readFile(new URL("WSL_AGENT_HOST_DEVICE_DEBUGGING.md", root), "utf8");
  const gdb = await readFile(new URL("../examples/gdb/quasar-host-device.gdb", root), "utf8");
  const launch = await readFile(new URL("../examples/vscode/launch.json", root), "utf8");
  assert.match(app, /Native agents, one Linux toolchain/);
  assert.match(app, /0x400254: 0x4005a00b/);
  assert.match(app, /agentHostDeviceFlow/);
  assert.match(styles, /\.agent-debug-workbench/);
  assert.match(styles, /\.host-device-trace/);
  assert.match(guide, /## Logic review/);
  assert.match(guide, /Rejected premises/);
  assert.match(guide, /program_run_args\.cpp:704/);
  assert.match(guide, /0x400254.*4005a00b/);
  assert.match(guide, /K0.*K1.*K2.*K3/s);
  assert.match(gdb, /program\.cpp:2211/);
  assert.match(gdb, /define tt-host-state/);
  assert.match(launch, /TT_METAL_CACHE/);
  assert.equal(publishedGuide, guide);
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
  const publishedGuide = await readFile(new URL("TTSIM_DEBUGGING_PATH.md", root), "utf8");
  const launch = await readFile(new URL("../examples/vscode/launch.json", root), "utf8");
  assert.match(app, /id="debug"/);
  assert.match(app, /Follow one value through the machine/);
  assert.match(app, /Read and follow/);
  assert.match(app, /Single-core matmul debugging lab/);
  assert.match(app, /Compute engines and Tensix data flow/);
  assert.match(app, /gdb: command not found/);
  assert.match(app, /BH VERIFIED/);
  assert.match(app, /two header lines and no TEST-FULL zones/);
  assert.match(guide, /Host C\+\+ is a normal Linux process/);
  assert.match(guide, /BRISC, NCRISC, TRISC0, TRISC1 and TRISC2/);
  assert.match(guide, /TR0.*TR1.*TR2/);
  assert.match(guide, /UnimplementedFunctionality: rv64_custom_0: funct3=2/);
  assert.match(guide, /tt::watcher::dump\(stderr, true\)/);
  assert.match(guide, /only 125 scopes per core/);
  assert.match(guide, /CSV contained only/);
  assert.match(launch, /build-debug\/test\/tt_metal\/unit_tests_legacy/);
  assert.match(launch, /libttsim_qsr\.so/);
  assert.equal(publishedGuide, guide);
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

test("publishes the hardware-free contribution roadmap", async () => {
  const app = await readFile(new URL("../src/App.tsx", root), "utf8");
  const guide = await readFile(new URL("../docs/CONTRIBUTION_ROADMAP.md", root), "utf8");
  const publishedGuide = await readFile(new URL("CONTRIBUTION_ROADMAP.md", root), "utf8");
  assert.match(app, /id="contribute"/);
  assert.match(app, /Kernel first, compiler connected/);
  assert.match(app, /60%.*kernel.*40%.*compiler/is);
  assert.match(app, /TT-MLIR × TT-Metal/);
  assert.match(app, /TTIR → TTNN → FlatBuffer → ttrt → TT-Metal/);
  assert.match(app, /TTIR → D2M → TTKernel \+ TTMetal/);
  assert.match(app, /AI agents must not claim bounties/);
  assert.match(guide, /Route simulator findings to the correct repository/);
  assert.match(guide, /How TT-MLIR combines with TT-Metal/);
  assert.match(guide, /compiler-only, simulator-backed and hardware-verified evidence/);
  assert.match(guide, /TT-MLIR lit\/FileCheck coverage/);
  assert.match(guide, /tt-emule/);
  assert.equal(publishedGuide, guide);
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
  assert.match(app, /What can Huawei learn from Tenstorrent's architecture/);
  assert.match(app, /Where is Huawei more advanced in architecture and performance/);
  assert.match(app, /784 GB\/s bidirectional D2D/);
  assert.match(app, /No public same-model, same-precision, same-power benchmark/);
  assert.match(styles, /\.flow-pair/);
  assert.match(styles, /\.comparison-table/);
  assert.match(styles, /\.qa-grid/);
  assert.match(report, /There is no architecture-only winner/);
  assert.match(report, /future vendor roadmap/);
  assert.match(report, /32 GB HBM Gen2/);
  assert.match(report, /## Question 1: What can Huawei learn from Tenstorrent/);
  assert.match(report, /## Question 2: Where is Huawei more advanced than Tenstorrent/);
  assert.match(report, /No trustworthy public apples-to-apples benchmark/);
  assert.equal(publishedReport, report);
});

test("publishes the asynchronous kernel and matrix granularity field note", async () => {
  const html = await readFile(new URL("async-kernels.html", root), "utf8");
  const app = await readFile(new URL("../src/AsyncKernelsApp.tsx", root), "utf8");
  const styles = await readFile(new URL("../src/async-kernels.css", root), "utf8");
  const report = await readFile(new URL("../docs/ASYNC_KERNELS_AND_MATRIX_GRANULARITY.md", root), "utf8");
  const publishedReport = await readFile(new URL("ASYNC_KERNELS_AND_MATRIX_GRANULARITY.md", root), "utf8");
  assert.match(html, /Async kernels × matrix granularity/);
  assert.match(html, /(?:src|href)="\.\/assets\//);
  assert.match(app, /Async is a.*contract/);
  assert.match(app, /8×16/);
  assert.match(app, /16 MVMUL/);
  assert.match(app, /SetFlag \/ WaitFlag/);
  assert.match(styles, /\.scope-workbench/);
  assert.match(styles, /\.face-grid/);
  assert.match(report, /Four such issues cover a 32×16 region/);
  assert.match(report, /noc_async_writes_flushed/);
  assert.match(report, /16×32 × 32×16 → 16×16 output/);
  assert.match(report, /Huawei matrix granularity/);
  assert.equal(publishedReport, report);
});

test("publishes the host-to-RISC firmware and operation-kernel flow", async () => {
  const html = await readFile(new URL("firmware-flow.html", root), "utf8");
  const app = await readFile(new URL("../src/FirmwareFlowApp.tsx", root), "utf8");
  const styles = await readFile(new URL("../src/firmware-flow.css", root), "utf8");
  const report = await readFile(new URL("../docs/RISC_FIRMWARE_TO_KERNEL_FLOW.md", root), "utf8");
  const publishedReport = await readFile(new URL("RISC_FIRMWARE_TO_KERNEL_FLOW.md", root), "utf8");
  assert.match(html, /Host to RISC firmware flow/);
  assert.match(html, /(?:src|href)="\.\/assets\//);
  assert.match(app, /Five RISCs/);
  assert.match(app, /No firmware relay/);
  assert.match(app, /DM0–DM7/);
  assert.match(app, /Run it twice/);
  assert.match(styles, /\.risc-sequence/);
  assert.match(styles, /\.phase-workbench/);
  assert.match(report, /NCRISC is not a firmware relay/);
  assert.match(report, /ProgramBinaryStatus::Committed/);
  assert.match(report, /Chunk B1–B2/);
  assert.match(report, /Chunk R6–R8/);
  assert.ok((report.match(/```mermaid/g) ?? []).length >= 10);
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
