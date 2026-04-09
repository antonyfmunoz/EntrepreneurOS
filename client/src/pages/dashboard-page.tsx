import { Layout } from "@/components/layout";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

export default function Dashboard() {
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture("dashboard_page_viewed");
  }, [posthog]);

  return (
    <Layout title="Dashboard">
      <div className="p-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Generated dashboard page — pending completion.
        </p>
      </div>
    </Layout>
  );
}
