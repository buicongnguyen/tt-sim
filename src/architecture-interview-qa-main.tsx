import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ArchitectureInterviewQAApp from "./ArchitectureInterviewQAApp";
import BookFrame from "./BookFrame";
import "./architecture-interview-qa.css";
import "./book-frame.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookFrame>
      <ArchitectureInterviewQAApp />
    </BookFrame>
  </StrictMode>,
);
