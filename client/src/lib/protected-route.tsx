import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { Loader2 } from "lucide-react";
import { Route, Redirect } from "wouter";
import { ReactNode } from "react";

type ProtectedRouteProps = {
  path: string;
} & (
  | { component: () => React.JSX.Element; children?: never }
  | { component?: never; children: (params: any) => ReactNode }
);

export function ProtectedRoute(props: ProtectedRouteProps) {
  const { path, component: Component, children } = props;

  const { user, isLoading } = useAuth();
  const { hasCompany, isLoading: companyLoading } = useCompany();

  if (isLoading || companyLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/login" />
      </Route>
    );
  }

  // Logged in but no company: only /company-setup is allowed; block all other app routes
  if (!hasCompany && path !== "/company-setup") {
    return (
      <Route path={path}>
        <Redirect to="/company-setup" />
      </Route>
    );
  }

  // Logged in with company: redirect /company-setup to /portfolios so setup
  // page never mounts for existing users.
  if (hasCompany && path === "/company-setup") {
    return (
      <Route path={path}>
        <Redirect to="/portfolios" />
      </Route>
    );
  }

  if (Component) {
    return <Route path={path} component={Component} />;
  }

  return <Route path={path}>{children}</Route>;
}