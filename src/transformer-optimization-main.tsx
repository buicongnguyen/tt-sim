import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TransformerOptimizationApp from "./TransformerOptimizationApp";
import "./transformer-optimization.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TransformerOptimizationApp />
  </StrictMode>,
);
