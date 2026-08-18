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
      },
    },
  },
});
