import { Switch, Route, Redirect } from "wouter";
import { queryClient, setTokenGetter } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";
import SettingsPage from "@/pages/settings-page";
import CompanySetupPage from "@/pages/company-setup-page";

import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { CompanyGate } from "@/lib/company-guard";
import { useUser, useAuth } from "@clerk/clerk-react";
import Login from "@/pages/login-page";
import Signup from "@/pages/signup-page";
import ForgotPassword from "@/pages/forgot-password-page";
import ResetPassword from "@/pages/reset-password-page";

import { ClerkProviderWrapper } from "@/lib/clerk";
import PortfolioList from "@/pages/portfolio-list-page";
import PortfolioDetail from "@/pages/portfolio-detail-page";
import CommandCenter from "@/pages/command-center-page";
import AgentChatPage from "@/pages/agent-chat-page";
import Workflows from "@/pages/workflows-page";
import NotFoundPage from "@/pages/not-found-page";
import OrgChartPage from "@/pages/org-chart-page";
import TaskBoard from "@/pages/task-board-page-new";
import { BuildStatusOverlay } from "@/components/BuildStatusOverlay";

import { useEffect } from "react";
import { useLocation } from "wouter";
import posthog from "@/lib/posthog";

function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);
  return <>{children}</>;
}

function RootRedirect() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
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

      <ProtectedRoute path="/settings">
        {() => (
          <CompanyGate>
            <SettingsPage />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/portfolios">
        {() => (
          <CompanyGate>
            <PortfolioList />
          </CompanyGate>
        )}
      </ProtectedRoute>
      <ProtectedRoute path="/portfolios/:portfolioId">
        {() => (
          <CompanyGate>
            <PortfolioDetail />
          </CompanyGate>
        )}
      </ProtectedRoute>
      <ProtectedRoute path="/company/:companyId">
        {(params) => (
          <CompanyGate>
            <CommandCenter params={params as { companyId: string }} />
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
  return (
    <ClerkProviderWrapper>
      <ClerkTokenProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
          <BuildStatusOverlay />
        </QueryClientProvider>
      </ClerkTokenProvider>
    </ClerkProviderWrapper>
  );
}

export default App;
