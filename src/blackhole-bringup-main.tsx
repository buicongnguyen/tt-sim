import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import BlackholeBringupApp from "./BlackholeBringupApp";
import BookFrame from "./BookFrame";
import "./blackhole-bringup.css";
import "./book-frame.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookFrame>
      <BlackholeBringupApp />
    </BookFrame>
  </StrictMode>,
);
