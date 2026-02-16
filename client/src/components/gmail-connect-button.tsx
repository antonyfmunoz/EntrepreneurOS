import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, Loader2, Unplug } from "lucide-react";

export function GmailConnectButton() {
  const { toast } = useToast();

  const { data: gmailStatus, isLoading } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/integrations/gmail/status"],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/gmail/auth");
      const data = await res.json();
      return data.authUrl;
    },
    onSuccess: (authUrl: string) => {
      const popup = window.open(authUrl, 'gmail-oauth', 'width=600,height=700,scrollbars=yes');
      const checkInterval = setInterval(() => {
        try {
          if (popup?.closed) {
            clearInterval(checkInterval);
            queryClient.invalidateQueries({ queryKey: ["/api/integrations/gmail/status"] });
          }
        } catch (e) {
          // ignore cross-origin errors
        }
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Could not start Gmail connection. Make sure Google OAuth credentials are configured.",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/integrations/gmail/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/gmail/status"] });
      toast({ title: "Gmail Disconnected", description: "Your Gmail account has been disconnected." });
    },
  });

  const connected = gmailStatus?.connected || false;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${connected ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Mail className={`h-5 w-5 ${connected ? 'text-green-600' : 'text-gray-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Gmail</h3>
              {connected && (
                <Badge variant="outline" className="text-green-700 border-green-300 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {connected ? "Agents can send emails on your behalf" : "Connect Gmail to enable email actions"}
            </p>
          </div>
        </div>
        <div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : connected ? (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              <Unplug className="h-3.5 w-3.5 mr-1" />
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Mail className="h-3.5 w-3.5 mr-1" />
              )}
              Connect Gmail
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
