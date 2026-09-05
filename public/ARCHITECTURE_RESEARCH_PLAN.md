# Architecture comparison research and publication plan

Date: **16 August 2026**

Primary TT-Metal snapshot: **`50a82f835593512c4176546b4af68d7e91315a86`**

## Objective

Explain, from code and technical documentation, what Blackhole improves over
Wormhole and what architectural direction Quasar takes beyond Blackhole. Then
publish:

1. a Wormhole → Blackhole → Quasar comparison chapter and technical report;
2. a separate Blackhole versus Huawei Ascend page;
3. a reproducible evidence-extraction script and evidence record.

The work must not turn “newer” into “faster in every workload.” Every use of
“better” must name the dimension being improved.

## Comparison questions

1. **Node scale:** how many addressable compute workers are described?
2. **Inside the worker:** which data-movement and compute processors exist?
3. **Local memory:** how much SRAM is exposed and which processors share it?
4. **Off-chip movement:** how many DRAM/PCIe/Ethernet endpoints are described?
5. **Low-level kernel contract:** which NoC, unpack, math and pack APIs differ?
6. **Data formats and math:** what capabilities are selected by architecture
   macros or LLK specializations?
7. **Compiler/runtime consequence:** what must placement, scheduling,
   bufferization and synchronization do differently?
8. **Maturity:** what can public ttsim actually execute today?

## Evidence order

Use the strongest available evidence for each claim:

1. pinned TT-Metal code and SoC descriptors;
2. official Tenstorrent or Huawei documentation and product specifications;
3. official ISA documentation or a primary architecture paper;
4. clearly labeled inference derived from two or more primary facts.

Do not use search-result snippets, rumors, reseller pages, leaked specifications
or unsourced accelerator tables as evidence.

## Execution plan

### Phase 1 — Freeze and extract

- Record the TT-Metal commit and ttsim release/hash.
- Parse Wormhole, Blackhole and Quasar simulator descriptors.
- Inspect HAL processor mappings for all three targets.
- Inspect Quasar's temporary host API and current single-DM kernel test.
- Diff architecture-specific low-level kernel directories and macro selections.
- Record exact source permalinks for every code-backed claim.

Deliverable: a script-generated Markdown evidence table.

### Phase 2 — Explain architectural evolution

- Separate higher **quantity** from new **capability**.
- Explain Blackhole's worker-count and external-I/O expansion over Wormhole.
- Identify low-level behavior that remains conceptually stable: explicit NoC
  movement, local SRAM, and reader/compute/writer pipelines.
- Explain Quasar's change in scheduling unit from one Tensix worker to a worker
  cluster with multiple DM cores and Neo engines.
- Mark Quasar descriptor counts as simulator-model evidence, not final-product
  specifications.

Deliverable: claim/evidence/impact/caveat rows and an execution-flow diagram.

### Phase 3 — Compare Blackhole with Huawei Ascend

- Use the original Ascend 910 where official HBM2 specifications are public.
- Treat 910B/910C details as unknown unless an official public source states
  them.
- Compare memory philosophy, execution unit, programming stack, scale-out and
  public software visibility—not only peak arithmetic numbers.
- Explain that HBM bandwidth and local-SRAM/dataflow design solve different
  bottlenecks and cannot be ranked from memory technology alone.

Deliverable: a separate accessible `huawei.html` page with evidence-strength
labels and a dedicated bibliography.

### Phase 4 — Implement and review

- Add the Tenstorrent generation chapter to the existing React page.
- Add the Huawei comparison as a second Vite HTML entry.
- Add standalone Markdown reports to GitHub Pages.
- Add automated tests for both routes, exact caution statements, evidence files
  and relative asset paths.
- Run the evidence script in WSL, NumPy/site tests, TypeScript build and lint.
- Review every numeric cell against its cited source.
- Commit only the intended files, push `main` through the SSH remote and verify
  both deployed URLs.

## Logic review of this plan

### Premise review

- **Rejected premise:** “Blackhole is simply better than Wormhole.” A design can
  improve density, bandwidth or features while a workload, cost, power envelope
  or software version favors the older target.
- **Rejected premise:** “Quasar is proven faster than Blackhole.” Public Quasar
  is pre-silicon and its simulator is in bring-up; no performance conclusion is
  justified.
- **Accepted testable statement:** Blackhole expands several resources and
  capabilities visible in official code/specifications relative to Wormhole.
- **Accepted testable statement:** Quasar changes the public programming model
  toward multi-engine worker clusters, which can expose more within-node
  concurrency and shared-locality opportunities if software schedules them.

### Comparability review

- A Wormhole/Blackhole worker and a Quasar cluster are not equivalent units.
- Product-card enabled-core counts and simulator-descriptor functional-worker
  counts are different datasets and will not be silently mixed.
- HBM versus GDDR6 is one memory-system property; usable bandwidth, capacity,
  locality, power and software scheduling must be discussed separately.
- Peak TOPS/TFLOPS values with different formats, sparsity rules or clocks are
  not placed in one ranking column unless the definitions match.

### Causality review

- Resource count supports a capacity/concurrency claim, not a realized-speed
  claim.
- A new instruction or data format supports a capability claim, not proof that
  a compiler uses it effectively.
- Fusion supports the possibility of fewer intermediates; measurements must
  prove allocation or traffic reductions.

## Code review checklist for the implementation

- [x] Every architecture number has a nearby evidence link or evidence-type label.
- [x] Inferences use words such as “suggests,” “can,” or “if scheduled.”
- [x] Quasar carries pre-silicon and simulator-model warnings in every summary.
- [x] Huawei family claims distinguish official Ascend 910 facts from unknown
      910B/910C details.
- [x] The second page has its own title, description and canonical content.
- [x] Both pages work with GitHub Pages' relative base path.
- [x] Tables scroll on small screens; diagrams collapse without losing order.
- [x] Tabs use accessible roles and selected state.
- [x] External links use primary sources or an explicitly labeled technical source.
- [x] Tests assert the caution statements, not only the attractive headline.
- [x] Production build and lint pass with zero warnings.
- [x] The repository is clean after the SSH push.

## Execution and review record

- The evidence script ran successfully against the pinned WSL TT-Metal checkout
  and generated
  `/home/n/ttsim-lab-results/architecture-evidence-20260815T173627Z/tt-metal-evidence.md`.
- The source audit counted 150 Wormhole, 177 Blackhole and 59 Quasar LLK files;
  28 paths are Blackhole-only versus Wormhole and 128 Blackhole paths are absent
  from the current Quasar tree.
- Card ratios were recalculated from official n150/p150 tables instead of copied
  from a secondary comparison.
- The HBM review separated original Ascend 910 evidence, unknown 910B/910C
  details and the future Ascend 950 roadmap.
- The review rejected wrapper-level ReLU/matmul diffs as performance evidence and
  retained the official packer-counter difference as a counterexample.
- The two-report sync is tested byte-for-byte, both Vite entries use relative
  production assets, Bash syntax checks pass, and the TypeScript build, 11 site
  tests and ESLint pass.

## Definition of done

The work is complete only when the evidence extraction is reproducible, the
claims survive the logic checklist, both web routes build, tests pass, GitHub
Pages deploys successfully, and the live pages contain the new comparison text.
