import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import BlackholeSynchronizationApp from "./BlackholeSynchronizationApp";
import "./blackhole-synchronization.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BlackholeSynchronizationApp />
  </StrictMode>,
);
