import { useMemo, useState } from "react";

type FormatKey = "bf16" | "bfp8" | "bfp4" | "uint8" | "int8" | "fp8" | "mxfp4";

type FormatCard = {
  key: FormatKey;
  name: string;
  storage: string;
  tileBytes: string;
  role: string;
  verdict: string;
  support: "LLM PATH" | "UTILITY" | "NARROW" | "LOW LEVEL";
  source: { label: string; href: string };
};

const revision = "50a82f835593512c4176546b4af68d7e91315a86";
const sourceRoot = `https://github.com/tenstorrent/tt-metal/blob/${revision}`;

const formats: readonly FormatCard[] = [
  { key:"bf16", name:"BFLOAT16", storage:"16 bits / value", tileBytes:"2,048 B / 32×32 tile", role:"Correctness baseline; norms, residual paths and sensitive outputs.", verdict:"Start here, then narrow one tensor role at a time.", support:"LLM PATH", source:{ label:"TTNN DataType enum", href:`${sourceRoot}/tt_metal/api/tt-metalium/tensor/tensor_types.hpp#L26-L40` } },
  { key:"bfp8", name:"BFLOAT8_B", storage:"8-bit value + shared exponent", tileBytes:"1,088 B / tile", role:"Common TT-Transformers weights, attention projections and KV cache.", verdict:"The practical first compression step for the current TTNN LLM path.", support:"LLM PATH", source:{ label:"BFP8 limitation", href:`${sourceRoot}/docs/source/ttnn/ttnn/tensor.rst#L149-L167` } },
  { key:"bfp4", name:"BFLOAT4_B", storage:"4-bit value + shared exponent", tileBytes:"576 B / tile", role:"Selected insensitive weights—especially FF1/FF3 in performance presets.", verdict:"Use after BFP8 passes; restore only the first failing role.", support:"LLM PATH", source:{ label:"Performance precision policy", href:`${sourceRoot}/models/tt_transformers/tt/model_config.py#L198-L237` } },
  { key:"uint8", name:"UINT8", storage:"8 bits / value", tileBytes:"1,024 B / tile", role:"Elementwise quantize/dequantize utility and integer tensor workflows.", verdict:"Supported by quantization utilities, but not listed by generic ttnn.linear.", support:"UTILITY", source:{ label:"Quantize validation", href:`${sourceRoot}/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L179-L204` } },
  { key:"int8", name:"INT8", storage:"8 bits / value", tileBytes:"1,024 B / tile", role:"Tensor/LLK integer capability and custom low-level paths.", verdict:"Do not present it as a drop-in LLM linear dtype at this revision.", support:"NARROW", source:{ label:"Host conversion limitation", href:`${sourceRoot}/ttnn/cpp/ttnn-nanobind/operations/core.cpp#L239-L269` } },
  { key:"fp8", name:"FP8_E4M3", storage:"8 bits / value", tileBytes:"1,024 B / tile", role:"Blackhole-only, row-major, specialized DeepSeek V3 prefill combine/dispatch use.", verdict:"A narrow operation contract, not a general model-wide switch.", support:"NARROW", source:{ label:"DataType warning", href:`${sourceRoot}/tt_metal/api/tt-metalium/tensor/tensor_types.hpp#L26-L40` } },
  { key:"mxfp4", name:"MXFP4", storage:"4-bit value + E8M0 scale / 32", tileBytes:"544 B in cited test path", role:"Low-level DataFormat, packing and typecast experiments.", verdict:"Not exposed as a generic TTNN DataType/linear route; check architecture legality.", support:"LOW LEVEL", source:{ label:"MX tile layout", href:`${sourceRoot}/tt_metal/impl/data_format/tile.cpp#L70-L100` } },
] as const;

