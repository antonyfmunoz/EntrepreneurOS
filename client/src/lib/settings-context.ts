export type SettingsCompany = { id: number };

export function resolveSettingsCompanyId(
  requestedId: string | number | null | undefined,
  companies: SettingsCompany[],
): number | null {
  const parsed = typeof requestedId === "number" ? requestedId : Number(requestedId);
  if (Number.isInteger(parsed) && companies.some((company) => company.id === parsed)) return parsed;
  return companies.length === 1 ? companies[0].id : null;
}

export function settingsCompanyUrl(companyId: number | null): string {
  return companyId ? `/settings?companyId=${companyId}` : "/settings";
}
