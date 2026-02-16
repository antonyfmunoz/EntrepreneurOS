import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Zap, Clock, MessageSquare, Loader2 } from "lucide-react";

type MetricsSummary = {
  totalTasksCompleted: number;
  totalActionsExecuted: number;
  totalMessagesSent: number;
  totalTimeSavedMinutes: number;
  totalApiCost: number;
};

export function AgentMetrics({ agentId }: { agentId: string }) {
  const { data: metrics, isLoading } = useQuery<MetricsSummary>({
    queryKey: ["/api/agents", agentId, "metrics"],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/metrics`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
    enabled: !!agentId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading metrics...
      </div>
    );
  }

  if (!metrics) return null;

  const items = [
    {
      label: "Tasks Done",
      value: metrics.totalTasksCompleted,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Actions Run",
      value: metrics.totalActionsExecuted,
      icon: Zap,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Time Saved",
      value: `${metrics.totalTimeSavedMinutes}m`,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Messages",
      value: metrics.totalMessagesSent,
      icon: MessageSquare,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  const hasData = items.some(item => {
    const val = typeof item.value === 'string' ? parseInt(item.value) : item.value;
    return val > 0;
  });

  if (!hasData) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="p-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full ${item.bg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none">{item.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
