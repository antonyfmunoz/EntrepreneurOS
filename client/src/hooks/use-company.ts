import { useQuery } from "@tanstack/react-query";
import type { Company } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export function useCompany() {
  const { data, isLoading } = useQuery<Company | null, Error>({
    queryKey: ["/api/company"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/company");
        return (await res.json()) as Company;
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("404:")) {
          return null;
        }
        throw err;
      }
    },
  });

  const company = data ?? null;

  return {
    company,
    hasCompany: company !== null,
    isLoading,
  };
}

