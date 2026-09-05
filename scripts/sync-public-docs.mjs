import { copyFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
// Publish every authored report so relative report-to-report links keep working.
const documents = (await readdir(new URL("../docs/", import.meta.url)))
  .filter((name) => name.endsWith(".md")).sort();

await mkdir(new URL("../public/", import.meta.url), { recursive: true });

for (const document of documents) {
  await copyFile(
    new URL(`../docs/${document}`, import.meta.url),
    new URL(`../public/${document}`, import.meta.url),
  );
}

console.log(`Synced ${documents.length} documents from ${root}docs to public/`);
