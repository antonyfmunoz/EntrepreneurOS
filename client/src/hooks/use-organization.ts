import { useOrganization, useOrganizationList } from "@clerk/clerk-react";

export function useActiveOrg() {
  const { organization, isLoaded } = useOrganization();
  const { userMemberships } = useOrganizationList({ userMemberships: true });

  return {
    orgId: organization?.id ?? null,
    orgName: organization?.name ?? null,
    orgSlug: organization?.slug ?? null,
    isLoaded,
    hasOrg: !!organization,
    memberships: userMemberships?.data ?? [],
  };
}
