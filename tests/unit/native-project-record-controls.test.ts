import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectsStudio = readFileSync(new URL("../../client/src/components/native-projects-studio.tsx", import.meta.url), "utf8");

describe("native project record controls", () => {
  it("keeps selected projects and tasks configurable with version protection", () => {
    expect(projectsStudio).toContain("Configure selected project");
    expect(projectsStudio).toContain("native-project-configure");
    expect(projectsStudio).toContain("expectedVersion: selectedProject.version");
    expect(projectsStudio).toContain("Configure selected task");
    expect(projectsStudio).toContain("native-task-configure");
    expect(projectsStudio).toContain("expectedVersion: selectedTask.version");
  });
});
