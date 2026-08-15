module {
  func.func @linear_relu(
      %a: tensor<64x128xbf16>,
      %b: tensor<128x64xbf16>,
      %bias: tensor<64x64xbf16>) -> tensor<64x64xbf16> {
    %matmul = "lab.matmul"(%a, %b)
      : (tensor<64x128xbf16>, tensor<128x64xbf16>) -> tensor<64x64xbf16>
    %biased = "lab.add_bias"(%matmul, %bias)
      : (tensor<64x64xbf16>, tensor<64x64xbf16>) -> tensor<64x64xbf16>
    %result = "lab.relu"(%biased)
      : (tensor<64x64xbf16>) -> tensor<64x64xbf16>
    return %result : tensor<64x64xbf16>
  }
}
