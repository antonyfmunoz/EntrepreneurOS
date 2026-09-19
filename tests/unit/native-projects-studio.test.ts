import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../client/src/components/native-projects-studio.tsx", import.meta.url), "utf8");
const crmStudio = readFileSync(new URL("../../client/src/components/native-crm-studio.tsx", import.meta.url), "utf8");

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

  it("lets a CRM role create a governed follow-up only when that role also has the native Tasks capability", () => {
    expect(overlay).toContain("mayCreateNativeTasks");
    expect(overlay).toContain("canCreateFollowUp={mayCreateNativeTasks}");
    expect(crmStudio).toContain("follow-up-actions");
    expect(crmStudio).toContain("Create role-owned follow-up");
    expect(crmStudio).toContain("has not been assigned Tasks");
  });

  it("shows a delivery project's commercial origin only when the active role can view Commerce", () => {
    expect(studio).toContain("native-projects-commerce-context");
    expect(studio).toContain("Commercial source");
    expect(studio).toContain("has not been granted Commerce");
    expect(studio).toContain("sourceOpportunityObjectId");
  });

  it("starts the released company client-onboarding process from the linked delivery project without creating a duplicate checklist or provider effect", () => {
    expect(overlay).toContain("processes={operationsStateQuery.data?.processes || []}");
    expect(overlay).toContain('canUseWorkflows={mayOperateNativeWorkflows && allowedSurfaces.has("operations")}');
    expect(studio).toContain('workflowKey === "client-onboarding"');
    expect(studio).toContain('`${root}/workflow-runs`');
    expect(studio).toContain('deliveryProjectObjectId: selectedProject.id');
    expect(studio).toContain('orderObjectId: selectedProjectOrderId');
    expect(studio).toContain("externalEffectsPermitted: false");
    expect(studio).toContain("EOS already has a client-onboarding run for this delivery project");
    expect(studio).toContain("Open governed onboarding run");
    expect(studio).toContain("onOpenOperations");
    expect(overlay).toContain('onOpenOperations={() => goToSurface("operations")}');
  });
});
