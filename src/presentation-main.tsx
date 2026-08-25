import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PresentationApp from "./PresentationApp";
import BookFrame from "./BookFrame";
import "./presentation.css";
import "./book-frame.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookFrame>
      <PresentationApp />
    </BookFrame>
  </StrictMode>,
);
