import { useUser } from "@clerk/clerk-react";
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
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
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
