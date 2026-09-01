import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, idle_timeout: 5 });
try {
  const rows = await sql<{
    companyId: number;
    companyName: string;
    bindingId: string;
    providerAccountReference: string;
    lifecycleState: string;
    connectionState: string;
    healthState: string;
    parityState: string;
    credentialReferencePresent: boolean;
  }[]>`
    SELECT
      c.id AS "companyId",
      c.name AS "companyName",
      b.id AS "bindingId",
      b.provider_account_reference AS "providerAccountReference",
      b.lifecycle_state AS "lifecycleState",
      b.connection_state AS "connectionState",
      b.health_state AS "healthState",
      b.parity_state AS "parityState",
      (b.credential_reference IS NOT NULL AND length(trim(b.credential_reference)) > 0) AS "credentialReferencePresent"
    FROM eos_integration_bindings b
    JOIN companies c ON c.id = b.company_id
    WHERE b.provider_key = 'stripe'
    ORDER BY c.id, b.created_at
  `;
  console.log(JSON.stringify({
    inspectedAt: new Date().toISOString(),
    credentialValuesIncluded: false,
    bindingCount: rows.length,
    bindings: rows,
  }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
