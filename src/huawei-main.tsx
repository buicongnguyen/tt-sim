import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import HuaweiApp from "./HuaweiApp";
import "./huawei.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HuaweiApp />
  </StrictMode>,
);
