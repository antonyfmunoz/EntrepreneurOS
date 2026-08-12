import { useUser } from "@clerk/clerk-react";
import { Route, Redirect } from "wouter";
import { ReactNode } from "react";
import { FullPageStatus } from "@/components/full-page-status";

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
    return <Route path={path} component={Component} />;
  }

  return <Route path={path}>{children}</Route>;
}
