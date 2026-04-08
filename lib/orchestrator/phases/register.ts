// lib/orchestrator/phases/register.ts
// Single import to wire all 5 phase implementations into the orchestrator
// registry. Call `registerAllPhases()` once at startup before invoking
// runPipeline / resumePipeline.

import { registerPhaseImplementation } from "../index.js";
import { specPhaseImplementation } from "./spec-adapter.js";
import { uiGenPhaseImplementation } from "./ui-gen-adapter.js";
import { integrationPhaseImplementation } from "./integration-adapter.js";
import { backendPhaseImplementation } from "./backend-adapter.js";
import { deployPhaseImplementation } from "./deploy-adapter.js";

export function registerAllPhases(): void {
  registerPhaseImplementation("spec", specPhaseImplementation);
  registerPhaseImplementation("ui-gen", uiGenPhaseImplementation);
  registerPhaseImplementation("integration", integrationPhaseImplementation);
  registerPhaseImplementation("backend", backendPhaseImplementation);
  registerPhaseImplementation("deploy", deployPhaseImplementation);
}
