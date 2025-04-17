import React from "react";
import { Notification } from "@shared/schema";
import { useNotifications } from "@/hooks/use-notifications";
import { Bell, Check, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuFooter,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { format } from "date-fns";

export const NotificationDropdown = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    isMarkingAllAsRead,
  } = useNotifications();

  const handleMarkAsRead = (
    e: React.MouseEvent<HTMLButtonElement>,
    notificationId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    markAsRead(notificationId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => markAllAsRead()}
              disabled={isMarkingAllAsRead}
            >
              <Check className="mr-1 h-3 w-3" />
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground flex flex-col items-center gap-2">
              <BellOff className="h-12 w-12 mb-2 opacity-20" />
              <span>No notifications yet</span>
              <span className="text-sm opacity-70">
                We'll notify you when something happens
              </span>
            </div>
          ) : (
            <DropdownMenuGroup>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                />
              ))}
            </DropdownMenuGroup>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (
    e: React.MouseEvent<HTMLButtonElement>,
    id: string
  ) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
}) => {
  const href = notification.href || "#";
  const formattedDate = notification.createdAt
    ? format(new Date(notification.createdAt), "MMM d, h:mm a")
    : "";

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "integration-connected":
        return "ri-link-m";
      case "task-assigned":
        return "ri-task-line";
      case "agent-created":
        return "ri-robot-line";
      case "message-received":
        return "ri-message-3-line";
      default:
        return "ri-notification-4-line";
    }
  };

  return (
    <DropdownMenuItem
      asChild
      className={cn(
        "flex flex-col items-start p-3 cursor-pointer",
        !notification.read && "bg-accent/50"
      )}
    >
      <Link href={href}>
        <div className="flex items-start gap-3 w-full">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              !notification.read ? "bg-primary/10" : "bg-muted"
            )}
          >
            <i
              className={cn(
                getNotificationIcon(notification.type),
                !notification.read ? "text-primary" : "text-muted-foreground"
              )}
            ></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <h4
                className={cn(
                  "font-medium text-sm line-clamp-1",
                  !notification.read && "font-semibold"
                )}
              >
                {notification.title}
              </h4>
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 ml-2 -mr-1 rounded-full"
                  onClick={(e) => onMarkAsRead(e, notification.id)}
                >
                  <Check className="h-3 w-3" />
                  <span className="sr-only">Mark as read</span>
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
              {notification.content}
            </p>
            <span className="text-xs text-muted-foreground mt-1 block">
              {formattedDate}
            </span>
          </div>
        </div>
      </Link>
    </DropdownMenuItem>
  );
};