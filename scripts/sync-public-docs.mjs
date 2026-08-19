import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const documents = [
  "WSL_AGENT_HOST_DEVICE_DEBUGGING.md",
  "TTSIM_DEBUGGING_PATH.md",
  "TENSTORRENT_GENERATION_COMPARISON.md",
  "BLACKHOLE_VS_HUAWEI_ASCEND.md",
  "ASYNC_KERNELS_AND_MATRIX_GRANULARITY.md",
  "RISC_FIRMWARE_TO_KERNEL_FLOW.md",
  "CONTRIBUTION_ROADMAP.md",
  "DISCUSSION.md",
  "DISCUSSION_BLACKHOLE_BRINGUP.md",
  "DISCUSSION_BLACKHOLE_SYNCHRONIZATION.md",
  "DISCUSSION_TRANSFORMER_BLACKHOLE_OPTIMIZATION.md",
  "DISCUSSION_PRESENTATION_30_MIN.md",
  "DISCUSSION_TT_METAL_QUANTIZATION.md",
  "DEBUG_LOW_LEVEL_KERNEL_FLOW.md",
];

await mkdir(new URL("../public/", import.meta.url), { recursive: true });

for (const document of documents) {
  await copyFile(
    new URL(`../docs/${document}`, import.meta.url),
    new URL(`../public/${document}`, import.meta.url),
  );
}

console.log(`Synced ${documents.length} documents from ${root}docs to public/`);
