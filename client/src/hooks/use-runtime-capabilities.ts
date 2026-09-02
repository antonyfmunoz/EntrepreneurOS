import { useQuery } from "@tanstack/react-query";

type RuntimeCapabilities = {
  artifactIngressMode: "trusted_source" | "scanner_backed" | "unsafe";
  untrustedUploadsEnabled: boolean;
  signatureMethods: Array<"typed" | "drawn" | "uploaded">;
};

const unavailable: RuntimeCapabilities = {
  artifactIngressMode: "unsafe",
  untrustedUploadsEnabled: false,
  signatureMethods: ["typed"],
};

export function useRuntimeCapabilities(): RuntimeCapabilities {
  const query = useQuery<RuntimeCapabilities>({
    queryKey: ["/api/runtime-capabilities"],
    queryFn: async () => {
      const response = await fetch("/api/runtime-capabilities", {
        cache: "no-store",
        credentials: "omit",
      });
      if (!response.ok) throw new Error("Runtime capabilities unavailable");
      const payload = await response.json();
      if (payload.artifactIngressMode !== "scanner_backed" || payload.untrustedUploadsEnabled !== true)
        return { ...unavailable, artifactIngressMode: payload.artifactIngressMode === "trusted_source" ? "trusted_source" : "unsafe" };
      return { artifactIngressMode: "scanner_backed", untrustedUploadsEnabled: true, signatureMethods: ["typed", "drawn", "uploaded"] };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return query.isError ? unavailable : query.data || unavailable;
}
