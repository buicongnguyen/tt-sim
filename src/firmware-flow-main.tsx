import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FirmwareFlowApp from "./FirmwareFlowApp";
import BookFrame from "./BookFrame";
import "./firmware-flow.css";
import "./book-frame.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookFrame>
      <FirmwareFlowApp />
    </BookFrame>
  </StrictMode>,
);
