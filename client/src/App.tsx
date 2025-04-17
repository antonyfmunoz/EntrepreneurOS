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
import AuthPage from "@/pages/auth-page";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/tasks" component={TaskBoardPage} />
      <ProtectedRoute path="/chat/:agentId">
        {(params) => <AgentChat params={params as {agentId: string}} />}
      </ProtectedRoute>
      {/* Legacy route kept for compatibility */}
      <Route path="/agent/:agentId/program">
        {(params) => <AgentProgramming agentId={params.agentId} />}
      </Route>
      {/* New route with query parameter */}
      <ProtectedRoute path="/agent-programming">
        {() => <AgentProgramming />}
      </ProtectedRoute>
      <ProtectedRoute path="/integrations" component={IntegrationsPage} />
      <ProtectedRoute path="/analytics" component={AnalyticsPage} />
      <ProtectedRoute path="/settings" component={() => <div className="p-8"><h1 className="text-2xl font-bold mb-4">Settings</h1><p>Settings page is under construction.</p></div>} />
      <ProtectedRoute path="/notifications" component={() => <div className="p-8"><h1 className="text-2xl font-bold mb-4">Notifications</h1><p>Notification center is under construction.</p></div>} />
      <ProtectedRoute path="/support" component={() => <div className="p-8"><h1 className="text-2xl font-bold mb-4">Support</h1><p>Support page is under construction.</p></div>} />
      <ProtectedRoute path="/tutorials" component={() => <div className="p-8"><h1 className="text-2xl font-bold mb-4">Tutorials</h1><p>Tutorials page is under construction.</p></div>} />
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
