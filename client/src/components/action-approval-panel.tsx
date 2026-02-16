import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, FileText, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type AgentAction = {
  id: string;
  agentId: string;
  actionType: string;
  actionName: string;
  description: string;
  parameters: Record<string, any>;
  status: string;
  estimatedTimeSaved: number;
  createdAt: string;
};

const actionIcons: Record<string, any> = {
  send_email: Mail,
  create_document: FileText,
};

export function ActionApprovalPanel() {
  const { toast } = useToast();

  const { data: pendingActions = [], isLoading } = useQuery<AgentAction[]>({
    queryKey: ["/api/actions/pending"],
    refetchInterval: 10000,
  });

  const approveMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/approve`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      toast({
        title: "Action Executed",
        description: data.executionResult?.success
          ? "The action was completed successfully."
          : `Action failed: ${data.executionResult?.error}`,
        variant: data.executionResult?.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      toast({ title: "Action Rejected", description: "The action has been rejected." });
    },
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading pending actions...</span>
        </div>
      </Card>
    );
  }

  if (pendingActions.length === 0) return null;

  return (
    <Card className="p-4 mb-6 border-amber-200 bg-amber-50/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" />
          Pending Actions ({pendingActions.length})
        </h3>
        <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">
          Requires Approval
        </Badge>
      </div>

      <div className="space-y-3">
        {pendingActions.map((action) => {
          const IconComponent = actionIcons[action.actionType] || FileText;
          const isPending = approveMutation.isPending || rejectMutation.isPending;

          return (
            <div key={action.id} className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 flex-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <IconComponent className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{action.actionName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
                    {action.actionType === 'send_email' && action.parameters && (
                      <div className="mt-1.5 text-xs text-gray-600 space-y-0.5">
                        <p><span className="font-medium">To:</span> {action.parameters.to}</p>
                        <p><span className="font-medium">Subject:</span> {action.parameters.subject}</p>
                      </div>
                    )}
                    {action.estimatedTimeSaved > 0 && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Saves ~{action.estimatedTimeSaved} min
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => rejectMutation.mutate(action.id)}
                    disabled={isPending}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => approveMutation.mutate(action.id)}
                    disabled={isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
