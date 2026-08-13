import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.EOS_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("OAuth token tenant storage", () => {
  const ownerId = "oauth_storage_owner";
  const otherId = "oauth_storage_other";
  const sql = postgres(databaseUrl || "postgresql://invalid", { max: 1 });
  let storage: typeof import("../../server/storage").storage;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    ({ storage } = await import("../../server/storage"));
    await sql`DELETE FROM oauth_tokens WHERE user_id IN (${ownerId}, ${otherId})`;
    await sql`DELETE FROM users WHERE id IN (${ownerId}, ${otherId})`;
    await sql`INSERT INTO users (id, username, password, email) VALUES
      (${ownerId}, 'oauth_storage_owner', 'not-used', 'oauth-owner@example.test'),
      (${otherId}, 'oauth_storage_other', 'not-used', 'oauth-other@example.test')`;
  });

  afterAll(async () => {
    await sql`DELETE FROM oauth_tokens WHERE user_id IN (${ownerId}, ${otherId})`;
    await sql`DELETE FROM users WHERE id IN (${ownerId}, ${otherId})`;
    await sql.end({ timeout: 5 });
  });

  it("atomically maintains one credential per user and provider under concurrent callbacks", async () => {
    await Promise.all(Array.from({ length: 8 }, (_, index) => storage.upsertOauthToken({
      userId: ownerId,
      provider: "notion",
      accessToken: `encrypted-owner-token-${index}`,
      refreshToken: `encrypted-owner-refresh-${index}`,
      metadata: { workspaceId: "owner-workspace", callback: index },
    })));
    await storage.upsertOauthToken({
      userId: otherId,
      provider: "notion",
      accessToken: "encrypted-other-token",
      metadata: { workspaceId: "other-workspace" },
    });

    const counts = await sql<{ user_id: string; count: number }[]>`
      SELECT user_id, count(*)::int AS count
      FROM oauth_tokens
      WHERE user_id IN (${ownerId}, ${otherId}) AND provider = 'notion'
      GROUP BY user_id
      ORDER BY user_id`;
    expect(counts).toEqual([
      { user_id: otherId, count: 1 },
      { user_id: ownerId, count: 1 },
    ]);
    const owner = await storage.getOauthToken(ownerId, "notion");
    const other = await storage.getOauthToken(otherId, "notion");
    expect(owner?.metadata).toMatchObject({ workspaceId: "owner-workspace" });
    expect(other?.metadata).toEqual({ workspaceId: "other-workspace" });
    expect(owner?.accessToken).not.toBe(other?.accessToken);
  });

  it("preserves an existing refresh token when a provider callback omits a replacement", async () => {
    await storage.upsertOauthToken({
      userId: ownerId,
      provider: "gmail",
      accessToken: "encrypted-access-one",
      refreshToken: "encrypted-refresh-one",
    });
    await storage.upsertOauthToken({
      userId: ownerId,
      provider: "gmail",
      accessToken: "encrypted-access-two",
    });
    const stored = await storage.getOauthToken(ownerId, "gmail");
    expect(stored?.accessToken).toBe("encrypted-access-two");
    expect(stored?.refreshToken).toBe("encrypted-refresh-one");
  });
});
