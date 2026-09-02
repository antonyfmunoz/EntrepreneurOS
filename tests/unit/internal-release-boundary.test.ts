import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("internal release boundary wiring", () => {
  it("uses deployment safety only for deployment and the runtime probe", () => {
    expect(source("scripts/verify-release-env.ts")).toContain("...productionDeploymentConfiguration()");
    expect(source("server/index.ts")).toContain("? productionDeploymentConfigurationIssues()");
    expect(source("server/index.ts")).toContain('readinessScope: "runtime"');
    expect(source("server/operations/readiness.ts")).toContain("const configurationMissing = productionRuntimeConfigurationIssues()");
    expect(source("scripts/production-external-inventory.ts")).toContain("operatingCompanyPaymentsLive: operatingCompanyPaymentsConfigured(");
  });

  it("retains independent qualification, evidence, approval, migration and smoke gates", () => {
    const deploy = source("scripts/deploy-fly.ps1");
    for (const boundary of ["--event push --commit $releaseCommit", "EOS_SECRET_CUTOVER_APPROVAL", "npm run release:evidence:verify",
      "npm run release:verify", "npm run db:migrate", "npm run db:migrations:verify", "npm run test:e2e:production",
      "npm run test:e2e:production:authenticated", "Set-FreshProductionBearerToken", "$rollbackImage"])
      expect(deploy).toContain(boundary);
    const template = source(".env.production.op.tpl");
    expect(template).toContain("EOS_PUBLIC_PAID_SAAS=false");
    expect(template).toContain("EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED=false");
  });
});
