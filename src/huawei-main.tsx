import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import HuaweiApp from "./HuaweiApp";
import BookFrame from "./BookFrame";
import "./huawei.css";
import "./book-frame.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BookFrame>
      <HuaweiApp />
    </BookFrame>
  </StrictMode>,
);
