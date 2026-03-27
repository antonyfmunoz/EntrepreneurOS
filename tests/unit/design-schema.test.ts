import { describe, it, expect } from "vitest";
import {
  insertDmProjectSchema,
  insertDmTokenSchema,
  insertPipelineRunSchema,
  insertPipelinePageSchema,
  ProjectConfigSchema,
  PageStateSchema,
  PipelineRunSchema,
  SpecPhaseOutputSchema,
  UiGenPhaseOutputSchema,
} from "@shared/design-schema";

describe("design memory insert schemas", () => {
  it("accepts a valid dm_projects insert", () => {
    const result = insertDmProjectSchema.safeParse({
      projectId: "test-project-01",
      name: "Test Project",
      repoPath: "/opt/projects/test",
      framework: "react-vite-tailwind-shadcn",
    });
    expect(result.success).toBe(true);
  });

  it("rejects dm_projects insert with missing projectId", () => {
    const result = insertDmProjectSchema.safeParse({
      name: "Test Project",
      repoPath: "/opt/projects/test",
      framework: "react-vite-tailwind-shadcn",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid dm_tokens insert with numeric fields", () => {
    const result = insertDmTokenSchema.safeParse({
      projectId: "test-project-01",
      version: 1,
      colorPrimary: "#1a1a2e",
      typeSizeBase: "16",
      spacingUnit: "4",
      borderRadius: "8",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid pipeline_runs insert", () => {
    const result = insertPipelineRunSchema.safeParse({
      projectId: "test-project-01",
      phase: "spec",
      status: "running",
      config: JSON.stringify({
        projectId: "test-project-01",
        repoPath: "/opt/test",
        framework: "react-vite-tailwind-shadcn",
      }),
    });
    expect(result.success).toBe(true);
  });

  it("accepts pipeline_pages insert with error field (D-10)", () => {
    const result = insertPipelinePageSchema.safeParse({
      runId: 1,
      projectId: "test-project-01",
      pageName: "dashboard",
      pageIndex: 0,
      phase: "ui-gen",
      status: "failed",
      error: "Stitch API returned 429",
    });
    expect(result.success).toBe(true);
  });
});

describe("pipeline state Zod contracts", () => {
  it("validates a correct ProjectConfig", () => {
    const result = ProjectConfigSchema.safeParse({
      projectId: "my-saas-app",
      repoPath: "/opt/projects/my-saas",
      framework: "react-vite-tailwind-shadcn",
    });
    expect(result.success).toBe(true);
  });

  it("rejects ProjectConfig with empty projectId", () => {
    const result = ProjectConfigSchema.safeParse({
      projectId: "",
      repoPath: "/opt/projects/test",
      framework: "react-vite-tailwind-shadcn",
    });
    expect(result.success).toBe(false);
  });

  it("accepts PageState with null error field (D-10)", () => {
    const result = PageStateSchema.safeParse({
      pageName: "dashboard",
      pageIndex: 0,
      status: "pending",
      error: null,
      output: null,
    });
    expect(result.success).toBe(true);
  });

  it("validates PipelineRun phase enum rejects invalid phase", () => {
    const valid = PipelineRunSchema.safeParse({
      projectId: "test",
      phase: "ui-gen",
      config: {
        projectId: "test",
        repoPath: "/opt/test",
        framework: "react-vite-tailwind-shadcn",
      },
    });
    expect(valid.success).toBe(true);

    const invalid = PipelineRunSchema.safeParse({
      projectId: "test",
      phase: "nonexistent-phase",
      config: {
        projectId: "test",
        repoPath: "/opt/test",
        framework: "react-vite-tailwind-shadcn",
      },
    });
    expect(invalid.success).toBe(false);
  });

  it("validates UiGenPhaseOutput with URL fields", () => {
    const result = UiGenPhaseOutputSchema.safeParse({
      htmlUrl: "https://storage.googleapis.com/stitch/abc.html",
      screenshotUrl: "https://storage.googleapis.com/stitch/abc.png",
      tokenVersion: 1,
      approved: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects UiGenPhaseOutput with non-URL htmlUrl", () => {
    const result = UiGenPhaseOutputSchema.safeParse({
      htmlUrl: "not-a-url",
      screenshotUrl: "https://example.com/img.png",
      tokenVersion: 1,
      approved: true,
    });
    expect(result.success).toBe(false);
  });
});
