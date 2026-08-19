import { useMemo, useState } from "react";

type FormatKey = "bf16" | "bfp8" | "bfp4" | "uint8" | "int8" | "fp8" | "mxfp4";
type CalibrationKey = "ptq-qat" | "why" | "mapping" | "threshold" | "granularity" | "tenstorrent";
type ReferenceLink = { label: string; href: string };

type FormatCard = {
  key: FormatKey;
  name: string;
  storage: string;
  tileBytes: string;
  role: string;
  verdict: string;
  support: "LLM PATH" | "UTILITY" | "NARROW" | "LOW LEVEL";
  sources: readonly ReferenceLink[];
};

const revision = "50a82f835593512c4176546b4af68d7e91315a86";
const sourceRoot = `https://github.com/tenstorrent/tt-metal/blob/${revision}`;
const ttMlirRevision = "71046369d603b97fd6a8dd8b947ca8588ac2a74f";
const ttMlirSourceRoot = `https://github.com/tenstorrent/tt-mlir/blob/${ttMlirRevision}`;
const officialDocs = {
  tensor: "https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/tensor.html",
  linear: "https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/api/ttnn.linear.html",
  toDtype: "https://docs.tenstorrent.com/tt-metal/latest/ttnn/ttnn/api/ttnn.to_dtype.html",
  computeDataflow: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.html",
  tools: "https://docs.tenstorrent.com/tt-metal/latest/tt-metalium/tools/index.html",
} as const;

const quantizationReferences = {
  pytorchPractice: "https://pytorch.org/blog/quantization-in-practice/",
  pytorchQat: "https://pytorch.org/blog/quantization-aware-training/",
  tensorrtCalibration: "https://docs.nvidia.com/deeplearning/tensorrt/10.x.x/inference-library/work-quantized-types.html#post-training-quantization-using-calibration",
} as const;

const formats: readonly FormatCard[] = [
  { key:"bf16", name:"BFLOAT16", storage:"16 bits / value", tileBytes:"2,048 B / 32×32 tile", role:"Correctness baseline; norms, residual paths and sensitive outputs.", verdict:"Start here, then narrow one tensor role at a time.", support:"LLM PATH", sources:[{ label:"TTNN DataType enum", href:`${sourceRoot}/tt_metal/api/tt-metalium/tensor/tensor_types.hpp#L26-L40` },{ label:"Official linear dtype table", href:officialDocs.linear }] },
  { key:"bfp8", name:"BFLOAT8_B", storage:"8-bit value + shared exponent", tileBytes:"1,088 B / tile", role:"Common TT-Transformers weights, attention projections and KV cache.", verdict:"The practical first compression step for the current TTNN LLM path.", support:"LLM PATH", sources:[{ label:"Pinned BFP8 behavior", href:`${sourceRoot}/docs/source/ttnn/ttnn/tensor.rst#L149-L167` },{ label:"Official tensor/BFP8 note", href:officialDocs.tensor },{ label:"Tile storage constants", href:`${sourceRoot}/tt_metal/api/tt-metalium/constants.hpp#L13-L21` }] },
  { key:"bfp4", name:"BFLOAT4_B", storage:"4-bit value + shared exponent", tileBytes:"576 B / tile", role:"Selected insensitive weights—especially FF1/FF3 in performance presets.", verdict:"Use after BFP8 passes; restore only the first failing role.", support:"LLM PATH", sources:[{ label:"Performance precision policy", href:`${sourceRoot}/models/tt_transformers/tt/model_config.py#L198-L237` },{ label:"Tile storage constants", href:`${sourceRoot}/tt_metal/api/tt-metalium/constants.hpp#L13-L21` },{ label:"Official linear dtype table", href:officialDocs.linear }] },
  { key:"uint8", name:"UINT8", storage:"8 bits / value", tileBytes:"1,024 B / tile", role:"Elementwise quantize/dequantize utility and integer tensor workflows.", verdict:"Supported by quantization utilities, but not listed by generic ttnn.linear.", support:"UTILITY", sources:[{ label:"Quantize validation", href:`${sourceRoot}/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L179-L204` },{ label:"Official host to_dtype contract", href:officialDocs.toDtype },{ label:"Official linear dtype table", href:officialDocs.linear }] },
  { key:"int8", name:"INT8", storage:"8 bits / value", tileBytes:"1,024 B / tile", role:"Tensor/LLK integer capability and custom low-level paths.", verdict:"Do not present it as a drop-in LLM linear dtype at this revision.", support:"NARROW", sources:[{ label:"Host conversion limitation", href:`${sourceRoot}/ttnn/cpp/ttnn-nanobind/operations/core.cpp#L239-L269` },{ label:"Blackhole INT8 predicate", href:`${sourceRoot}/tt_metal/tt-llk/tt_llk_blackhole/common/inc/ckernel_defs.h#L279-L284` },{ label:"Official linear exclusion", href:officialDocs.linear }] },
  { key:"fp8", name:"FP8_E4M3", storage:"8 bits / value", tileBytes:"1,024 B / tile", role:"Blackhole-only, row-major, specialized DeepSeek V3 prefill combine/dispatch use.", verdict:"A narrow operation contract, not a general model-wide switch.", support:"NARROW", sources:[{ label:"DataType specialization warning", href:`${sourceRoot}/tt_metal/api/tt-metalium/tensor/tensor_types.hpp#L26-L40` },{ label:"Low-level DataFormat union", href:`${sourceRoot}/tt_metal/api/tt-metalium/tt_backend_api_types.hpp#L18-L56` }] },
  { key:"mxfp4", name:"MXFP4", storage:"4-bit value + E8M0 scale / 32", tileBytes:"544 B in cited test path", role:"Low-level DataFormat, packing and typecast experiments.", verdict:"Not exposed as a generic TTNN DataType/linear route; check architecture legality.", support:"LOW LEVEL", sources:[{ label:"MX tile layout", href:`${sourceRoot}/tt_metal/impl/data_format/tile.cpp#L70-L100` },{ label:"Quasar/DFB MXFP4 test", href:`${sourceRoot}/tests/tt_metal/tt_metal/llk/test_mxfp4_typecast.cpp#L31-L192` },{ label:"Official linear dtype table", href:officialDocs.linear }] },
] as const;

