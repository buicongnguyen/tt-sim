#!/usr/bin/env python3
"""Deterministic host oracle for Y = ReLU(A @ B + bias)."""

from __future__ import annotations

import numpy as np


def validate_shapes(a: np.ndarray, b: np.ndarray, bias: np.ndarray) -> None:
    if a.ndim != 2 or b.ndim != 2 or bias.ndim != 2:
        raise ValueError("all inputs must be rank-2 tensors")
    if a.shape[1] != b.shape[0]:
        raise ValueError("incompatible matmul dimensions")
    output_shape = (a.shape[0], b.shape[1])
    if bias.shape != output_shape:
        raise ValueError(f"bias shape {bias.shape} does not match output {output_shape}")


def unfused(a: np.ndarray, b: np.ndarray, bias: np.ndarray) -> np.ndarray:
    validate_shapes(a, b, bias)
    matmul = a @ b
    biased = matmul + bias
    return np.maximum(biased, np.float32(0.0))


def fused_reference(a: np.ndarray, b: np.ndarray, bias: np.ndarray) -> np.ndarray:
    validate_shapes(a, b, bias)
    return np.maximum(np.matmul(a, b) + bias, np.float32(0.0))


def main() -> None:
    rng = np.random.default_rng(20260816)
    a = rng.standard_normal((64, 128), dtype=np.float32)
    b = rng.standard_normal((128, 64), dtype=np.float32)
    bias = rng.standard_normal((64, 64), dtype=np.float32)

    actual = fused_reference(a, b, bias)
    expected = unfused(a, b, bias)
    np.testing.assert_allclose(actual, expected, rtol=0.0, atol=0.0)
    print(f"PASS valid graph: shape={actual.shape}")

    try:
        fused_reference(a, b[:127, :], bias)
    except ValueError as error:
        assert str(error) == "incompatible matmul dimensions"
        print("PASS invalid graph: incompatible matmul dimensions rejected")
    else:
        raise AssertionError("invalid graph was accepted")


if __name__ == "__main__":
    main()
