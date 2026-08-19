import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        huawei: fileURLToPath(new URL("./huawei.html", import.meta.url)),
        asyncKernels: fileURLToPath(new URL("./async-kernels.html", import.meta.url)),
        firmwareFlow: fileURLToPath(new URL("./firmware-flow.html", import.meta.url)),
        discussion: fileURLToPath(new URL("./discussion.html", import.meta.url)),
        blackholeBringup: fileURLToPath(new URL("./discussion-blackhole-bringup.html", import.meta.url)),
        blackholeSynchronization: fileURLToPath(new URL("./discussion-blackhole-synchronization.html", import.meta.url)),
        transformerOptimization: fileURLToPath(new URL("./discussion-transformer-blackhole-optimization.html", import.meta.url)),
        presentation: fileURLToPath(new URL("./discussion-presentation.html", import.meta.url)),
        quantization: fileURLToPath(new URL("./discussion-quantization.html", import.meta.url)),
        debugLowLevelKernelFlow: fileURLToPath(new URL("./debug-low-level-kernel-flow.html", import.meta.url)),
      },
    },
  },
});
