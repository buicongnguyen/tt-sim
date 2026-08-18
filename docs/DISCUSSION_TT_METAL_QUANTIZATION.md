# Discussion subpage 05 — quantization and mixed precision on TT-Metal

Prepared: **19 August 2026**
Source baseline: **TT-Metal `50a82f835593512c4176546b4af68d7e91315a86`**
Primary target: **TTNN/TT-Metal LLM inference, with Blackhole in mind**
Interactive page: <https://buicongnguyen.github.io/tt-sim/discussion-quantization.html>

## Executive answer

For the pinned generic TTNN LLM path, begin with a BF16/accuracy baseline, move
weights and selected long-lived tensors to **BFLOAT8_B**, and then test
**BFLOAT4_B** on insensitive tensor roles such as FF1/FF3 MLP weights. Keep
normalization, residual paths and sensitive accumulation/output paths wider until
measurement proves they can be narrowed.

Do **not** start by changing every tensor to INT8:

- `DataType::INT8` exists in TT-Metal.
- Blackhole LLK contains integer-format and INT8-math machinery.
- The current generic [`ttnn.linear` contract](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/ttnn/cpp/ttnn/operations/matmul/matmul_nanobind.cpp#L824-L898)
  lists BFLOAT16, FLOAT32, BFLOAT8_B and BFLOAT4_B tile inputs—not INT8.
- [`ttnn.to_dtype(INT8)` is documented as a host conversion](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/ttnn/cpp/ttnn-nanobind/operations/core.cpp#L239-L269),
  and the elementwise quantization API currently produces INT32 or UINT8.

The correct conclusion is not “Tenstorrent has no INT8 hardware.” It is:

> Hardware/LLK datatype capability, tensor construction, an elementwise
> quantization utility and a supported end-to-end LLM matmul path are four
> different contracts.

## Three meanings of quantization

| Meaning | Mechanism | Current practical use |
|---|---|---|
| Block floating point | several values share exponent information; each value carries a small payload | mainstream TTNN LLM mixed precision with BFP8_B/BFP4_B |
| Affine integer quantization | `q = round(x / scale) + zero_point`, then dequantize with scale/zero point | `ttnn.quantize`, `requantize`, `dequantize`; utility or custom integer graph work |
| Low-level format capability | packer/unpacker/FPU/SFPU and `DataFormat` understand an integer, FP8 or MX representation | LLK tests and custom kernels; per-architecture/per-operation legality still required |

Do not call BFP4 “INT4.” Both may store a small value field, but their numerical
contracts and scaling metadata are different.

## Format ledger

### Public TT-Metal tensor datatypes

The pinned [`DataType` enum](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/api/tt-metalium/tensor/tensor_types.hpp#L26-L40)
contains:

```text
BFLOAT16, FLOAT32, UINT32, BFLOAT8_B, BFLOAT4_B,
UINT8, UINT16, INT32, FP8_E4M3, INT8
```

This list describes representable tensor datatypes. Each operation still defines
its own legal inputs, layout, memory placement, architecture and output rules.

### Storage of a standard 32×32 tile

A standard tile contains 1,024 values. TT-Metal's constants define a BF16 tile
as 2,048 data bytes, a BFLOAT8_B tile as 1,024 value bytes plus a 64-byte
exponent section, and a BFLOAT4_B tile as 512 value bytes plus that exponent
section. See [`constants.hpp:13–21`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/api/tt-metalium/constants.hpp#L13-L21).

| Format | Standard tile bytes | Difference versus BF16 | Current interpretation |
|---|---:|---:|---|
| FLOAT32 | 4,096 | 100% more | wide debug/reference or operations that need it |
| BFLOAT16 | 2,048 | baseline | correctness and sensitive paths |
| BFLOAT8_B | 1,088 | 46.875% less | first practical LLM compression step |
| BFLOAT4_B | 576 | 71.875% less | selective low-precision weights |
| UINT8 / INT8 / FP8_E4M3 | 1,024 | 50% less | operation-specific; not generic LLM linear inputs here |
| MXFP4 | 544 bytes in the cited Quasar/DFB test path | 73.4375% less | low-level/experimental; not a generic TTNN datatype |

The MX calculation comes from [`Tile::get_tile_size`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/impl/data_format/tile.cpp#L70-L100):
one E8M0 scale byte per 32-element block plus packed elements. The low-level
[`DataFormat` enum](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/api/tt-metalium/tt_backend_api_types.hpp#L18-L56)
is explicitly a union of formats across generations and warns that not every
format is legal on every architecture.

### BFP8 numerical behavior

The TTNN tensor documentation states that **16 consecutive BFP8_B values share
one exponent**, selected from the largest magnitude in the group. Extreme values
can consume the shared range and cause smaller values to lose precision or round
to zero. See [`tensor.rst:149–167`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/docs/source/ttnn/ttnn/tensor.rst#L149-L167).

Consequences:

- BFP8/BFP4 are attractive when neighboring values have compatible dynamic
  range.
- A reciprocal or another range-expanding operation can be more sensitive than
  a matrix weight tile.
- Error analysis must use the tensor's real tiling/order; a scalar theoretical
  error bound is insufficient.

### Special warning for FP8_E4M3

The public enum marks `FP8_E4M3` as **Blackhole-only, row-major-only**, currently
used by specialized DeepSeek V3 prefill combine/dispatch operations. That source
comment is an example of why “the dtype exists” must not be rewritten as “every
operation supports it.”

## Why BFP works naturally in the Tensix data path

TT-Metal documents that the storage format in SRAM may differ from the compute
register format. Hardware unpackers and packers perform the conversion, letting
SRAM remain compact while compute uses the appropriate internal representation.
See [compute engines and dataflow within Tensix](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/docs/source/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.rst#L45-L63).

```mermaid
flowchart LR
    H[PyTorch checkpoint<br/>FP32/BF16] --> P[TTNN preprocessing<br/>tile + shard + dtype]
    P --> D[Device DRAM/L1<br/>BFP8_B or BFP4_B]
    D --> U[Unpacker<br/>storage → registers]
    U --> M[FPU/SFPU<br/>math fidelity + accumulation]
    M --> K[Packer<br/>registers → output format]
    K --> C[Circular buffer / L1 / DRAM]
```

This flow explains a core design choice: compressed block-float storage can
reduce memory movement without expressing the graph as affine INT8 arithmetic.

## What the TT-Transformers model already does

### Tensor groups and precision settings

The current model configuration defines these tensor groups:

```text
FF1_FF3, FF2, WQKV, WO, KV_CACHE, ACTIVATION
```

and these model-level precision settings:

```text
BFP4, BFP8, BF16
```

Source: [`model_config.py:67–80`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/models/tt_transformers/tt/model_config.py#L67-L80).

The default policy is BFP8 for FF1/FF3, FF2, WQKV, WO and KV cache, while the
activation follows its original dtype. Operator fidelity is independently
selected; prefill SDPA uses a different default fidelity from decode. Source:
[`model_config.py:288–318`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/models/tt_transformers/tt/model_config.py#L288-L318).

### Accuracy versus performance policy

For Llama-family models, the accuracy policy already uses BFP8 for attention
weights and KV cache with wider MLP accumulation. The generic performance policy
changes FF1/FF3 tensor precision to BFP4 and its linear fidelity to LoFi. There
are model-specific exceptions; for example Qwen2.5-7B uses a wider policy because
the standard high-performance settings degrade it.

Source: [`ModelOptimizations.accuracy/performance`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/models/tt_transformers/tt/model_config.py#L128-L237).

This is the pattern to copy:

```mermaid
flowchart TD
    B[BF16 / accuracy baseline] --> A[BFP8 attention weights + KV cache]
    A --> Q{Quality gate passes?}
    Q -->|no| R[Restore first failing role]
    Q -->|yes| F[BFP4 FF1/FF3 in one layer]
    F --> G{Layer + model gate passes?}
    G -->|no| R
    G -->|yes| E[Expand layer-by-layer]
    E --> P[Warm profile + end-to-end acceptance]
```

### Per-decoder control surface

`DecodersPrecision` stores a configuration for each decoder and maps BFP4/BFP8/
BF16 to the actual TTNN datatypes. When the prefetcher is enabled, it forces a
consistent weight dtype across layers to avoid races caused by different block
sizes. Source:
[`model_config.py:4520–4598`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/models/tt_transformers/tt/model_config.py#L4520-L4598).

That prefetcher rule is a useful warning: dtype is not only a numerical choice;
it changes storage geometry and therefore runtime contracts.

## Repeatable application procedure

### Step 0 — freeze the contract

Record:

| Field | Example—not a substitute for the real value |
|---|---|
| model/checkpoint | Llama 3.1 8B |
| TT-Metal revision | `50a82f8…` |
| device | exact Blackhole SKU and mesh |
| prefill workload | prompt length percentiles and batch |
| decode workload | active users and context percentiles |
| primary performance metric | TTFT, prompt t/s, ms/token or aggregate t/s |
| quality gate | layer PCC + logits/tokens + perplexity/task metric |
| repetitions/warm-up | explicit numbers |

### Step 1 — run both source presets

```bash
cd ~/src/tt-metal

pytest models/tt_transformers/demo/simple_text_demo.py \
  -k "accuracy and batch-1"

pytest models/tt_transformers/demo/simple_text_demo.py \
  -k "performance and batch-1"
```

The demo's test parametrization maps these configurations to
`DecodersPrecision.accuracy` and `DecodersPrecision.performance`; see
[`simple_text_demo.py:824–838`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/models/tt_transformers/demo/simple_text_demo.py#L824-L838).

Use the actual test selector and device environment required by the local model.
The commands are starting points, not universal promises that every model asset
is present.

### Step 2 — isolate one layer and one tensor role

The real model control surface supports a per-decoder configuration:

```python
from models.tt_transformers.tt.model_config import (
    DecodersPrecision,
    ModelOptimizations,
    TensorGroup,
    PrecisionSetting,
    OpGroup,
    MathFidelitySetting,
)

precision = DecodersPrecision.accuracy(n_layers, model_name)

mlp_bfp4 = ModelOptimizations(
    {
        "TensorPrecision": {
            TensorGroup.FF1_FF3: PrecisionSetting.BFP4,
        },
        "OpFidelity": {
            OpGroup.LI_FF1_FF3: MathFidelitySetting.LOFI,
        },
    }
)

# First experiment: only decoder 0.
precision.set_decoder_conf(0, mlp_bfp4)
```

Inject this precision object through the same harness/model-argument route used
by the demo. Do not modify a low-level kernel constant yet.

### Step 3 — validate at three scopes

```mermaid
flowchart LR
    L[Layer gate<br/>norm, attention, residual, MLP] --> G[Graph gate<br/>logits + tokens]
    G --> M[Model gate<br/>perplexity/task metric]
    M --> D{Within budget?}
    D -->|no| R[Restore first failing role]
    D -->|yes| P[Profile warm performance]
```

Recommended saved artifacts:

- input IDs, positions, attention mask/page table and cache state;
- output tensors at decoder boundaries;
- reference/TTNN logits;
- generated token sequence;
- quality metric and threshold;
- datatype and math-fidelity matrix per layer;
- profiler result and run metadata.

### Step 4 — profile prefill and decode separately

| Gate | Prefill | Decode |
|---|---|---|
| primary performance | warm TTFT and prompt tokens/s | warm ms/token and user/aggregate tokens/s |
| numerical stress | prompt buckets and causal SDPA | long-context KV-cache evolution |
| traffic | weights, intermediate activations, collectives | weights, KV cache, page table and dispatch |
| failure mode | L1 pressure, tiling, compute fidelity | memory/dispatch dominated, accumulated token drift |

Smaller weights help only if the final profile shows less traffic or a faster hot
operation without compensating conversion/layout cost.

### Step 5 — accept or roll back

```mermaid
flowchart TD
    R[Candidate run] --> Q{All quality gates pass?}
    Q -->|no| B[Rollback first failing tensor role]
    Q -->|yes| W{Repeated warm end-to-end metric improves?}
    W -->|no| X[Reject: storage saving did not reach service metric]
    W -->|yes| C{Profile explains improvement?}
    C -->|no| I[Investigate noise / hidden variable]
    C -->|yes| A[Accept + add regression + record dtype matrix]
```

## Affine integer quantization utilities

The elementwise operations are useful, but their contracts must be stated
precisely.

### Quantize

[`quantization.cpp:179–204`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L179-L204)
requires floating input and currently permits output `INT32` or `UINT8`.
Per-channel `UINT8` output is rejected.

### Requantize

[`quantization.cpp:317–341`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L317-L341)
accepts `INT32` or `UINT8` input/output and also rejects per-channel `UINT8`
output.

### Dequantize

[`quantization.cpp:468–485`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L468-L485)
accepts `INT32` or `UINT8` and produces BF16 or FP32.

### Small utility example

```python
# Elementwise utility—not a quantized matmul replacement.
q = ttnn.quantize(
    x_bf16,
    scale,
    zero_point,
    dtype=ttnn.uint8,  # per-tensor UINT8 path
)

x_hat = ttnn.dequantize(
    q,
    scale,
    zero_point,
    dtype=ttnn.bfloat16,
)
```

The nightly unit tests compare TTNN results against PyTorch quantized tensors;
see [`test_quantization.py:18–44`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/ttnn/nightly/unit_tests/operations/eltwise/test_quantization.py#L18-L44).

## Where INT8 exists below the generic LLM API

Blackhole LLK includes:

- a predicate that enables integer math for `Int8` or `Int32` formats in
  [`ckernel_defs.h:279–284`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/tt-llk/tt_llk_blackhole/common/inc/ckernel_defs.h#L279-L284);
- math initialization that derives and writes the INT8-math enable bit in
  [`llk_math_common.h:33–56`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/tt-llk/tt_llk_blackhole/llk_lib/llk_math_common.h#L33-L56);
- Blackhole SFPU quant/requant conversion code in
  [`ckernel_sfpu_quant.h`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tt_metal/hw/ckernels/blackhole/metal/llk_api/llk_sfpu/ckernel_sfpu_quant.h#L80-L220).

This proves real low-level integer support. A custom INT8 linear path would still
need to prove:

1. legal input/output formats and layouts on the chosen Blackhole path;
2. scale and zero-point ownership;
3. accumulator width, overflow and saturation/rounding behavior;
4. packer/unpacker reconfiguration rules;
5. reader/compute/writer circular-buffer formats;
6. matrix-shape and program-factory coverage;
7. model-level quality;
8. end-to-end benefit after quantize/dequantize/layout overhead.

```mermaid
flowchart TD
    H[LLK INT8 capability] --> O[Custom operation contract]
    O --> F[Program factory<br/>CB formats + kernels]
    F --> N[Numerical oracle<br/>rounding + overflow]
    N --> S[Shape/layout test matrix]
    S --> M[Model integration]
    M --> P[Warm end-to-end profile]
```

Until that chain exists, “INT8 hardware is present” must not be shortened to
“the LLM runs with INT8 linear.”

## MX formats

The low-level `DataFormat` union includes MXFP4, MXFP6, MXFP8 and MXINT8/4/2.
`Tile::get_tile_size` describes a layout with one E8M0 scale byte per 32-element
block followed by packed elements. TT-Metal also contains LLK/typecast tests such
as [`test_mxfp4_typecast.cpp`](https://github.com/tenstorrent/tt-metal/blob/50a82f835593512c4176546b4af68d7e91315a86/tests/tt_metal/tt_metal/llk/test_mxfp4_typecast.cpp#L31-L192).

However:

- MX formats are not values in the public `tt::tt_metal::DataType` enum at this
  revision.
- `ttnn.linear` does not list MX inputs.
- the low-level enum explicitly spans multiple architectures;
- the cited MXFP4 test uses experimental Metal2/DFB mechanisms and calls out the
  Quasar conversion path.

Therefore the source supports **MX-format experimentation**, not a claim that a
Blackhole LLM can be switched to MXFP4 through a normal TTNN dtype argument.

## Logic review

| Tempting claim | Code-review problem | Correct replacement |
|---|---|---|
| “INT8 is in `DataType`, so every op supports it.” | datatype existence is not per-operation legality | check the binding/validator/program factory for the exact op |
| “BFP4 means INT4.” | shared-exponent block float and affine integer quantization differ | name BFP4_B and its exponent behavior explicitly |
| “BFP4 is 4× faster than BF16.” | 71.875% smaller tile storage is not an execution measurement | report only repeated warm end-to-end speedup |
| “Use performance precision on every model.” | source contains model-specific wider exceptions | run accuracy/performance presets and preserve the quality gate |
| “Quantize the whole model at once.” | hides the first sensitive tensor role | sweep one role/layer, then expand |
| “Output PCC proves model quality.” | long-context/token error can accumulate | layer, logits/tokens and perplexity/task gates |
| “MXFP4 appears in `DataFormat`, so Blackhole supports it.” | the enum is a cross-generation union | require architecture and operation legality |
| “INT8 LLK support means generic INT8 LLM matmul exists.” | program factory, scaling, shapes and API are missing from the proof | call it low-level capability until the full chain is validated |

## Code review conclusions

1. The public tensor enum exposes INT8, but comments give `FP8_E4M3` an explicit
   narrow Blackhole contract.
2. Host `to_dtype` accepts INT8, while the documentation explicitly says device
   typecast/tilize are not yet supported for that conversion.
3. The generic `ttnn.linear` documentation excludes integer and MX formats.
4. The elementwise quantization implementation currently uses INT32/UINT8
   storage contracts rather than an INT8 output tensor.
5. TT-Transformers already provides a role-based BFP8/BFP4/BF16 policy and
   per-decoder override point.
6. BFP tile sizes include exponent overhead, so BF8/BF4 are not exactly 2×/4×
   smaller than BF16.
7. Packer/unpacker conversion is a hardware mechanism, but math fidelity and
   accumulation remain separate quality controls.
8. Low-level Blackhole INT8 machinery is genuine but is insufficient by itself
   to claim a supported end-to-end quantized LLM.

## Presentation-ready conclusion

> On the current TTNN/TT-Metal LLM path, I would not begin with INT8. I would
> establish a BF16 quality baseline, use the source's BFP8 mixed-precision policy,
> then test BFP4 on FF1/FF3 one layer at a time. For each accepted change I would
> save the dtype/fidelity matrix, layer and model quality results, and the warm
> profile showing that reduced storage actually improved the target service
> metric. INT8 and MX formats are promising lower-level capabilities, but their
> existence is not yet the same as a generic `ttnn.linear` contract in this
> pinned source.

## Definition of done

- [ ] model/device/workload/quality contract frozen;
- [ ] accuracy and performance baselines saved;
- [ ] precision matrix recorded per tensor role and layer;
- [ ] BFP8 tested before BFP4;
- [ ] first failing role restored rather than abandoning all compression;
- [ ] prefill and decode validated separately;
- [ ] warm end-to-end performance repeated;
- [ ] profiler evidence explains the change;
- [ ] integer/MX claims limited to the layer the code actually proves;
- [ ] regression test preserves both quality and configuration.