const decisionSteps = [
  ["01", "FREEZE", "Model, checkpoint, Blackhole mesh, prompt/batch/context distribution and quality budget", { label:"Experiment contract", href:"./DISCUSSION_TT_METAL_QUANTIZATION.md#step-0--freeze-the-contract" }],
  ["02", "BASELINE", "Run BF16/accuracy configuration; save logits, tokens, perplexity/task score and warm performance", { label:"Demo selectors", href:`${sourceRoot}/models/tt_transformers/demo/simple_text_demo.py#L824-L838` }],
  ["03", "BFP8", "Narrow WQKV, WO, KV cache and weights using the model's source-supported preset", { label:"Default mixed precision", href:`${sourceRoot}/models/tt_transformers/tt/model_config.py#L288-L318` }],
  ["04", "BFP4", "Test FF1/FF3 independently; retain BF8/BF16 for the first sensitive role", { label:"Performance policy", href:`${sourceRoot}/models/tt_transformers/tt/model_config.py#L198-L237` }],
  ["05", "PROFILE", "Confirm less DRAM/L1 traffic or faster hot operations survives conversion and dispatch cost", { label:"Device profiler reference", href:officialDocs.tools }],
  ["06", "ACCEPT", "Require both quality and warm end-to-end gates; record the exact dtype matrix per layer", { label:"Per-decoder mapping", href:`${sourceRoot}/models/tt_transformers/tt/model_config.py#L4520-L4598` }],
] as const;

const logicRows = [
  ["“INT8 is in DataType, so LLM matmul supports it.”", "Datatype existence and per-operation legality are different.", "Use the linear binding contract; choose BFP8/BFP4 today.", { label:"Official linear dtype table", href:officialDocs.linear }],
  ["“BFP4 is four times faster than BF16.”", "Tile storage falls 71.9%, but execution includes alignment, conversion and compute.", "Report measured warm end-to-end speedup only.", { label:"BFP tile constants", href:`${sourceRoot}/tt_metal/api/tt-metalium/constants.hpp#L13-L21` }],
  ["“Quantize the entire model once.”", "Tensor roles and layers have different error sensitivity.", "Sweep one role/layer and roll back the first failure.", { label:"Per-role model policy", href:`${sourceRoot}/models/tt_transformers/tt/model_config.py#L128-L237` }],
  ["“MXFP4 is listed, so use it on Blackhole.”", "DataFormat is a union across generations; legality is checked per architecture.", "Treat MX as low-level research until the target operation says supported.", { label:"DataFormat legality warning", href:`${sourceRoot}/tt_metal/api/tt-metalium/tt_backend_api_types.hpp#L18-L56` }],
  ["“Calibration makes the model INT8-ready.”", "Calibration selects clipping thresholds and qparams; it does not implement an INT8 operator.", "Freeze the numerical contract, then separately prove operation and kernel legality.", { label:"Pinned linear contract", href:`${sourceRoot}/ttnn/cpp/ttnn/operations/matmul/matmul_nanobind.cpp#L824-L898` }],
  ["“TT-MLIR has Q/DQ conversion, so INT8 linear is ready.”", "IR conversion, operation validation and the target kernel are separate gates.", "Inspect emitted IR and prove the exact release-pinned operator on Blackhole.", { label:"Pinned TT-MLIR Q/DQ conversion", href:`${ttMlirSourceRoot}/lib/Conversion/StableHLOToTTIR/StableHLOToTTIRPatterns.cpp#L1307-L1385` }],
  ["“Output PCC is enough.”", "Error may accumulate across layers or long decode contexts.", "Gate layer tensors, logits/tokens and perplexity/task quality.", { label:"Acceptance methodology", href:"./DISCUSSION_TT_METAL_QUANTIZATION.md#step-3--validate-at-three-scopes" }],
] as const;

