type ClerkEmailAddress = {
  emailAddress: string;
  verification?: { status?: string | null } | null;
};

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
