import { useQuery, useMutation } from "@tanstack/react-query";
import { Notification } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useNotifications() {
  const { toast } = useToast();

  // Fetch all notifications
  const {
    data: notifications = [],
    isLoading,
    error,
    refetch
  } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Get unread notification count
  const {
    data: unreadCount = { count: 0 },
    isLoading: isCountLoading,
    refetch: refetchCount
  } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/count"],
    staleTime: 1000 * 60, // 1 minute
  });

  // Mark a notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/notifications/${id}/read`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to mark notification as read",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/read-all");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to mark all notifications as read",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete a notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("API request to delete notification:", id);
      const res = await apiRequest("DELETE", `/api/notifications/${id}`);
      const result = await res.json();
      console.log("Delete API response:", result);
      return result;
    },
    onSuccess: () => {
      console.log("Successfully deleted notification");
      // Directly trigger refetch instead of just invalidating queries
      refetch();
      refetchCount();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
    onError: (error) => {
      console.error("Error deleting notification:", error);
      toast({
        title: "Failed to delete notification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const refresh = () => {
    refetch();
    refetchCount();
  };

  return {
    notifications,
    unreadCount: unreadCount.count,
    isLoading: isLoading || isCountLoading,
    error,
    markAsRead: (id: string) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    deleteNotification: (id: string) => deleteNotificationMutation.mutate(id),
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    isDeletingNotification: deleteNotificationMutation.isPending,
    refresh
  };
}