const calibrationQuestions: readonly {
  key: CalibrationKey;
  label: string;
  question: string;
  answer: string;
  points: readonly string[];
  sources: readonly ReferenceLink[];
}[] = [
  {
    key: "ptq-qat",
    label: "PTQ / QAT",
    question: "What are PTQ and QAT?",
    answer: "PTQ converts a trained floating-point model after training. QAT inserts fake quantization into the forward pass and fine-tunes the model so its weights adapt to clipping and rounding noise before conversion.",
    points: [
      "PTQ is the faster, cheaper starting point: collect statistics, choose quantization parameters, convert, then validate.",
      "QAT keeps trainable weights in floating point while the forward pass simulates quantize/dequantize; gradients normally use a straight-through estimator.",
      "QAT costs training data and compute, but can recover quality when low-bit PTQ misses the target.",
    ],
    sources: [
      { label: "PyTorch PTQ workflow", href: quantizationReferences.pytorchPractice },
      { label: "PyTorch QAT mechanism", href: quantizationReferences.pytorchQat },
    ],
  },
  {
    key: "why",
    label: "WHY CALIBRATE",
    question: "Why is calibration needed, and what does it do?",
    answer: "Static activation quantization needs representative data because activation ranges depend on real inputs. Observers measure ranges or histograms, choose clipping thresholds, and turn those thresholds into scale and zero-point values.",
    points: [
      "Calibration does not train the weights, guarantee accuracy, or make an unsupported device kernel appear.",
      "Weight-only quantization can derive ranges from the stored weights; static activations usually need calibration samples.",
      "Dynamic activation quantization derives activation parameters at runtime, avoiding an offline activation-calibration pass at the cost of runtime work.",
    ],
    sources: [
      { label: "Observers and calibration", href: quantizationReferences.pytorchPractice },
      { label: "TensorRT calibration contract", href: quantizationReferences.tensorrtCalibration },
    ],
  },
  {
    key: "mapping",
    label: "SYM / ASYM",
    question: "Symmetric or asymmetric quantization?",
    answer: "Both are affine mappings. Symmetric quantization centers the signed integer range at zero; asymmetric quantization learns a non-zero zero-point and can use more codes for skewed, non-zero-centered data.",
    points: [
      "Symmetric: a = max(|xmin|, |xmax|), s = a / qmax_abs, z = 0. It simplifies zero-point handling but wastes range for skewed data.",
      "Asymmetric: s = (xmax − xmin)/(qmax − qmin), z = clamp(round(qmin − xmin/s)). It represents skewed activations better but adds zero-point handling.",
      "Rounding, saturation and narrow-range rules must match the deployed backend exactly; signed INT8 often uses an effective symmetric magnitude of 127.",
    ],
    sources: [{ label: "PyTorch affine and symmetric mappings", href: quantizationReferences.pytorchPractice }],
  },
  {
    key: "threshold",
    label: "RANGE METHOD",
    question: "Min-max, percentile, or KL calibration?",
    answer: "These methods select the clipping threshold; scale and zero-point are derived afterward. The best method is the one that passes the model-quality gate on representative data—not the one with the largest raw range.",
    points: [
      "Min-max keeps the observed extrema. It is fast and deterministic, but one outlier can make most integer codes too coarse.",
      "Percentile clips a chosen tail, such as the top 0.01%. It often handles rare outliers better, but the percentile is a validation-tuned hyperparameter.",
      "KL/entropy scans candidate clipping thresholds and minimizes divergence between the reference histogram and a quantized approximation. Results depend on histogram bins and the backend implementation.",
      "TensorRT's implicit quantization/calibration workflow is deprecated; use its calibrators here only as algorithm references and prefer an explicit Q/DQ deployment contract.",
    ],
    sources: [{ label: "TensorRT entropy and percentile calibrators", href: quantizationReferences.tensorrtCalibration }],
  },
  {
    key: "granularity",
    label: "GRANULARITY",
    question: "Per-tensor, per-channel, or per-group?",
    answer: "Granularity decides how many independent ranges are stored. More local scales usually reduce error, but require more metadata and explicit kernel support.",
    points: [
      "Per-tensor uses one scale/zero-point for the entire tensor: simplest, but sensitive to channel outliers.",
      "Per-channel is common for weights because each output channel gets its own range.",
      "Per-group is common in low-bit LLM weight paths; dynamic per-token activation scales are another option when the backend supports them.",
    ],
    sources: [{ label: "PyTorch quantization granularity", href: quantizationReferences.pytorchPractice }],
  },
  {
    key: "tenstorrent",
    label: "TT IMPLEMENT",
    question: "How should I implement this for a Tenstorrent LLM?",
    answer: "Freeze the target operator contract first. At the pinned TT-Metal revision, the audited generic ttnn.linear route lists BF16, BFP8_B, BFP4_B and FP32 tile inputs—not affine INT8. The practical model route is BF16 → BFP8 → selective BFP4; an affine INT8 experiment needs an operation whose exact contract is supported, or a custom operation and kernel path.",
    points: [
      "For affine INT8 PTQ: calibrate in the frontend, freeze qparams, then prove the TTNN operation, program factory, circular-buffer formats, LLK behavior and accumulators all implement the same mapping.",
      "For QAT: make fake quantization reproduce the exact clipping, rounding, granularity and scale ownership of the deployment kernel.",
      "Use ttnn.quantize/requantize/dequantize only where their checked contracts fit. They are elementwise utilities, not a quantized linear replacement.",
    ],
    sources: [
      { label: "Pinned ttnn.linear binding", href: `${sourceRoot}/ttnn/cpp/ttnn/operations/matmul/matmul_nanobind.cpp#L824-L898` },
      { label: "TTNN quantize checks", href: `${sourceRoot}/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L179-L204` },
      { label: "TT-Transformers precision policy", href: `${sourceRoot}/models/tt_transformers/tt/model_config.py#L128-L237` },
      { label: "Pinned TT-MLIR StableHLO Q/DQ conversion", href: `${ttMlirSourceRoot}/lib/Conversion/StableHLOToTTIR/StableHLOToTTIRPatterns.cpp#L1307-L1385` },
      { label: "Pinned TT-MLIR quantization options", href: `${ttMlirSourceRoot}/include/ttmlir/Dialect/TTNN/Pipelines/TTNNPipelines.h#L306-L430` },
    ],
  },
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
  const [activeCalibrationKey, setActiveCalibrationKey] = useState<CalibrationKey>("ptq-qat");
  const [copied, setCopied] = useState<string | null>(null);
  const active = useMemo(() => formats.find((format) => format.key === activeKey) ?? formats[1], [activeKey]);
  const activeCalibration = useMemo(() => calibrationQuestions.find((item) => item.key === activeCalibrationKey) ?? calibrationQuestions[0], [activeCalibrationKey]);

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div className="quant-page">
      <header className="quant-topbar">
        <a className="quant-brand" href="./index.html"><b>TT•SIM</b><span>precision lab</span></a>
        <nav aria-label="Page navigation"><a href="#formats">Formats</a><a href="#flow">Data path</a><a href="#apply">Apply</a><a href="#calibration">Calibration</a><a href="#review">Review</a><a className="quant-back" href="./discussion.html">← Discussion</a></nav>
      </header>

      <main>
        <section className="quant-hero">
          <div className="quant-hero-index"><span>DISCUSSION / 05</span><strong>4</strong><small>BITS · SELECTIVELY</small></div>
          <div className="quant-hero-copy"><p>LLM × TTNN × TT-METAL × BLACKHOLE</p><h1>Compress the<br/><em>traffic,</em><br/>not the truth.</h1><div className="quant-equation"><span>MODEL QUALITY</span><i>∩</i><span>MEMORY TRAFFIC</span><i>∩</i><span>WARM LATENCY</span></div></div>
          <aside className="quant-verdict"><span>SOURCE-AUDITED VERDICT</span><h2>Start BF16.<br/>Move to BFP8.<br/>Use BFP4 by role.</h2><p>INT8 is real in the stack, but it is not a drop-in datatype for the pinned generic <code>ttnn.linear</code> path.</p><div className="quant-verdict-links"><a href={officialDocs.linear}>Official linear dtype table ↗</a><a href="./DISCUSSION_TT_METAL_QUANTIZATION.md">Copy-ready technical note ↗</a></div></aside>
        </section>

        <section className="quant-guardrail"><b>Three different meanings of “quantization”</b><div><span>BLOCK FLOAT</span><p>BFP8/BFP4 storage with shared exponents; the current LLM-friendly path.</p><a href={officialDocs.tensor}>Official BFP behavior ↗</a></div><div><span>AFFINE INTEGER</span><p>Scale + zero-point with quantize/dequantize utilities.</p><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L179-L204`}>Quantize contract ↗</a></div><div><span>LOW-LEVEL FORMAT</span><p>INT8/MX/FP8 hardware or DataFormat capability that still needs an operation contract.</p><a href={`${sourceRoot}/tt_metal/api/tt-metalium/tt_backend_api_types.hpp#L18-L56`}>DataFormat union ↗</a></div></section>

        <section id="formats" className="format-section">
          <div className="quant-heading"><span>01 / FORMAT LEDGER</span><h2>An enum is not<br/>an operator promise.</h2><p>Select a format. The status tells you whether it is a current generic LLM path, a utility, a narrow specialization or a low-level experiment.</p></div>
          <div className="format-workbench">
            <div className="format-tabs" role="tablist" aria-label="Tenstorrent data formats">{formats.map((format) => <button key={format.key} type="button" role="tab" aria-selected={format.key === active.key} className={format.key === active.key ? "active" : ""} onClick={() => setActiveKey(format.key)}><b>{format.name}</b><small>{format.support}</small></button>)}</div>
            <article className="format-detail"><header><span>{active.support}</span><code>{active.tileBytes}</code></header><h3>{active.name}</h3><div className="format-metric"><span>STORAGE</span><b>{active.storage}</b></div><div className="format-copy"><span>ROLE</span><p>{active.role}</p></div><div className="format-copy"><span>DECISION</span><p>{active.verdict}</p></div><div className="format-references"><span>BACKUP / REFERENCES</span>{active.sources.map((source) => <a key={source.href} href={source.href}>{source.label} ↗</a>)}</div></article>
          </div>
          <div className="tile-ledger" role="table" aria-label="32 by 32 tile storage comparison"><div className="tile-row head" role="row"><b>FORMAT</b><b>TILE BYTES</b><b>LESS THAN BF16</b><b>INTERPRETATION</b></div><div className="tile-row" role="row"><code>BF16</code><b>2,048</b><span>baseline</span><p>1,024 × 2-byte values</p></div><div className="tile-row" role="row"><code>BFP8_B</code><b>1,088</b><span>46.9%</span><p>1,024 value bytes + 64 exponent bytes</p></div><div className="tile-row" role="row"><code>BFP4_B</code><b>576</b><span>71.9%</span><p>512 value bytes + 64 exponent bytes</p></div><div className="tile-row muted" role="row"><code>MXFP4</code><b>544</b><span>73.4%</span><p>Low-level Quasar/DFB test path; not a generic TTNN dtype</p></div></div>
          <div className="tile-references"><span>STORAGE REFERENCES</span><a href={`${sourceRoot}/tt_metal/api/tt-metalium/constants.hpp#L13-L21`}>BF16/BFP8/BFP4 constants ↗</a><a href={`${sourceRoot}/tt_metal/impl/data_format/tile.cpp#L70-L100`}>MX tile calculation ↗</a></div>
          <p className="tile-warning"><b>Storage math is not a speedup claim.</b> Alignment, conversions, compute fidelity, program choice, KV traffic and dispatch can dominate the end-to-end result.</p>
        </section>

        <section id="flow" className="dataflow-section-quant">
          <div className="quant-heading light"><span>02 / DEVICE DATA PATH</span><h2>Compact in memory.<br/>Expanded for compute.</h2><p>The unpacker and packer bridge storage formats and compute-register formats. This is why BFP can reduce traffic without turning the model into a generic INT8 graph.</p></div>
          <div className="quant-flow" aria-label="Quantized tensor path through TTNN and Tensix"><article><small>HOST / TORCH</small><b>FP32 or BF16 checkpoint</b><p>Reference weights + calibration samples</p></article><i>→</i><article><small>TTNN PREPROCESS</small><b><code>as_tensor(dtype=…)</code></b><p>Tile, shard and cache packed weights</p></article><i>→</i><article><small>DRAM / L1</small><b>BFP8_B or BFP4_B tiles</b><p>Compact values + exponent blocks</p></article><i>→</i><article><small>UNPACKER → FPU</small><b>Compute + accumulation policy</b><p>HiFi/LoFi and destination width matter</p></article><i>→</i><article><small>PACKER / WRITER</small><b>Chosen output dtype</b><p>Return to CB, L1 or DRAM</p></article></div>
          <div className="flow-sources"><a href={`${sourceRoot}/docs/source/tt-metalium/tt_metal/advanced_topics/compute_engines_and_dataflow_within_tensix.rst#L45-L63`}>Unpacker/packer mechanism ↗</a><a href={`${sourceRoot}/tt_metal/api/tt-metalium/constants.hpp#L13-L21`}>BFP tile storage ↗</a><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/matmul/matmul_nanobind.cpp#L824-L898`}>Linear dtype contract ↗</a></div>
          <div className="model-role-map"><article><span>KEEP WIDE FIRST</span><h3>Norm · residual · sensitive accumulations</h3><b>BF16 / source compute config</b><a href={`${sourceRoot}/models/tt_transformers/tt/model_config.py#L128-L197`}>Accuracy policy ↗</a></article><article><span>FIRST COMPRESSION</span><h3>WQKV · WO · KV cache · most weights</h3><b>BFP8_B</b><a href={`${sourceRoot}/models/tt_transformers/tt/model_config.py#L288-L318`}>Default dtype map ↗</a></article><article><span>SELECTIVE 4-BIT</span><h3>FF1 / FF3 after layer gate</h3><b>BFP4_B + measured fidelity</b><a href={`${sourceRoot}/models/tt_transformers/tt/model_config.py#L198-L237`}>Performance policy ↗</a></article></div>
        </section>

        <section id="apply" className="apply-section-quant">
          <div className="quant-heading"><span>03 / APPLY TO AN LLM</span><h2>One role.<br/>One gate. One run.</h2><p>The source already provides accuracy/performance precision policies. Begin with them; use a custom per-layer configuration only for an isolated sweep.</p></div>
          <div className="decision-chain-quant">{decisionSteps.map(([id,label,detail,source], index) => <div className="decision-node-quant" key={id}><article><span>{id} / {label}</span><p>{detail}</p><a href={source.href}>{source.label} ↗</a></article>{index < decisionSteps.length - 1 && <i>↓</i>}</div>)}</div>
          <div className="code-grid-quant">
            <article><header><span>A · BASELINE</span><button type="button" onClick={() => copy(accuracyCode,"BASELINE")}>{copied === "BASELINE" ? "COPIED" : "COPY"}</button></header><pre>{accuracyCode}</pre><p>The demo parametrization maps these selectors to <code>DecodersPrecision.accuracy/performance</code>. <a href={`${sourceRoot}/models/tt_transformers/demo/simple_text_demo.py#L824-L838`}>Source ↗</a></p></article>
            <article><header><span>B · ONE-LAYER SWEEP</span><button type="button" onClick={() => copy(customCode,"CUSTOM")}>{copied === "CUSTOM" ? "COPIED" : "COPY"}</button></header><pre>{customCode}</pre><p>This uses the real per-decoder control surface. Expand beyond layer 0 only after its quality gate passes. <a href={`${sourceRoot}/models/tt_transformers/tt/model_config.py#L4520-L4598`}>Source ↗</a></p></article>
          </div>
          <div className="acceptance-matrix"><div className="acceptance-row head"><b>GATE</b><b>PREFILL</b><b>DECODE</b><b>REJECT WHEN</b></div><div className="acceptance-row"><span>QUALITY</span><p>Layer outputs, logits, perplexity/task score</p><p>Long-context token/logit agreement</p><p>Any agreed threshold fails</p></div><div className="acceptance-row"><span>PERFORMANCE</span><p>Warm TTFT + prompt tokens/s</p><p>Warm ms/token + user/aggregate t/s</p><p>Conversion cost erases the gain</p></div><div className="acceptance-row"><span>RESOURCE</span><p>Peak L1 + DRAM/NoC traffic</p><p>KV-cache bytes + dispatch gaps</p><p>New spill, recompile or instability appears</p></div></div>
        </section>

        <section id="calibration" className="calibration-section-quant">
          <div className="quant-heading"><span>04 / PTQ · QAT · CALIBRATION</span><h2>Choose the mapping.<br/>Then prove the kernel.</h2><p>Calibration chooses a numeric mapping; it does not create an unsupported kernel. Keep frontend quantization policy and Tenstorrent device legality as two explicit gates.</p></div>
          <div className="calibration-lanes" aria-label="PTQ and QAT implementation paths">
            <article><span>PTQ · NO WEIGHT TRAINING</span><b>FP model → observers → representative calibration → thresholds → qparams → convert</b><p>Fast first experiment. Static activation ranges come from representative samples; weights can often be measured directly.</p><a href={quantizationReferences.pytorchPractice}>Official PyTorch PTQ workflow ↗</a></article>
            <article><span>QAT · FINE-TUNE UNDER NOISE</span><b>FP model → fake quantize → fine-tune → freeze observers → convert</b><p>The forward pass simulates clipping and rounding while trainable weights remain floating point.</p><a href={quantizationReferences.pytorchQat}>Official PyTorch QAT mechanism ↗</a></article>
            <i>Both paths → backend legality → layer/model quality → warm profile</i>
          </div>

          <div className="calibration-workbench">
            <div className="calibration-tabs" role="tablist" aria-label="PTQ QAT calibration question chain">{calibrationQuestions.map((item, index) => <button key={item.key} type="button" role="tab" aria-selected={item.key === activeCalibration.key} className={item.key === activeCalibration.key ? "active" : ""} onClick={() => setActiveCalibrationKey(item.key)}><small>Q{index + 1}</small><b>{item.label}</b></button>)}</div>
            <article className="calibration-answer" role="tabpanel"><span>QUESTION CHAIN / {activeCalibration.label}</span><h3>{activeCalibration.question}</h3><p className="calibration-lead">{activeCalibration.answer}</p><ul>{activeCalibration.points.map((point) => <li key={point}>{point}</li>)}</ul><div>{activeCalibration.sources.map((source) => <a key={source.href} href={source.href}>{source.label} ↗</a>)}</div></article>
          </div>

          <div className="formula-grid">
            <article><span>GENERIC AFFINE MAP</span><code>q = clamp(round(x / s) + z, qmin, qmax)</code><code>x̂ = s × (q − z)</code><p><b>s</b> is scale; <b>z</b> is the integer code representing real zero.</p></article>
            <article><span>SYMMETRIC</span><code>a = max(|xmin|, |xmax|)</code><code>s = a / qmax_abs · z = 0</code><p>Simple zero handling; can waste codes when the distribution is skewed.</p></article>
            <article><span>ASYMMETRIC</span><code>s = (xmax − xmin) / (qmax − qmin)</code><code>z = clamp(round(qmin − xmin / s), qmin, qmax)</code><p>Uses the available codes for a shifted range; zero-point math must be supported.</p></article>
          </div>

          <div className="calibration-methods"><div className="method-head"><b>THRESHOLD METHOD</b><b>MECHANISM</b><b>WHEN TO TRY</b><b>FAILURE MODE</b></div><div><span>MIN–MAX</span><p>Keep observed extrema.</p><p>Clean distributions; fast baseline.</p><p>Outlier stretches the scale.</p></div><div><span>PERCENTILE</span><p>Clip a selected tail probability.</p><p>Rare activation outliers.</p><p>Percentile overfit to calibration set.</p></div><div><span>KL / ENTROPY</span><p>Minimize histogram divergence after quantization.</p><p>Histogram-based static activation PTQ.</p><p>Bin and backend sensitivity.</p></div></div>

          <div className="tenstorrent-calibration-steps"><header><span>TENSTORRENT IMPLEMENTATION ORDER</span><a href="./DISCUSSION_TT_METAL_QUANTIZATION.md#question-6--how-do-i-implement-affine-quantization-for-a-tenstorrent-llm">Copy-ready full procedure ↗</a></header><ol><li><b>Freeze</b><p>Model, input distribution, quality budget, Blackhole target and exact deployment operator.</p></li><li><b>Baseline</b><p>Save BF16 logits, tokens, perplexity/task score and warm performance.</p></li><li><b>Select</b><p>PTQ or QAT; weight-only, static or dynamic activations; granularity and mapping.</p></li><li><b>Observe</b><p>Collect ranges/histograms or fine-tune with deployment-faithful fake quantization.</p></li><li><b>Convert</b><p>Freeze thresholds, scales and zero-points; export packed tensors and Q/DQ boundaries.</p></li><li><b>Prove TT legality</b><p>Operation → program factory → CB formats → LLK → accumulator → packer.</p></li><li><b>Accept</b><p>Require layer, graph, model-quality and repeated warm-performance gates.</p></li></ol></div>
        </section>

        <section className="integer-section-quant">
          <div className="quant-heading light"><span>05 / INTEGER PATH</span><h2>Useful utility.<br/>Different promise.</h2><p><code>ttnn.quantize</code>, <code>requantize</code> and <code>dequantize</code> are real device operations, but their current contracts do not turn <code>ttnn.linear</code> into a generic INT8 LLM kernel.</p></div>
          <div className="integer-grid"><article><header><span>A · AFFINE UTILITY</span><button type="button" onClick={() => copy(utilityCode,"UTILITY")}>{copied === "UTILITY" ? "COPIED" : "COPY"}</button></header><pre>{utilityCode}</pre></article><aside><div><b>QUANTIZE</b><p>Floating input → INT32 or per-tensor UINT8 output.</p></div><div><b>REQUANTIZE</b><p>INT32/UINT8 input and output; per-channel UINT8 output is rejected.</p></div><div><b>DEQUANTIZE</b><p>INT32/UINT8 input → BF16 or FP32 output.</p></div><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L179-L204`}>Quantize checks ↗</a><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L317-L341`}>Requantize checks ↗</a><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/eltwise/quantization/quantization.cpp#L468-L485`}>Dequantize checks ↗</a></aside></div>
          <div className="int8-boundary"><span>WHAT EXISTS BELOW TTNN LINEAR</span><p>Blackhole LLK contains integer format handling and an INT8-math enable path. That proves hardware/LLK capability—not that arbitrary TTNN matmul shapes, layouts, scaling and accuracy are already productized.</p><a href={`${sourceRoot}/tt_metal/tt-llk/tt_llk_blackhole/common/inc/ckernel_defs.h#L279-L284`}>INT8 math predicate ↗</a><a href={`${sourceRoot}/tt_metal/tt-llk/tt_llk_blackhole/llk_lib/llk_math_common.h#L33-L56`}>Math configuration ↗</a></div>
        </section>

        <section id="review" className="logic-section-quant">
          <div className="quant-heading"><span>06 / LOGIC REVIEW</span><h2>Claims that survive<br/>code review.</h2><p>Each tempting shortcut below was checked against the pinned TT-Metal and model source.</p></div>
          <div className="logic-table"><div className="logic-row head"><b>TEMPTING CLAIM</b><b>WHY IT FAILS</b><b>REPLACEMENT + REFERENCE</b></div>{logicRows.map(([claim,problem,replacement,source]) => <div className="logic-row" key={claim}><p>{claim}</p><p>{problem}</p><p>{replacement}<a href={source.href}>{source.label} ↗</a></p></div>)}</div>
          <div className="quant-source-map"><div><span>MODEL POLICY</span><a href={`${sourceRoot}/models/tt_transformers/tt/model_config.py#L67-L80`}>Tensor/precision groups ↗</a><a href={`${sourceRoot}/models/tt_transformers/tt/model_config.py#L128-L237`}>Accuracy/performance ↗</a><a href={`${sourceRoot}/models/tt_transformers/tt/model_config.py#L4520-L4598`}>Per-decoder mapping ↗</a></div><div><span>DATA CONTRACT</span><a href={`${sourceRoot}/tt_metal/api/tt-metalium/tensor/tensor_types.hpp#L26-L40`}>DataType ↗</a><a href={`${sourceRoot}/tt_metal/api/tt-metalium/tt_backend_api_types.hpp#L18-L56`}>Low-level DataFormat ↗</a><a href={`${sourceRoot}/ttnn/cpp/ttnn/operations/matmul/matmul_nanobind.cpp#L824-L898`}>Linear ↗</a></div><div><span>PINNED REVISION</span><code>{revision}</code><p>Verified against <code>/home/n/src/tt-metal</code> in WSL Ubuntu.</p></div></div>
        </section>
      </main>

      <footer className="quant-footer"><div><b>TT•SIM · DISCUSSION SUBPAGE 05</b><p>Source-backed mixed precision and quantization for TTNN/TT-Metal LLMs.</p></div><a href="./discussion-presentation.html">30-minute deck →</a><a href="./discussion-transformer-blackhole-optimization.html">Optimization chain →</a><a href="./discussion.html">Discussion →</a><a href="./index.html">Book →</a></footer>
    </div>
  );
}

export default QuantizationApp;
