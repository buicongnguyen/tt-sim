import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ArchitectureInterviewQAApp from "./ArchitectureInterviewQAApp";
import "./architecture-interview-qa.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ArchitectureInterviewQAApp />
  </StrictMode>,
);
