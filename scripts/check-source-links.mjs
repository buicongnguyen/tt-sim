import { readFile, readdir } from "node:fs/promises";

// Read-only audit of the immutable GitHub citations in the authored book.
// This checks availability and line bounds, not whether prose follows from code.
const root = new URL("../", import.meta.url);
const references = new Map();
for (const directory of ["src", "docs"]) {
  for (const name of await readdir(new URL(`${directory}/`, root))) {
    if (!/\.(tsx?|md)$/.test(name)) continue;
    let source = await readFile(new URL(`${directory}/${name}`, root), "utf8");
    const constants = new Map();
    for (let pass = 0; pass < 4; pass++) {
      for (const match of source.matchAll(/const\s+(\w+)\s*=\s*(["'`])([^\r\n]*?)\2;/g)) {
        if (!match[3].includes("${")) constants.set(match[1], match[3]);
      }
      source = source.replace(/\$\{(\w+)\}/g, (whole, key) => constants.get(key) ?? whole);
    }
    for (const match of source.matchAll(/https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/blob\/[a-f0-9]{40}\/[^\s"'`<>)}\]]+/g)) {
      const href = match[0];
      const owners = references.get(href) ?? new Set();
      owners.add(`${directory}/${name}`);
      references.set(href, owners);
    }
  }
}

if (!process.argv.includes("--online")) {
  console.log(`Found ${references.size} distinct pinned GitHub citations. Use --online to verify files and line bounds.`);
  process.exit(0);
}

const grouped = new Map();
for (const [href, owners] of references) {
  const url = new URL(href);
  const raw = `https://raw.githubusercontent.com${url.pathname.replace("/blob/", "/")}`;
  const group = grouped.get(raw) ?? [];
  group.push({ href, owners: [...owners], hash: url.hash });
  grouped.set(raw, group);
}
const jobs = [...grouped];
let cursor = 0;
let checked = 0;
const failures = [];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cursor < jobs.length) {
    const [url, entries] = jobs[cursor++];
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      const count = content.replace(/\n$/, "").split("\n").length;
      checked++;
      for (const entry of entries) {
        const range = /^#L(\d+)(?:-L(\d+))?$/.exec(entry.hash);
        if (range && (+range[1] < 1 || +(range[2] ?? range[1]) > count || +(range[2] ?? range[1]) < +range[1])) {
          failures.push({ href: entry.href, owners: entry.owners, error: `Line range exceeds ${count} lines or is reversed` });
        }
      }
    } catch (error) {
      failures.push({ url, owners: [...new Set(entries.flatMap((entry) => entry.owners))], error: String(error) });
    }
  }
}));
console.log(JSON.stringify({ citations: references.size, files: jobs.length, checked, failures }, null, 2));
if (failures.length) process.exitCode = 1;
