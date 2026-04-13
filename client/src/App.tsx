import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";
import SettingsPage from "@/pages/settings-page";
import CompanySetupPage from "@/pages/company-setup-page";

import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { ProtectedRoute } from "@/lib/protected-route";
import { CompanyGate } from "@/lib/company-guard";
import Login from "@/pages/login-page";
import Signup from "@/pages/signup-page";
import ForgotPassword from "@/pages/forgot-password-page";
import ResetPassword from "@/pages/reset-password-page";

import { ClerkProvider } from "@clerk/clerk-react";
import PortfolioList from "@/pages/portfolio-list-page";
import PortfolioDetail from "@/pages/portfolio-detail-page";
import CommandCenter from "@/pages/command-center-page";
import AgentChatPage from "@/pages/agent-chat-page";
import Workflows from "@/pages/workflows-page";
import NotFoundPage from "@/pages/not-found-page";
import OrgChartPage from "@/pages/org-chart-page";
import TaskBoard from "@/pages/task-board-page-new";

function RootRedirect() {
  const { user, isLoading } = useAuth();
  const { hasCompany, isLoading: companyLoading } = useCompany();

  if (isLoading || companyLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (!hasCompany) return <Redirect to="/company-setup" />;
  return <Redirect to="/portfolios" />;
}

function Router() {
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

function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    return <>{children}</>;
  }
  return <ClerkProvider publishableKey={key}>{children}</ClerkProvider>;
}

function App() {
  return (
    <ClerkProviderWrapper>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ClerkProviderWrapper>
  );
}

export default App;
