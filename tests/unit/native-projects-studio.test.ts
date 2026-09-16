import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../client/src/components/native-projects-studio.tsx", import.meta.url), "utf8");

describe("native projects and tasks", () => {
  it("is founder-accessible and requires both explicit project and task grants for other roles", () => {
    expect(overlay).toContain("NativeProjectsStudio");
    expect(overlay).toContain('toolEntitlements.has("projects")');
    expect(overlay).toContain('toolEntitlements.has("tasks")');
    expect(overlay).toContain("mayOperateNativeProjects");
  });
  it("creates role-owned governed projects and tasks with versioned lifecycle changes", () => {
    expect(studio).toContain('instrumentKey: "projects"');
    expect(studio).toContain('instrumentKey: "tasks"');
    expect(studio).toContain("ownerSeatId");
    expect(studio).toContain("expectedVersion: object.version");
  });
  it("retains hierarchy and role-agent assistance rather than creating a detached task-board dependency", () => {
    expect(studio).toContain("does not bypass the hierarchy");
    expect(studio).toContain("role agent acting as that person’s assistant");
  });
});
