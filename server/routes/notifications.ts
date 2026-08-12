import { Express } from "express";
import { storage } from "../storage";

export function registerNotificationRoutes(app: Express): void {
  app.get("/api/notifications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if there are any notifications for this user
      const existingNotifications = await storage.getNotifications(req.user.id);

      // Only create a welcome notification if this is the very first time
      // the user is visiting the site and has no notifications.
      // We'll add a special filter to avoid adding welcome notifications repeatedly
      const hasWelcomeNotification = existingNotifications.some(n =>
        n.type === "system" && n.title === "Welcome to EntrepreneurOS"
      );

      const user = await storage.getUser(req.user.id);
      // Safely check metadata which might be undefined or null
      const userMetadata = (user?.metadata as Record<string, any>) || {};
      const hasSeenWelcome = userMetadata.hasSeenWelcome === true;

      // Only show welcome notification if:
      // 1. User has no existing welcome notification
      // 2. User has no flag indicating they've seen the welcome before
      if (existingNotifications.length === 0 && !hasWelcomeNotification && !hasSeenWelcome) {
        await storage.createNotification({
          userId: req.user.id,
          title: "Welcome to EntrepreneurOS",
          content: "Your notification system is now active. You'll receive updates here as agents complete tasks and integrations are connected.",
          type: "system",
          read: false
        });

        // Mark user as having seen welcome notification to prevent it from reappearing
        await storage.updateUser(req.user.id, {
          metadata: {
            // Preserve existing metadata fields if any
            ...userMetadata,
            hasSeenWelcome: true
          }
        });
      }

      const notifications = await storage.getNotifications(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/count", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const count = await storage.getUnreadNotificationsCount(req.user.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching notification count:", error);
      res.status(500).json({ message: "Failed to fetch notification count" });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const notification = await storage.markNotificationAsRead(req.params.id);
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/read-all", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    const notificationId = req.params.id;
    console.log(`API request to delete notification: ${notificationId}`);

    try {
      // Authentication check
      if (!req.isAuthenticated()) {
        console.log("Authentication failed for delete notification request");
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if the notification exists and belongs to the user
      const notifications = await storage.getNotifications(req.user.id);
      const notificationExists = notifications.some(n => n.id === notificationId);

      if (!notificationExists) {
        console.log(`Notification ${notificationId} not found for user ${req.user.id}`);
        return res.status(404).json({
          success: false,
          message: "Notification not found or doesn't belong to current user"
        });
      }

      // Delete the notification
      await storage.deleteNotification(notificationId);
      console.log(`Successfully deleted notification: ${notificationId}`);

      // Check if this was the user's last notification
      const remainingNotifications = await storage.getNotifications(req.user.id);
      if (remainingNotifications.length === 0) {
        console.log(`User ${req.user.id} cleared all notifications, updating user metadata`);

        // Get current user data to preserve existing metadata
        const user = await storage.getUser(req.user.id);
        // Safely get metadata object, creating empty object if undefined
        const userMetadata = user?.metadata || {};

        // Update user metadata to track that they've seen and cleared notifications
        await storage.updateUser(req.user.id, {
          metadata: {
            // Preserve existing metadata fields if any
            ...userMetadata,
            hasSeenWelcome: true,
            hasManuallyCleared: true,
            lastClearedAt: new Date().toISOString()
          }
        });
      }

      // Return success response
      res.json({
        success: true,
        message: "Notification deleted successfully",
        id: notificationId
      });
    } catch (error) {
      console.error("Error deleting notification %s:", notificationId, error);
      res.status(500).json({
        success: false,
        message: "Failed to delete notification",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}
