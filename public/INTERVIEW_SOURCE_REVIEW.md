# Interview preparation: source and logic review

Reviewed: **5 September 2026**.

The book is a study guide, not an upstream implementation or a hardware benchmark.
Use a short direct answer first; principal depth expands the same answer with
constraints, alternatives, trade-offs and validation. A proposed proof experiment
does not mean that experiment has been run.

## Source baseline

Implementation claims use [TT-Metal commit 50a82f835593512c4176546b4af68d7e91315a86](https://github.com/tenstorrent/tt-metal/tree/50a82f835593512c4176546b4af68d7e91315a86).
UMD references use [9bbe7bc93544029aadaa2b2bcbf39e774fa77f9a](https://github.com/tenstorrent/tt-umd/tree/9bbe7bc93544029aadaa2b2bcbf39e774fa77f9a).
These are historical study revisions, not an assertion that this is current main.
The compiler chapter separately names its TT-MLIR revision; never silently mix
that source snapshot with TT-Metal API or model-policy claims.

Links to official `latest` documentation are supplementary and can change.
For an interview statement about implementation, open the pinned GitHub file,
find the named function, read its caller and any architecture guards, and state
the revision and target. A successful URL or valid line range alone does not
prove that the linked code supports a claim.

## Corrections made

| Finding | Correction and interview consequence |
|---|---|
| Firmware-loader citations pointed at `impl/context/risc_firmware_initializer.cpp`, absent at the pinned commit | Corrected to `impl/device/firmware/risc_firmware_initializer.cpp` in both firmware/debug pages and reports. You can now follow the actual cold-boot writer. |
| Circular-buffer citations linked lines 832–1223, which contain NoC transfer code | Corrected to lines 195–485, containing push, pop, reserve and wait. A CB publication and a NoC completion barrier are separate contracts. |
| A UMD citation incorrectly treated submodule source as a normal TT-Metal file | Linked directly to the UMD repository at the recorded UMD revision. |
| Ascend flow combined the original 910 memory evidence with separated AIC/AIV and an unconditional FixPipe-to-UB arrow | Separated the product scopes. The cited CANN design sends L0C through FixPipe to GM/L1; AIV consumes via GM → MTE2 → UB. MTE3 is the Vector output path, not every Cube output path. |
| Reader/writer labels looked like fixed BRISC/NCRISC identities | Labeled them as program roles. The eltwise example has explicit processor assignments; the SDPA factory uses reader/writer descriptors. Follow the chosen configuration. |
| The 2.34 ratio and software feature inventory were used to suggest a comparative advantage | Kept the ratio as arithmetic only and removed unsupported performance/maturity rankings. Memory-interface and GM-to-local figures need a common measurement boundary. |
| Six answer steps used the five-letter mnemonic BETRV | Corrected to **BEOTRV**: Bottleneck, Evidence, Options, Trade-offs, Recommendation, Validation. |
| The personal introduction asserted custom-chip/retargeting ownership beyond the cited résumé | Narrowed Q48 to the named model ports, conversion/quantization and low-level debugging supported by the July résumé. |
| Valid JSON such as `null` in saved progress could crash the home guide; blocked storage writes could throw | Validate the saved object and keep the reader usable when storage is unavailable. |
| Reading progress did not update when filters, answers or diagrams changed page height | Observe chapter-content size as well as scrolling. |
| Copy actions rejected silently when clipboard permission was blocked | Handle rejection and show a manual-copy message in the command, presentation and quantization readers. |
| Report publishing used a manual list, leaving some reports unpublished | Publish every Markdown report and check published copies byte-for-byte. Deployment now requires lint and tests. |
| A relative Q&A link escaped the project URL after the report was published | Use the absolute public Q&A URL and validate local Markdown link targets in the build. |

## Claim-to-code reading map

Read these in order. The final column tells you what the source does **not** establish.

| Topic | Pinned code and what to inspect | Limit |
|---|---|---|
| Reader → compute → writer | [Eltwise program, lines 110–145](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/programming_examples/eltwise_binary/eltwise_binary.cpp#L110-L145): inspect `CreateKernel`, `DataMovementProcessor` and runtime arguments | Example assignment is not a hardware law; it is not proof of performance. |
| Buffer ownership | [Dataflow API, lines 195–485](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/api/dataflow/dataflow_api.h#L195-L485): `cb_push_back`, `cb_pop_front`, `cb_reserve_back`, `cb_wait_front` | Publishing a filled buffer does not substitute for completing an asynchronous transfer. |
| Transfer completion | [NoC barriers, lines 1743–1917](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/api/dataflow/dataflow_api.h#L1743-L1917): compare read, write, flushed, atomic and full barriers | Apply the right NoC and transaction domain; departure, completion and consumer readiness differ. |
| Compiler ordering | [Compiler fence, lines 10–17](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/tt-llk/common/ckernel_fence.h#L10-L17): empty inline assembly with a memory clobber | Does not complete CPU, NoC or device transactions. |
| Math/pack handoff | [Destination register API, lines 40–89](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/inc/api/compute/reg_api.h#L40-L89): acquire/commit on MATH and wait/release on PACK | This is a different ownership domain from a program-visible L1 semaphore. |
| Cold boot | [Firmware initialization, lines 1053–1199](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/device/firmware/risc_firmware_initializer.cpp#L1053-L1199): inspect HAL locations and processor iteration | Keep this separate from per-program kernel loading and GO/DONE. |
| SDPA decode pipeline | [Program factory, lines 790–823](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/ttnn/cpp/ttnn/operations/transformer/sdpa_decode/device/sdpa_decode_program_factory.cpp#L790-L823): follow reader/writer/compute source files and configuration descriptors | A factory's existence does not prove support for every head dimension, dtype or mesh. Read validation before configuration. |
| Datatype support | [Tensor types, lines 26–40](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/api/tt-metalium/tensor/tensor_types.hpp#L26-L40) and [linear binding, lines 824–898](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/ttnn/cpp/ttnn/operations/matmul/matmul_nanobind.cpp#L824-L898) | An enum entry is not operator support. BFLOAT8_B is block floating point, not scalar FP8 E4M3/E5M2 or affine INT8. |
| Model precision policy | [ModelOptimizations, lines 128–237](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/models/tt_transformers/tt/model_config.py#L128-L237): inspect model-name branches and tensor-role settings | Even accuracy mode can select lower precision for named large models; it does not mean every tensor is BF16. |

## Huawei and product evidence

Huawei topology claims here come from the official
[CANN 8.0 architecture guide](https://www.hiascend.com/document/detail/en/canncommercial/800/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html),
which distinguishes coupled and separated architectures. They are not claimed
as facts established by the Tenstorrent GitHub repository. The guide's indexed
text was available during review; direct page retrieval was unreliable.

The [Blackhole card table](https://tenstorrent.com/en/hardware/cards) was checked:
p150 lists 120 Tensix cores, 180 MB SRAM, 32 GB GDDR6 and 512 GB/s. These are
vendor product specifications, not this repository's measurements. A simulator
descriptor with 140 workers is a different boundary from the 120 enabled cores
on this card. Other historical Huawei/Atlas numerical citations remain dated
research evidence; this review did not revalidate every product number.

The [Ascend 950DT announcement](https://www.huawei.com/en/news/2025/9/hc-xu-keynote-speech)
is a vendor roadmap. Keep it separate from the original 910 paper and from
measured performance on an available system.

## How to use the 50 answers

| Questions | Preparation focus | Evidence to use |
|---|---|---|
| 1–8 | Objective, roofline, memory bandwidth, power and energy | These are reasoning methods. Define a measurement boundary and counter availability; a profiler link does not guarantee every suggested counter exists. |
| 9–16 | Local memory, tiling, buffering, prefetch and fusion | Use the ownership and barrier code above. Demonstrate the dependency before moving or removing a wait. |
| 17–24 | Attention, KV cache, prefill/decode and partitioning | Use SDPA validation, factory and model configuration links. Capacity formulas exclude metadata/padding unless explicitly included. |
| 25–31 | Quantization and precision | Separate numeric format, hardware capability, operator legality and model policy. Keep quality tests alongside speed tests. |
| 32–38 | Compiler/runtime contracts and debugging | Follow a named operator and its caller; the general compiler pipeline is a conceptual model, not a claim every backend has identical passes. |
| 39–47 | Scheduling, scaling and simulator/hardware boundaries | Experiments are proposed validation. Simulator wall time cannot prove silicon latency, bandwidth, power or thermal behavior. |
| 48–50 | Professional ownership and platform learning | The July résumé supports four named automotive model families, low-level debugging and conversion/quantization. It also records the EDA 80% result and C++/CUDA pipeline work. These are self-reported career outcomes, not independently verified by upstream source. |

Never present a suggested experiment, public upstream implementation, or local
study as a personal production result. Retain employer evidence boundaries.

## Repeat the review

The final online audit checked **264 distinct pinned citations across 145 GitHub
files**, with no missing files or out-of-range line anchors. This count is
structural coverage, not 264 independently proved technical claims.

```sh
npm run check:sources
npm run lint
npm test
```

The source checker reads authored `src/` and `docs/` files, resolves simple source
URL constants, fetches pinned public GitHub files, and checks line-range bounds.
It reports failures without modifying upstream repositories. Network errors
remain errors; they are not silently counted as successful validation.

Coverage limits: this is a structural audit of pinned blob citations plus a
manual semantic review of the mechanisms above and the 50-answer text. It is
not an exhaustive proof of every line of prose, every rolling documentation
URL, or every possible runtime interaction. Historical smoke logs remain dated
observations; no NPU hardware, compiler A/B experiment or simulator run was
performed in this review. The local NumPy oracle compares two host expressions;
it does not establish a generated fused device kernel's correctness.
