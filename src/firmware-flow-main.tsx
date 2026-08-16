import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FirmwareFlowApp from "./FirmwareFlowApp";
import "./firmware-flow.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FirmwareFlowApp />
  </StrictMode>,
);
