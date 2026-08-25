import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TransformerOptimizationApp from "./TransformerOptimizationApp";
import BookFrame from "./BookFrame";
import "./transformer-optimization.css";
import "./book-frame.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookFrame>
      <TransformerOptimizationApp />
    </BookFrame>
  </StrictMode>,
);
