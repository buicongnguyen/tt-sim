import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AsyncKernelsApp from "./AsyncKernelsApp";
import "./async-kernels.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AsyncKernelsApp />
  </StrictMode>,
);
