import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import QuantizationApp from "./QuantizationApp";
import "./quantization.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QuantizationApp />
  </StrictMode>,
);
