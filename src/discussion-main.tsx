import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import BookFrame from "./BookFrame";
import DiscussionApp from "./DiscussionApp";
import "./discussion.css";
import "./book-frame.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookFrame><DiscussionApp /></BookFrame>
  </StrictMode>,
);
