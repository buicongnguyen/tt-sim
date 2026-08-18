import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DiscussionApp from "./DiscussionApp";
import "./discussion.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DiscussionApp />
  </StrictMode>,
);
