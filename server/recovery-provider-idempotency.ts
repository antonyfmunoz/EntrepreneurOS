import { createHash } from "node:crypto";
import { RECOVERY_PROVIDER_EXECUTION_VERSION } from "@shared/recovery-provider-executions";

export function recoveryProviderIdempotencyKey(input: {
  companyId: number;
  operation: string;
  targetId: string;
  targetVersion: number;
  option?: string;
}): string {
  const digest = createHash("sha256")
    .update(
      [
        RECOVERY_PROVIDER_EXECUTION_VERSION,
        input.companyId,
        input.operation,
        input.targetId,
        input.targetVersion,
        input.option || "",
      ].join(":"),
    )
    .digest("hex");
  return `eos-recovery-${digest}`;
}
