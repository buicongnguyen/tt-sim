import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PresentationApp from "./PresentationApp";
import "./presentation.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PresentationApp />
  </StrictMode>,
);
