import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const documents = [
  "TENSTORRENT_GENERATION_COMPARISON.md",
  "BLACKHOLE_VS_HUAWEI_ASCEND.md",
];

await mkdir(new URL("../public/", import.meta.url), { recursive: true });

for (const document of documents) {
  await copyFile(
    new URL(`../docs/${document}`, import.meta.url),
    new URL(`../public/${document}`, import.meta.url),
  );
}

console.log(`Synced ${documents.length} architecture reports from ${root}docs to public/`);
