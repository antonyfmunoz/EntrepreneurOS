type ClerkEmailAddress = {
  id?: string;
  emailAddress: string;
  verification?: { status?: string | null } | null;
};

export function primaryVerifiedEmail(
  primaryEmailAddressId: string | null | undefined,
  emailAddresses: ClerkEmailAddress[],
): string | undefined {
  const verified = emailAddresses.filter((address) => address.verification?.status === "verified");
  const selected = verified.find((address) => address.id === primaryEmailAddressId) || verified[0];
  return selected?.emailAddress.trim().toLowerCase();
}

export function verifiedEmailForLegacyClaim(
  localEmail: string,
  emailAddresses: ClerkEmailAddress[],
): string | undefined {
  const normalizedLocalEmail = localEmail.trim().toLowerCase();

  return emailAddresses.find(
    (address) =>
      address.emailAddress.trim().toLowerCase() === normalizedLocalEmail &&
      address.verification?.status === "verified",
  )?.emailAddress;
}
