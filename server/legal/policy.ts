/**
 * Legal acceptance is a public-product launch control. During internal
 * operator testing, unpublished public terms must not dead-end the owner's
 * workspace; once EOS is a public paid SaaS, the same missing configuration
 * remains fail-closed.
 */
export function legalEnforcementActive(input: {
  requested: boolean;
  configurationReady: boolean;
  publicPaidSaaS: boolean;
}): boolean {
  return input.requested && (input.configurationReady || input.publicPaidSaaS);
}
