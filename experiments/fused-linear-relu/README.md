# Fused linear + ReLU compiler fixture

These files are the target-independent starting point for the compiler/runtime
capstone documented in `docs/COMPILER_RUNTIME_CAPSTONE.md`.

- `input.mlir` expresses `matmul → add_bias → relu`.
- `expected.mlir` expresses the desired fused operation.
- `oracle.py` checks the valid graph and one invalid-shape diagnostic with a
  deterministic NumPy input.

The quoted `lab.*` operations are intentionally unregistered. That keeps the
IR useful before you define the real TableGen operations and rewrite pass.

```bash
python3 oracle.py

# With an LLVM/MLIR or TT-MLIR build:
$TT_MLIR_HOME/build/bin/ttmlir-opt \
  --allow-unregistered-dialect input.mlir -o /dev/null
```

Do not compare `input.mlir` and `expected.mlir` by text substitution. Implement
a rewrite that checks shapes, element types, bias compatibility and intermediate
uses, then add positive and negative pass tests.
