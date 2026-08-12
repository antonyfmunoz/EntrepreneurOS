import { Switch, Route, Redirect } from "wouter";
import { queryClient, setTokenGetter } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { KeyRound } from "lucide-react";
import { FullPageStatus } from "@/components/full-page-status";
import SettingsPage from "@/pages/settings-page";
import CompanySetupPage from "@/pages/company-setup-page";

import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { CompanyGate } from "@/lib/company-guard";
import { ClerkLoaded, ClerkLoading, useUser, useAuth } from "@clerk/clerk-react";
import Login from "@/pages/login-page";
import Signup from "@/pages/signup-page";
import ForgotPassword from "@/pages/forgot-password-page";
import ResetPassword from "@/pages/reset-password-page";
import SupportPage from "@/pages/support-page";

import { ClerkProviderWrapper, isClerkConfigured } from "@/lib/clerk";
import PortfolioList from "@/pages/portfolio-list-page";
import PortfolioDetail from "@/pages/portfolio-detail-page";
import EosOverlayPage from "@/pages/eos-overlay-page";
import AgentChatPage from "@/pages/agent-chat-page";
import Workflows from "@/pages/workflows-page";
import NotFoundPage from "@/pages/not-found-page";
import OrgChartPage from "@/pages/org-chart-page";
import TaskBoard from "@/pages/task-board-page-new";
import { BuildStatusOverlay } from "@/components/BuildStatusOverlay";

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import posthog from "@/lib/posthog";

function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [isTokenTransportReady, setIsTokenTransportReady] = useState(false);

  useEffect(() => {
    setTokenGetter(getToken);
    setIsTokenTransportReady(true);

    return () => {
      setTokenGetter(null);
      setIsTokenTransportReady(false);
    };
  }, [getToken]);

  if (!isTokenTransportReady) {
    return <FullPageStatus title="Preparing your secure workspace" description="Connecting your signed-in session to the EntrepreneurOS data service." />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <FullPageStatus title="Starting your secure workspace" description="Confirming your identity and loading the EntrepreneurOS operating context." />;
  }

  if (!isSignedIn) return <Redirect to="/login" />;
  return <Redirect to="/portfolios" />;
}

function usePageView() {
  const [location] = useLocation();
  useEffect(() => {
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [location]);
}

function Router() {
  usePageView();
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />

      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      <ProtectedRoute path="/company-setup" component={CompanySetupPage} />
      <ProtectedRoute path="/support" component={SupportPage} />

      <ProtectedRoute path="/settings">
        {() => (
          <CompanyGate>
            <SettingsPage />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/portfolios">
        {() => <PortfolioList />}
      </ProtectedRoute>
      <ProtectedRoute path="/portfolios/:portfolioId">
        {() => <PortfolioDetail />}
      </ProtectedRoute>
      <ProtectedRoute path="/company/:companyId">
        {() => (
          <CompanyGate>
            <EosOverlayPage />
          </CompanyGate>
        )}
      </ProtectedRoute>
      <ProtectedRoute path="/company/:companyId/org">
        {() => (
          <CompanyGate>
            <OrgChartPage />
          </CompanyGate>
        )}
      </ProtectedRoute>
      <ProtectedRoute path="/company/:companyId/chat">
        {() => (
          <CompanyGate>
            <AgentChatPage />
          </CompanyGate>
        )}
      </ProtectedRoute>
      <ProtectedRoute path="/company/:companyId/workflows">
        {() => (
          <CompanyGate>
            <Workflows />
          </CompanyGate>
        )}
      </ProtectedRoute>
      <ProtectedRoute path="/company/:companyId/tasks">
        {() => (
          <CompanyGate>
            <TaskBoard />
          </CompanyGate>
        )}
      </ProtectedRoute>

      {/* Catch-all must stay LAST inside the Switch — wouter matches in order. */}
      <ProtectedRoute path="/*" component={NotFoundPage} />
    </Switch>
  );
}

function App() {
  if (!isClerkConfigured()) {
    return <AuthenticationConfigurationRequired />;
  }

  return (
    <ClerkProviderWrapper>
      <ClerkLoading>
        <FullPageStatus title="Starting your secure workspace" description="Connecting to the identity service before EntrepreneurOS loads protected organization data." />
      </ClerkLoading>
      <ClerkLoaded>
        <ClerkTokenProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <Router />
              <Toaster />
            </AuthProvider>
            <BuildStatusOverlay />
          </QueryClientProvider>
        </ClerkTokenProvider>
      </ClerkLoaded>
    </ClerkProviderWrapper>
  );
}

function AuthenticationConfigurationRequired() {
  return (
    <main className="min-h-screen bg-surface px-6 py-12 text-foreground sm:px-10">
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-center">
        <div className="w-full rounded-2xl bg-white p-8 shadow-md sm:p-12" role="alert">
          <span className="mb-8 grid h-12 w-12 place-items-center rounded-xl bg-primary-muted text-primary">
            <KeyRound className="h-6 w-6" />
          </span>
          <p className="eos-label mb-3">EntrepreneurOS configuration</p>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Authentication setup required</h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            This environment does not have a Clerk publishable key. EntrepreneurOS has stopped before loading protected company data instead of bypassing authentication.
          </p>
          <div className="mt-8 rounded-xl bg-muted p-5">
            <p className="eos-label mb-2">Required client variable</p>
            <code className="break-all text-sm font-medium text-foreground">VITE_CLERK_PUBLISHABLE_KEY</code>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Add the key to the environment used to build or run the client, then restart EntrepreneurOS.
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;
