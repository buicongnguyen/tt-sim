import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import BlackholeSynchronizationApp from "./BlackholeSynchronizationApp";
import BookFrame from "./BookFrame";
import "./blackhole-synchronization.css";
import "./book-frame.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookFrame>
      <BlackholeSynchronizationApp />
    </BookFrame>
  </StrictMode>,
);
