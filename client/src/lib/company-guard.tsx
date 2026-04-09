import { Redirect } from "wouter";
import { useCompany } from "@/hooks/use-company";

export function CompanyGate({ children }: { children: React.ReactNode }) {
  const { hasCompany, isLoading } = useCompany();

  if (isLoading) {
    return null;
  }

  if (!hasCompany) {
    return <Redirect to="/company-setup" />;
  }

  return <>{children}</>;
}