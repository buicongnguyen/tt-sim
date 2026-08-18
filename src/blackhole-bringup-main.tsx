import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import BlackholeBringupApp from "./BlackholeBringupApp";
import "./blackhole-bringup.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BlackholeBringupApp />
  </StrictMode>,
);
