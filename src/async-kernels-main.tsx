import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AsyncKernelsApp from "./AsyncKernelsApp";
import BookFrame from "./BookFrame";
import "./async-kernels.css";
import "./book-frame.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookFrame>
      <AsyncKernelsApp />
    </BookFrame>
  </StrictMode>,
);