const decisionSteps = [
  ["01", "FREEZE", "Model, checkpoint, Blackhole mesh, prompt/batch/context distribution and quality budget"],
  ["02", "BASELINE", "Run BF16/accuracy configuration; save logits, tokens, perplexity/task score and warm performance"],
  ["03", "BFP8", "Narrow WQKV, WO, KV cache and weights using the model's source-supported preset"],
  ["04", "BFP4", "Test FF1/FF3 independently; retain BF8/BF16 for the first sensitive role"],
  ["05", "PROFILE", "Confirm less DRAM/L1 traffic or faster hot operations survives conversion and dispatch cost"],
  ["06", "ACCEPT", "Require both quality and warm end-to-end gates; record the exact dtype matrix per layer"],
] as const;

const accuracyCode = `# Existing TT-Transformers baseline selectors
pytest models/tt_transformers/demo/simple_text_demo.py \\
  -k "accuracy and batch-1"

pytest models/tt_transformers/demo/simple_text_demo.py \\
  -k "performance and batch-1"`;

const customCode = `from models.tt_transformers.tt.model_config import (
    DecodersPrecision, ModelOptimizations,
    TensorGroup, PrecisionSetting,
    OpGroup, MathFidelitySetting,
)

precision = DecodersPrecision.accuracy(n_layers, model_name)
mlp_bfp4 = ModelOptimizations({
    "TensorPrecision": {
        TensorGroup.FF1_FF3: PrecisionSetting.BFP4,
    },
    "OpFidelity": {
        OpGroup.LI_FF1_FF3: MathFidelitySetting.LOFI,
    },
})

# Sweep a single layer first; expand only after its quality gate passes.
precision.set_decoder_conf(0, mlp_bfp4)`;

const utilityCode = `# Elementwise quantization utility—not a quantized matmul replacement.
q = ttnn.quantize(
    x_bf16,
    scale,
    zero_point,
    dtype=ttnn.uint8,       # per-tensor UINT8 path
)
x_hat = ttnn.dequantize(
    q,
    scale,
    zero_point,
    dtype=ttnn.bfloat16,
)

# For per-channel signed-style experiments, the current API uses
# INT32 output/container; per-channel UINT8 output is rejected.`;

