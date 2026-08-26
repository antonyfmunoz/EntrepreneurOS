import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../../client/src/components/production-readiness-action-queue.tsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../../server/routes/operations.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../migrations/0110_add_operational_readiness_actions.sql", import.meta.url), "utf8");

describe("production readiness action queue contract", () => {
  it("does not expose a narrative completed or passed operator state", () => {
    expect(component).toContain('type OperatorState = "unassigned" | "planned" | "in_progress" | "waiting_external"');
    expect(routes).toContain('z.enum(["unassigned", "planned", "in_progress", "waiting_external"])');
    expect(migration).not.toMatch(/operator_state[^\n]+(?:complete|passed|resolved)/i);
    expect(component).toContain("An action state never passes a readiness control");
  });

  it("requires platform administration, optimistic versions, and attributable ownership", () => {
    expect(routes).toMatch(/app\.put\("\/api\/platform\/readiness\/actions\/:blockerKey"[\s\S]*?requirePlatformAdmin/);
    expect(routes).toContain("readiness_action_version_conflict");
    expect(routes).toContain("readiness_action_owner_not_platform_admin");
    expect(routes).toContain("waiting_external");
  });

  it("retains an immutable event ledger separate from the current projection", () => {
    expect(migration).toContain("operational_readiness_action_event_immutable_guard");
    expect(migration).toContain("operational readiness action events are immutable");
    expect(migration).toContain("UNIQUE (blocker_key, action_version)");
  });
});
