import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import QuantizationApp from "./QuantizationApp";
import BookFrame from "./BookFrame";
import "./quantization.css";
import "./book-frame.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookFrame>
      <QuantizationApp />
    </BookFrame>
  </StrictMode>,
);