function QuantizationApp() {
  const [activeKey, setActiveKey] = useState<FormatKey>("bfp8");
  const [copied, setCopied] = useState<string | null>(null);
  const active = useMemo(() => formats.find((format) => format.key === activeKey) ?? formats[1], [activeKey]);

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div className="quant-page">
      <header className="quant-topbar">
        <a className="quant-brand" href="./index.html"><b>TT•SIM</b><span>precision lab</span></a>
        <nav aria-label="Page navigation"><a href="#formats">Formats</a><a href="#flow">Data path</a><a href="#apply">Apply</a><a href="#review">Review</a><a className="quant-back" href="./discussion.html">← Discussion</a></nav>
      </header>

      <main>
        <section className="quant-hero">
          <div className="quant-hero-index"><span>DISCUSSION / 05</span><strong>4</strong><small>BITS · SELECTIVELY</small></div>
          <div className="quant-hero-copy"><p>LLM × TTNN × TT-METAL × BLACKHOLE</p><h1>Compress the<br/><em>traffic,</em><br/>not the truth.</h1><div className="quant-equation"><span>MODEL QUALITY</span><i>∩</i><span>MEMORY TRAFFIC</span><i>∩</i><span>WARM LATENCY</span></div></div>
          <aside className="quant-verdict"><span>SOURCE-AUDITED VERDICT</span><h2>Start BF16.<br/>Move to BFP8.<br/>Use BFP4 by role.</h2><p>INT8 is real in the stack, but it is not a drop-in datatype for the pinned generic <code>ttnn.linear</code> path.</p><a href="./DISCUSSION_TT_METAL_QUANTIZATION.md">Copy-ready technical note ↗</a></aside>
        </section>

        <section className="quant-guardrail"><b>Three different meanings of “quantization”</b><div><span>BLOCK FLOAT</span><p>BFP8/BFP4 storage with shared exponents; the current LLM-friendly path.</p></div><div><span>AFFINE INTEGER</span><p>Scale + zero-point with quantize/dequantize utilities.</p></div><div><span>LOW-LEVEL FORMAT</span><p>INT8/MX/FP8 hardware or DataFormat capability that still needs an operation contract.</p></div></section>

        <section id="formats" className="format-section">
          <div className="quant-heading"><span>01 / FORMAT LEDGER</span><h2>An enum is not<br/>an operator promise.</h2><p>Select a format. The status tells you whether it is a current generic LLM path, a utility, a narrow specialization or a low-level experiment.</p></div>
          <div className="format-workbench">
            <div className="format-tabs" role="tablist" aria-label="Tenstorrent data formats">{formats.map((format) => <button key={format.key} type="button" role="tab" aria-selected={format.key === active.key} className={format.key === active.key ? "active" : ""} onClick={() => setActiveKey(format.key)}><b>{format.name}</b><small>{format.support}</small></button>)}</div>
            <article className="format-detail"><header><span>{active.support}</span><code>{active.tileBytes}</code></header><h3>{active.name}</h3><div className="format-metric"><span>STORAGE</span><b>{active.storage}</b></div><div className="format-copy"><span>ROLE</span><p>{active.role}</p></div><div className="format-copy"><span>DECISION</span><p>{active.verdict}</p></div><a href={active.source.href}>Open {active.source.label} ↗</a></article>
          </div>
          <div className="tile-ledger" role="table" aria-label="32 by 32 tile storage comparison"><div className="tile-row head" role="row"><b>FORMAT</b><b>TILE BYTES</b><b>LESS THAN BF16</b><b>INTERPRETATION</b></div><div className="tile-row" role="row"><code>BF16</code><b>2,048</b><span>baseline</span><p>1,024 × 2-byte values</p></div><div className="tile-row" role="row"><code>BFP8_B</code><b>1,088</b><span>46.9%</span><p>1,024 value bytes + 64 exponent bytes</p></div><div className="tile-row" role="row"><code>BFP4_B</code><b>576</b><span>71.9%</span><p>512 value bytes + 64 exponent bytes</p></div><div className="tile-row muted" role="row"><code>MXFP4</code><b>544</b><span>73.4%</span><p>Low-level Quasar/DFB test path; not a generic TTNN dtype</p></div></div>
          <p className="tile-warning"><b>Storage math is not a speedup claim.</b> Alignment, conversions, compute fidelity, program choice, KV traffic and dispatch can dominate the end-to-end result.</p>
        </section>

        <section id="flow" className="dataflow-section-quant">
          <div className="quant-heading light"><span>02 / DEVICE DATA PATH</span><h2>Compact in memory.<br/>Expanded for compute.</h2><p>The unpacker and packer bridge storage formats and compute-register formats. This is why BFP can reduce traffic without turning the model into a generic INT8 graph.</p></div>
          <div className="quant-flow" aria-label="Quantized tensor path through TTNN and Tensix"><article><small>HOST / TORCH</small><b>FP32 or BF16 checkpoint</b><p>Reference weights + calibration samples</p></article><i>→</i><article><small>TTNN PREPROCESS</small><b><code>as_tensor(dtype=…)</code></b><p>Tile, shard and cache packed weights</p></article><i>→</i><article><small>DRAM / L1</small><b>BFP8_B or BFP4_B tiles</b><p>Compact values + exponent blocks</p></article><i>→</i><article><small>UNPACKER → FPU</small><b>Compute + accumulation policy</b><p>HiFi/LoFi and destination width matter</p></article><i>→</i><article><small>PACKER / WRITER</small><b>Chosen output dtype</b><p>Return to CB, L1 or DRAM</p></article></div>
          <div className="flow-sources"><a href={`${sourceRoot}/docs/source/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.rst#L45-L63`}>Unpacker/packer mechanism ↗</a><a href={`${sourceRoot}/tt_metal/api/tt-metalium/constants.hpp#L13-L21`}>BFP tile storage ↗</a><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/matmul/matmul_nanobind.cpp#L824-L898`}>Linear dtype contract ↗</a></div>
          <div className="model-role-map"><article><span>KEEP WIDE FIRST</span><h3>Norm · residual · sensitive accumulations</h3><b>BF16 / source compute config</b></article><article><span>FIRST COMPRESSION</span><h3>WQKV · WO · KV cache · most weights</h3><b>BFP8_B</b></article><article><span>SELECTIVE 4-BIT</span><h3>FF1 / FF3 after layer gate</h3><b>BFP4_B + measured fidelity</b></article></div>
        </section>

        <section id="apply" className="apply-section-quant">
          <div className="quant-heading"><span>03 / APPLY TO AN LLM</span><h2>One role.<br/>One gate. One run.</h2><p>The source already provides accuracy/performance precision policies. Begin with them; use a custom per-layer configuration only for an isolated sweep.</p></div>
          <div className="decision-chain-quant">{decisionSteps.map(([id,label,detail], index) => <div className="decision-node-quant" key={id}><article><span>{id} / {label}</span><p>{detail}</p></article>{index < decisionSteps.length - 1 && <i>↓</i>}</div>)}</div>
          <div className="code-grid-quant">
            <article><header><span>A · BASELINE</span><button type="button" onClick={() => copy(accuracyCode,"BASELINE")}>{copied === "BASELINE" ? "COPIED" : "COPY"}</button></header><pre>{accuracyCode}</pre><p>The demo parametrization maps these selectors to <code>DecodersPrecision.accuracy/performance</code>.</p></article>
            <article><header><span>B · ONE-LAYER SWEEP</span><button type="button" onClick={() => copy(customCode,"CUSTOM")}>{copied === "CUSTOM" ? "COPIED" : "COPY"}</button></header><pre>{customCode}</pre><p>This uses the real per-decoder control surface. Expand beyond layer 0 only after its quality gate passes.</p></article>
          </div>
          <div className="acceptance-matrix"><div className="acceptance-row head"><b>GATE</b><b>PREFILL</b><b>DECODE</b><b>REJECT WHEN</b></div><div className="acceptance-row"><span>QUALITY</span><p>Layer outputs, logits, perplexity/task score</p><p>Long-context token/logit agreement</p><p>Any agreed threshold fails</p></div><div className="acceptance-row"><span>PERFORMANCE</span><p>Warm TTFT + prompt tokens/s</p><p>Warm ms/token + user/aggregate t/s</p><p>Conversion cost erases the gain</p></div><div className="acceptance-row"><span>RESOURCE</span><p>Peak L1 + DRAM/NoC traffic</p><p>KV-cache bytes + dispatch gaps</p><p>New spill, recompile or instability appears</p></div></div>
        </section>

        <section className="integer-section-quant">
          <div className="quant-heading light"><span>04 / INTEGER PATH</span><h2>Useful utility.<br/>Different promise.</h2><p><code>ttnn.quantize</code>, <code>requantize</code> and <code>dequantize</code> are real device operations, but their current contracts do not turn <code>ttnn.linear</code> into a generic INT8 LLM kernel.</p></div>
          <div className="integer-grid"><article><header><span>A · AFFINE UTILITY</span><button type="button" onClick={() => copy(utilityCode,"UTILITY")}>{copied === "UTILITY" ? "COPIED" : "COPY"}</button></header><pre>{utilityCode}</pre></article><aside><div><b>QUANTIZE</b><p>Floating input → INT32 or per-tensor UINT8 output.</p></div><div><b>REQUANTIZE</b><p>INT32/UINT8 input and output; per-channel UINT8 output is rejected.</p></div><div><b>DEQUANTIZE</b><p>INT32/UINT8 input → BF16 or FP32 output.</p></div><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L179-L204`}>Quantize checks ↗</a><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L317-L341`}>Requantize checks ↗</a><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L468-L485`}>Dequantize checks ↗</a></aside></div>
          <div className="int8-boundary"><span>WHAT EXISTS BELOW TTNN LINEAR</span><p>Blackhole LLK contains integer format handling and an INT8-math enable path. That proves hardware/LLK capability—not that arbitrary TTNN matmul shapes, layouts, scaling and accuracy are already productized.</p><a href={`${sourceRoot}/tt_metal/tt-llk/tt_llk_blackhole/common/inc/ckernel_defs.h#L279-L284`}>INT8 math predicate ↗</a><a href={`${sourceRoot}/tt_metal/tt-llk/tt_llk_blackhole/llk_lib/llk_math_common.h#L33-L56`}>Math configuration ↗</a></div>
        </section>

        <section id="review" className="logic-section-quant">
          <div className="quant-heading"><span>05 / LOGIC REVIEW</span><h2>Claims that survive<br/>code review.</h2><p>Each tempting shortcut below was checked against the pinned TT-Metal and model source.</p></div>
          <div className="logic-table"><div className="logic-row head"><b>TEMPTING CLAIM</b><b>WHY IT FAILS</b><b>REPLACEMENT</b></div><div className="logic-row"><p>“INT8 is in DataType, so LLM matmul supports it.”</p><p>Datatype existence and per-operation legality are different.</p><p>Use the linear binding contract; choose BFP8/BFP4 today.</p></div><div className="logic-row"><p>“BFP4 is four times faster than BF16.”</p><p>Tile storage falls 71.9%, but execution includes alignment, conversion and compute.</p><p>Report measured warm end-to-end speedup only.</p></div><div className="logic-row"><p>“Quantize the entire model once.”</p><p>Tensor roles and layers have different error sensitivity.</p><p>Sweep one role/layer and roll back the first failure.</p></div><div className="logic-row"><p>“MXFP4 is listed, so use it on Blackhole.”</p><p><code>DataFormat</code> is a union across generations; legality is checked per architecture.</p><p>Treat MX as low-level research until the target operation says supported.</p></div><div className="logic-row"><p>“Output PCC is enough.”</p><p>Error may accumulate across layers or long decode contexts.</p><p>Gate layer tensors, logits/tokens and perplexity/task quality.</p></div></div>
          <div className="quant-source-map"><div><span>MODEL POLICY</span><a href={`${sourceRoot}/models/tt_transformers/tt/model_config.py#L67-L80`}>Tensor/precision groups ↗</a><a href={`${sourceRoot}/models/tt_transformers/tt/model_config.py#L128-L237`}>Accuracy/performance ↗</a><a href={`${sourceRoot}/models/tt_transformers/tt/model_config.py#L4520-L4598`}>Per-decoder mapping ↗</a></div><div><span>DATA CONTRACT</span><a href={`${sourceRoot}/tt_metal/api/tt-metalium/tensor/tensor_types.hpp#L26-L40`}>DataType ↗</a><a href={`${sourceRoot}/tt_metal/api/tt-metalium/tt_backend_api_types.hpp#L18-L56`}>Low-level DataFormat ↗</a><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/matmul/matmul_nanobind.cpp#L824-L898`}>Linear ↗</a></div><div><span>PINNED REVISION</span><code>{revision}</code><p>Verified against <code>/home/n/src/tt-metal</code> in WSL Ubuntu.</p></div></div>
        </section>
      </main>

      <footer className="quant-footer"><div><b>TT•SIM · DISCUSSION SUBPAGE 05</b><p>Source-backed mixed precision and quantization for TTNN/TT-Metal LLMs.</p></div><a href="./discussion-presentation.html">30-minute deck →</a><a href="./discussion-transformer-blackhole-optimization.html">Optimization chain →</a><a href="./discussion.html">Discussion →</a><a href="./index.html">Book →</a></footer>
    </div>
  );
}

export default QuantizationApp;
