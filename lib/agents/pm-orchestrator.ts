// lib/agents/pm-orchestrator.ts
// PM Orchestrator — coordinates intake, all build agents, live preview, and progress.
// Runs agents in waves with dependency ordering, manages build state, and reports
// progress to both console and browser overlay.

import type {
  ProjectBrief,
  ProductInsights,
  SystemArchitecture,
  DesignSystem,
  BuildState,
  BuildStatus,
  BuildResult,
  EditResult,
  BuildPhase,
  AgentResult,
  QAReport,
  PageOutput,
  BackendRoute,
} from "./types.js";
import type { ProjectCopy } from "../copy-planner/types.js";
import type { PageSpecFull } from "@shared/spec-schema.js";
import { ArtifactStore } from "./artifact-store.js";
import { AgentRunner } from "./agent-runner.js";
import { ensureLivePreviewServer, type LivePreviewServer } from "../react-gen/live-preview-server.js";
import { injectBuildOverlay, removeBuildOverlay } from "../react-gen/build-status-overlay.js";
import { editPage } from "../react-gen/edit-mode.js";
import { runIntake as runIntakePhase } from "../intake/intake-orchestrator.js";
import { loadProjectConfig } from "../project-config.js";
import { runProductIntelAgent } from "./product-intel-agent.js";
import { runArchitectureAgent } from "./architecture-agent.js";
import { runDesignSystemAgent } from "./design-system-agent.js";
import { runCopyAgent } from "./copy-agent.js";
import { runComponentLibraryAgent } from "./component-library-agent.js";
import { runPageAgent } from "./page-agent.js";
import { runBackendAgent } from "./backend-agent.js";
import { runQAAgent } from "./qa-agent.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_CONCURRENCY = 5;
const CRITICAL_AGENTS = new Set(["architecture", "design-system"]);

// ─── PMOrchestrator ─────────────────────────────────────────────────────────

