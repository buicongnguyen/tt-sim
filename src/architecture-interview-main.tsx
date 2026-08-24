import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import mermaid from "mermaid";
import ArchitectureInterviewApp from "./ArchitectureInterviewApp";
import "./architecture-interview.css";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
  sequence: { useMaxWidth: true, wrap: true, diagramMarginX: 18 },
  themeVariables: {
    background: "#f2f0df",
    primaryColor: "#dce873",
    primaryTextColor: "#10140f",
    primaryBorderColor: "#10140f",
    lineColor: "#d15a3e",
    secondaryColor: "#93c8e8",
    tertiaryColor: "#f2f0df",
    actorBkg: "#f2f0df",
    actorBorder: "#10140f",
    actorTextColor: "#10140f",
    signalColor: "#d15a3e",
    signalTextColor: "#10140f",
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ArchitectureInterviewApp />
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
