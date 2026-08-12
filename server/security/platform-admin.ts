export class PlatformAdminError extends Error {
  status = 403;
  code = "platform_admin_required";
}

export function platformAdminIds(): Set<string> {
  return new Set((process.env.EOS_PLATFORM_ADMIN_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
}

export function requirePlatformAdmin(userId: string): void {
  if (!platformAdminIds().has(userId)) throw new PlatformAdminError("Platform operations access is not configured for this principal.");
}
