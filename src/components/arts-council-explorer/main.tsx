// Local development harness. Not part of the published component.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import ArtsCouncilExplorer from "./ArtsCouncilExplorer";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ArtsCouncilExplorer />
  </StrictMode>
);
