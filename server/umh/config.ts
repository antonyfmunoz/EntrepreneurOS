export interface FederationConfig {
  enabled: boolean;
  installationId: string;
  issuer: string;
  commandPublicKeyPem: string;
  eventEndpoint: string;
  eventPrivateKeyPem: string;
}

export function federationConfig(): FederationConfig {
  return {
    enabled: process.env.UMH_FEDERATION_ENABLED === "true",
    installationId: process.env.UMH_INSTALLATION_ID?.trim() || "",
    issuer: process.env.UMH_ISSUER?.trim() || "",
    commandPublicKeyPem: (process.env.UMH_COMMAND_PUBLIC_KEY_PEM || "").replace(/\\n/g, "\n"),
    eventEndpoint: process.env.UMH_EVENT_ENDPOINT?.trim() || "",
    eventPrivateKeyPem: (process.env.EOS_EVENT_PRIVATE_KEY_PEM || "").replace(/\\n/g, "\n"),
  };
}

export function outboundFederationConfigured(config = federationConfig()): boolean {
  return federationConfigured(config) && Boolean(config.eventEndpoint && config.eventPrivateKeyPem);
}

export function federationConfigured(config = federationConfig()): boolean {
  return config.enabled && Boolean(config.installationId && config.issuer && config.commandPublicKeyPem);
}
