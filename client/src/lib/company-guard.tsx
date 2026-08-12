import { Redirect } from "wouter";
import { useCompany } from "@/hooks/use-company";
import { FullPageStatus } from "@/components/full-page-status";

export function CompanyGate({ children }: { children: React.ReactNode }) {
  const { hasCompany, isLoading } = useCompany();

  if (isLoading) {
    return <FullPageStatus label="Organization context" title="Loading your workspace" description="Resolving your portfolio, organization, and operating authority." />;
  }

  if (!hasCompany) {
    return <Redirect to="/company-setup" />;
  }

  return <>{children}</>;
}
