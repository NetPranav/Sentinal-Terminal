import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DiagnosticLogger } from "./infrastructure/logging/DiagnosticLogger";

DiagnosticLogger.init().catch(() => {});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
