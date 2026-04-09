import { Layout } from "@/components/layout";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

export default function AdminDashboard() {
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture("admin_dashboard_page_viewed");
  }, [posthog]);

  return (
    <Layout title="Admin Dashboard">
      <div className="p-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Generated admin dashboard page — pending completion.
        </p>
      </div>
    </Layout>
  );
}
