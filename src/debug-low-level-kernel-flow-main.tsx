import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import mermaid from "mermaid";
import DebugLowLevelKernelFlowApp from "./DebugLowLevelKernelFlowApp";
import "./debug-low-level-kernel-flow.css";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "dark",
  sequence: { useMaxWidth: true, wrap: true, diagramMarginX: 18 },
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
  themeVariables: {
    background: "#101821",
    primaryColor: "#172531",
    primaryTextColor: "#f4f1e8",
    primaryBorderColor: "#67d6c2",
    lineColor: "#ffb45c",
    secondaryColor: "#243247",
    tertiaryColor: "#101821",
    noteBkgColor: "#273748",
    noteTextColor: "#f4f1e8",
    actorBkg: "#172531",
    actorBorder: "#67d6c2",
    actorTextColor: "#f4f1e8",
    signalColor: "#ffb45c",
    signalTextColor: "#f4f1e8",
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DebugLowLevelKernelFlowApp />
  </StrictMode>,
);

const renderDiagrams = async () => {
  try {
    await mermaid.run({ querySelector: ".mermaid" });
    document.documentElement.dataset.mermaid = "ready";
  } catch (error) {
    document.documentElement.dataset.mermaid = "failed";
    console.error("Mermaid rendering failed", error);
  }
};

if (document.readyState === "complete") {
  requestAnimationFrame(() => void renderDiagrams());
} else {
  window.addEventListener("load", () => void renderDiagrams(), { once: true });
}
