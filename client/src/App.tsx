import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import TaskBoardPage from "@/pages/task-board-page";
import AgentChat from "@/pages/agent-chat";
import AgentProgramming from "@/pages/agent-programming";
import IntegrationsPage from "@/pages/integrations-page";
import AnalyticsPage from "@/pages/analytics-page";
import NotificationsPage from "@/pages/notifications-page";
import SettingsPage from "@/pages/settings-page";
import TutorialsPage from "@/pages/tutorials-page";
import SupportPage from "@/pages/support-page";
import CRMPage from "@/pages/crm-page";
import DocumentsPage from "@/pages/documents-page";
import CompanySetupPage from "@/pages/company-setup-page";

import AuthPage from "@/pages/auth-page";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { CompanyGate } from "@/lib/company-guard";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/home">
        {() => (
          <CompanyGate>
            <Dashboard />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/tasks">
        {() => (
          <CompanyGate>
            <TaskBoardPage />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/company-setup" component={CompanySetupPage} />

      <ProtectedRoute path="/chat/:agentId">
        {(params) => (
          <CompanyGate>
            <AgentChat params={params as { agentId: string }} />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/agent-chat/:agentId">
        {(params) => (
          <CompanyGate>
            <AgentChat params={params as { agentId: string }} />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/agent/:agentId/program">
        {(params) => (
          <CompanyGate>
            <AgentProgramming agentId={params.agentId} />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/agent-programming/:agentId">
        {(params) => (
          <CompanyGate>
            <AgentProgramming agentId={params.agentId} />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/agent-programming">
        {() => (
          <CompanyGate>
            <AgentProgramming />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/integrations">
        {() => (
          <CompanyGate>
            <IntegrationsPage />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/analytics">
        {() => (
          <CompanyGate>
            <AnalyticsPage />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/crm">
        {() => (
          <CompanyGate>
            <CRMPage />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/documents">
        {() => (
          <CompanyGate>
            <DocumentsPage />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/settings">
        {() => (
          <CompanyGate>
            <SettingsPage />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/notifications">
        {() => (
          <CompanyGate>
            <NotificationsPage />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/support">
        {() => (
          <CompanyGate>
            <SupportPage />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <ProtectedRoute path="/tutorials">
        {() => (
          <CompanyGate>
            <TutorialsPage />
          </CompanyGate>
        )}
      </ProtectedRoute>

      <Route path="/auth" component={AuthPage} />

      <Route component={NotFound} />

    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