export class PMOrchestrator {
  private store: ArtifactStore;
  private runner: AgentRunner;
  private projectRoot: string;
  private buildState: BuildState | null = null;
  private livePreview: LivePreviewServer | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.store = new ArtifactStore(projectRoot);
    this.runner = new AgentRunner(projectRoot);
  }

  // ─── Intake ─────────────────────────────────────────────────────────────

  async runIntake(): Promise<ProjectBrief> {
    this.log("intake", "start", "Running intake phase...");
    const config = loadProjectConfig(this.projectRoot);
    const result = await runIntakePhase(config);
    this.store.setBrief(result.brief);
    this.log("intake", "complete", `Intake complete — mode: ${result.mode}`);
    return result.brief;
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  async runBuild(brief: ProjectBrief): Promise<BuildResult> {
    const errors: string[] = [];

    // 1. Persist brief and initialize build state
    this.store.setBrief(brief);
    this.initBuildState(brief);

    // Start live preview server
    try {
      this.livePreview = await ensureLivePreviewServer(this.projectRoot);
      await injectBuildOverlay(this.projectRoot);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log("live-preview", "warning", `Live preview unavailable: ${msg}`);
    }

    try {
      // ── Wave 1: Product Intel ───────────────────────────────────────────
      this.updatePhase("product-intel");
      const intelResult = await this.runner.run(
        () => runProductIntelAgent(brief, this.store),
        { name: "product-intel", onProgress: (msg) => this.onAgentProgress("product-intel", msg) },
      );
      this.recordAgentResult("product-intel", intelResult);
      this.saveCheckpoint("product-intel");

      if (intelResult.status === "failed") {
        this.log("product-intel", "warning", `Product intel failed: ${intelResult.error}. Continuing with defaults.`);
      }
      const insights = intelResult.data ?? this.buildDefaultInsights(brief);

      // ── Wave 2: Architecture + Design System (parallel) ─────────────────
      this.updatePhase("architecture");
      const wave2Results = await this.runner.runParallel(
        [
          { name: "architecture", fn: () => runArchitectureAgent(brief, insights, this.store) },
          { name: "design-system", fn: () => runDesignSystemAgent(brief, insights, this.store) },
        ],
        { concurrency: 2, onProgress: (name, msg) => this.onAgentProgress(name, msg) },
      );

      const archResult = wave2Results[0] as AgentResult<SystemArchitecture>;
      const dsResult = wave2Results[1] as AgentResult<DesignSystem>;
      this.recordAgentResult("architecture", archResult);
      this.recordAgentResult("design-system", dsResult);
      this.saveCheckpoint("architecture");

      // Abort on critical failures
      if (archResult.status === "failed") {
        errors.push(`Architecture agent failed: ${archResult.error}`);
        return this.buildFailedResult(errors);
      }
      if (dsResult.status === "failed") {
        errors.push(`Design system agent failed: ${dsResult.error}`);
        return this.buildFailedResult(errors);
      }

      // ── Wave 3: Copy + Component Library (parallel) ─────────────────────
      this.updatePhase("copy");
      const wave3Results = await this.runner.runParallel(
        [
          { name: "copy", fn: () => runCopyAgent(brief, insights, this.store) },
          { name: "component-library", fn: () => runComponentLibraryAgent(brief, this.store) },
        ],
        { concurrency: 2, onProgress: (name, msg) => this.onAgentProgress(name, msg) },
      );

      const copyResult = wave3Results[0] as AgentResult<ProjectCopy>;
      const compResult = wave3Results[1] as AgentResult<Record<string, string>>;
      this.recordAgentResult("copy", copyResult);
      this.recordAgentResult("component-library", compResult);
      this.saveCheckpoint("component-library");

      if (copyResult.status === "failed") {
        this.log("copy", "warning", `Copy agent failed: ${copyResult.error}. Pages will use default copy.`);
      }
      if (compResult.status === "failed") {
        this.log("component-library", "warning", `Component library failed: ${compResult.error}. Pages will inline components.`);
      }

      // ── Wave 4: Pages (concurrency 5) + Backend (parallel alongside) ───
      this.updatePhase("pages");
      const pages = brief.spec.pages as PageSpecFull[];
      const pageItems = pages.map((pageSpec, idx) => ({
        name: `page:${pageSpec.name}`,
        fn: async (): Promise<PageOutput> => {
          // For visual consistency, pass the prior page's summary to the next page.
          // Since pages run in parallel with concurrency, we use the stored outputs
          // to find the most recently completed page summary.
          const priorOutputs = this.store.getPageOutputs() ?? [];
          const priorSummary = priorOutputs.length > 0
            ? `Prior page "${priorOutputs[priorOutputs.length - 1].pageName}" at route ${priorOutputs[priorOutputs.length - 1].route} scored ${priorOutputs[priorOutputs.length - 1].reviewScore}/10.`
            : undefined;
          const output = await runPageAgent(pageSpec, brief, this.store, priorSummary);
          this.store.addPageOutput(output);
          return output;
        },
      }));

      const backendItem = {
        name: "backend",
        fn: () => runBackendAgent(brief, this.store),
      };

      // Run pages and backend in parallel — pages capped at PAGE_CONCURRENCY
      const [pageResults, backendResult] = await Promise.all([
        this.runner.runParallel<PageOutput>(pageItems, {
          concurrency: PAGE_CONCURRENCY,
          onProgress: (name, msg) => this.onAgentProgress(name, msg),
        }),
        this.runner.run(backendItem.fn, {
          name: "backend",
          onProgress: (msg) => this.onAgentProgress("backend", msg),
        }),
      ]);

      // Record page results
      let pagesBuilt = 0;
      for (const pr of pageResults) {
        this.recordAgentResult(pr.agentName, pr);
        if (pr.status === "completed") {
          pagesBuilt++;
        } else {
          errors.push(`Page "${pr.agentName}" failed: ${pr.error}`);
        }
      }

      // Record backend result
      this.recordAgentResult("backend", backendResult);
      const backendRoutes = backendResult.data
        ? (Array.isArray(backendResult.data) ? (backendResult.data as BackendRoute[]).length : 0)
        : 0;
      if (backendResult.status === "failed") {
        errors.push(`Backend agent failed: ${backendResult.error}`);
      }

      this.saveCheckpoint("pages");

      // ── Wave 5: QA Agent ────────────────────────────────────────────────
      this.updatePhase("qa");
      const qaResult = await this.runner.run(
        () => runQAAgent(this.store),
        { name: "qa", onProgress: (msg) => this.onAgentProgress("qa", msg) },
      );
      this.recordAgentResult("qa", qaResult);
      this.saveCheckpoint("qa");

      const qaReport = qaResult.data as QAReport | null;

      // Clean up overlay
      try {
        await removeBuildOverlay(this.projectRoot);
      } catch {
        // Non-critical
      }

      // Determine success
      const qaPasssed = qaReport?.allPassed ?? false;
      const success = qaPasssed && errors.length === 0;
      this.updatePhase(success ? "complete" : "failed");

      if (!success && qaReport && !qaReport.allPassed) {
        const remaining = qaReport.remainingIssues.length;
        errors.push(`QA found ${remaining} remaining issue${remaining === 1 ? "" : "s"}`);
      }

      return {
        success,
        buildState: this.buildState!,
        qaReport,
        pagesBuilt,
        backendRoutes,
        errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Build aborted: ${msg}`);
      this.updatePhase("failed");

      try {
        await removeBuildOverlay(this.projectRoot);
      } catch {
        // Non-critical
      }

      return this.buildFailedResult(errors);
    }
  }

  // ─── Edit ───────────────────────────────────────────────────────────────

  async runEdit(instruction: string): Promise<EditResult> {
    const brief = this.store.getBrief();
    if (!brief) {
      return { pagesEdited: [], qaReport: null, success: false, errors: ["No project brief found in store. Run a build first."] };
    }

    // Parse which page to edit from the instruction.
    // Convention: instruction starts with "PageName: ..." or we edit all pages mentioned.
    const pages = brief.spec.pages as PageSpecFull[];
    const matchedPage = pages.find((p) => instruction.toLowerCase().startsWith(p.name.toLowerCase() + ":"));
    const pageName = matchedPage?.name ?? pages[0]?.name;

    if (!pageName) {
      return { pagesEdited: [], qaReport: null, success: false, errors: ["No pages found in project brief."] };
    }

    const cleanInstruction = matchedPage
      ? instruction.slice(pageName.length + 1).trim()
      : instruction;

    this.log("edit", "start", `Editing page "${pageName}": ${cleanInstruction.slice(0, 100)}`);

    const editResult = await editPage({
      pageName,
      instruction: cleanInstruction,
      projectRoot: this.projectRoot,
      projectBrief: brief,
    });

    const pagesEdited = editResult.editApplied ? [pageName] : [];

    // Re-run QA
    this.log("edit", "qa", "Re-running QA after edit...");
    const qaResult = await this.runner.run(
      () => runQAAgent(this.store),
      { name: "qa-post-edit", onProgress: (msg) => this.onAgentProgress("qa-post-edit", msg) },
    );

    const qaReport = qaResult.data as QAReport | null;
    const qaErrors: string[] = [];

    if (qaReport && !qaReport.allPassed) {
      qaErrors.push(`QA found ${qaReport.remainingIssues.length} issue(s) after edit`);
    }
    if (!editResult.compiledClean) {
      qaErrors.push(`TypeScript errors remain after ${editResult.fixAttempts} fix attempts`);
    }

    const success = editResult.editApplied && editResult.compiledClean && (qaReport?.allPassed ?? true);

    this.log("edit", "complete", `Edit ${success ? "succeeded" : "completed with issues"}`);

    return {
      pagesEdited,
      qaReport,
      success,
      errors: qaErrors,
    };
  }

  // ─── Status ─────────────────────────────────────────────────────────────

  getStatus(): BuildState | null {
    return this.buildState;
  }

  // ─── Private: Build State Management ────────────────────────────────────

  private initBuildState(brief: ProjectBrief): void {
    const now = new Date().toISOString();
    const pages = brief.spec.pages as PageSpecFull[];
    // Total agents: product-intel + architecture + design-system + copy + component-library + N pages + backend + qa
    const totalAgents = 5 + pages.length + 1 + 1;

    this.buildState = {
      projectRoot: this.projectRoot,
      brief,
      status: {
        phase: "intake",
        totalAgents,
        completedAgents: [],
        currentAgents: [],
        failedAgents: [],
        startedAt: now,
        updatedAt: now,
      },
      agentResults: {},
      checkpoints: [],
    };

    this.store.setBuildState(this.buildState);
    this.store.setBuildStatus(this.buildState.status);
  }

  private updatePhase(phase: BuildPhase): void {
    if (!this.buildState) return;
    this.buildState.status.phase = phase;
    this.buildState.status.updatedAt = new Date().toISOString();
    this.store.setBuildState(this.buildState);
    this.store.setBuildStatus(this.buildState.status);
    console.log(`\n[pm] ── Phase: ${phase} ${"─".repeat(50 - phase.length)}\n`);
  }

  private recordAgentResult(name: string, result: AgentResult<unknown>): void {
    if (!this.buildState) return;
    this.buildState.agentResults[name] = result;

    // Update status lists
    const status = this.buildState.status;
    status.currentAgents = status.currentAgents.filter((a) => a !== name);

    if (result.status === "completed") {
      if (!status.completedAgents.includes(name)) {
        status.completedAgents.push(name);
      }
    } else if (result.status === "failed") {
      if (!status.failedAgents.includes(name)) {
        status.failedAgents.push(name);
      }
    }

    status.updatedAt = new Date().toISOString();
    this.store.setBuildState(this.buildState);
    this.store.setBuildStatus(status);
    this.store.setAgentResult(name, result);
  }

  private saveCheckpoint(phase: BuildPhase): void {
    if (!this.buildState) return;
    this.buildState.checkpoints.push({
      phase,
      timestamp: new Date().toISOString(),
    });
    this.store.setBuildState(this.buildState);
  }

  // ─── Private: Progress Reporting ────────────────────────────────────────

  private onAgentProgress(agentName: string, msg: string): void {
    // Console output
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(`  [${timestamp}] ${agentName}: ${msg}`);

    // Build log
    this.store.appendBuildLog({ agent: agentName, event: "progress", timestamp: Date.now(), detail: msg });

    // Update current agents in status
    if (this.buildState) {
      const status = this.buildState.status;
      if (msg.startsWith("Starting") && !status.currentAgents.includes(agentName)) {
        status.currentAgents.push(agentName);
        status.updatedAt = new Date().toISOString();
        this.store.setBuildStatus(status);
      }
    }
  }

  private log(agent: string, event: string, detail: string): void {
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(`  [${timestamp}] ${agent}: ${detail}`);
    this.store.appendBuildLog({ agent, event, timestamp: Date.now(), detail });
  }

  // ─── Private: Helpers ───────────────────────────────────────────────────

  private buildDefaultInsights(brief: ProjectBrief): ProductInsights {
    return {
      productCategory: "saas",
      targetUserProfile: brief.targetUsers.join(", ") || "general users",
      competitiveIntel: brief.competitiveIntel ?? null,
      designRecommendations: [],
      copyRecommendations: [],
      architectureRecommendations: [],
      marketPositioning: brief.productDescription,
    };
  }

  private buildFailedResult(errors: string[]): BuildResult {
    this.updatePhase("failed");
    return {
      success: false,
      buildState: this.buildState!,
      qaReport: this.store.getQAReport(),
      pagesBuilt: (this.store.getPageOutputs() ?? []).length,
      backendRoutes: (this.store.getBackendRoutes() ?? []).length,
      errors,
    };
  }
}
