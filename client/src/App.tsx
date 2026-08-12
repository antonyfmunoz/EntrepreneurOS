import { Switch, Route, Redirect } from "wouter";
import { queryClient, setTokenGetter } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { KeyRound } from "lucide-react";
import { FullPageStatus } from "@/components/full-page-status";

import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { CompanyGate } from "@/lib/company-guard";
import { ClerkLoaded, ClerkLoading, useUser, useAuth } from "@clerk/clerk-react";

import { ClerkProviderWrapper, isClerkConfigured } from "@/lib/clerk";
import { BuildStatusOverlay } from "@/components/BuildStatusOverlay";

import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { captureProductEvent, configureProductAnalytics } from "@/lib/posthog";
import { productEvents } from "@shared/product-analytics";

const Login = lazy(() => import("@/pages/login-page"));
const Signup = lazy(() => import("@/pages/signup-page"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password-page"));
const ResetPassword = lazy(() => import("@/pages/reset-password-page"));
const SettingsPage = lazy(() => import("@/pages/settings-page"));
const CompanySetupPage = lazy(() => import("@/pages/company-setup-page"));
const SupportPage = lazy(() => import("@/pages/support-page"));
const LegalAcceptancePage = lazy(() => import("@/pages/legal-acceptance-page"));
const PortfolioList = lazy(() => import("@/pages/portfolio-list-page"));
const PortfolioDetail = lazy(() => import("@/pages/portfolio-detail-page"));
const EosOverlayPage = lazy(() => import("@/pages/eos-overlay-page"));
const AgentChatPage = lazy(() => import("@/pages/agent-chat-page"));
const Workflows = lazy(() => import("@/pages/workflows-page"));
const NotFoundPage = lazy(() => import("@/pages/not-found-page"));
const OrgChartPage = lazy(() => import("@/pages/org-chart-page"));
const TaskBoard = lazy(() => import("@/pages/task-board-page-new"));

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
    captureProductEvent(productEvents.pageViewed, { path: location });
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
      <ProtectedRoute path="/legal/accept" component={LegalAcceptancePage} />

      <ProtectedRoute path="/settings" component={SettingsPage} />

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
              <AnalyticsConsentBridge />
              <Suspense fallback={<FullPageStatus title="Loading your workspace" description="Preparing the selected EntrepreneurOS surface." />}>
                <Router />
              </Suspense>
              <Toaster />
            </AuthProvider>
            <BuildStatusOverlay />
          </QueryClientProvider>
        </ClerkTokenProvider>
      </ClerkLoaded>
    </ClerkProviderWrapper>
  );
}

function AnalyticsConsentBridge() {
  const { isSignedIn } = useUser();
  const consent = useQuery<{ consent: boolean | null }>({ queryKey: ["/api/users/me/analytics-consent"], enabled: Boolean(isSignedIn) });
  useEffect(() => { configureProductAnalytics(consent.data?.consent === true); }, [consent.data?.consent]);
  return null;
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
