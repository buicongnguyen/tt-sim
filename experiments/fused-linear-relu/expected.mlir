module {
  func.func @linear_relu(
      %a: tensor<64x128xbf16>,
      %b: tensor<128x64xbf16>,
      %bias: tensor<64x64xbf16>) -> tensor<64x64xbf16> {
    %result = "lab.fused_linear_relu"(%a, %b, %bias)
      : (tensor<64x128xbf16>, tensor<128x64xbf16>, tensor<64x64xbf16>) -> tensor<64x64xbf16>
    return %result : tensor<64x64xbf16>
  }
}
