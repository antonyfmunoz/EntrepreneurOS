import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { RootErrorBoundary } from "@/components/root-error-boundary";

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
);
