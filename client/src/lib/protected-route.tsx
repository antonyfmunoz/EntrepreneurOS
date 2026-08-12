import { useUser } from "@clerk/clerk-react";
import { Route, Redirect } from "wouter";
import { ReactNode } from "react";
import { FullPageStatus } from "@/components/full-page-status";
import { useQuery } from "@tanstack/react-query";

type LegalStatus = { enforcement: boolean; configurationReady: boolean; missing: unknown[] };

function LegalGate({ path, children }: { path: string; children: ReactNode }) {
  const status = useQuery<LegalStatus>({ queryKey: ["/api/legal/status"] });
  if (path === "/legal/accept") return <>{children}</>;
  if (status.isLoading) return <FullPageStatus title="Checking current agreements" description="Confirming the legal versions attached to your account." />;
  if (status.data?.enforcement && (!status.data.configurationReady || status.data.missing.length > 0)) return <Redirect to="/legal/accept" />;
  return <>{children}</>;
}

type ProtectedRouteProps = {
  path: string;
} & (
  | { component: () => React.JSX.Element; children?: never }
  | { component?: never; children: (params: any) => ReactNode }
);

export function ProtectedRoute(props: ProtectedRouteProps) {
  const { path, component: Component, children } = props;
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <Route path={path}>
        <FullPageStatus title="Starting your secure workspace" description="Confirming your identity before protected organization data is loaded." />
      </Route>
    );
  }

  if (!isSignedIn) {
    return (
      <Route path={path}>
        <Redirect to="/login" />
      </Route>
    );
  }

  if (Component) {
    return <Route path={path}><LegalGate path={path}><Component /></LegalGate></Route>;
  }

  return <Route path={path}>{(params) => <LegalGate path={path}>{children(params)}</LegalGate>}</Route>;
}
