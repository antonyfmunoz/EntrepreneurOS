import { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  insertCrmContactSchema,
  insertCrmDealSchema,
  insertCrmActivitySchema,
} from "@shared/schema";

export function registerCRMRoutes(app: Express): void {
  // CRM API - Contacts
  app.get("/api/crm/contacts", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const contacts = await storage.getCrmContacts(req.user.id);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching CRM contacts:", error);
      res.status(500).json({ message: "Failed to fetch CRM contacts" });
    }
  });

  app.get("/api/crm/contacts/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const contact = await storage.getCrmContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Ensure the contact belongs to the authenticated user
      if (contact.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized access to contact" });
      }

      res.json(contact);
    } catch (error) {
      console.error("Error fetching CRM contact:", error);
      res.status(500).json({ message: "Failed to fetch CRM contact" });
    }
  });

  app.post("/api/crm/contacts", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const contactData = insertCrmContactSchema.parse({
        ...req.body,
        userId: req.user.id
      });

      const contact = await storage.createCrmContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      console.error("Error creating CRM contact:", error);
      res.status(500).json({ message: "Failed to create CRM contact" });
    }
  });

  app.patch("/api/crm/contacts/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if contact exists and belongs to user
      const existingContact = await storage.getCrmContact(req.params.id);
      if (!existingContact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (existingContact.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized access to contact" });
      }

      const updatedContact = await storage.updateCrmContact(req.params.id, req.body);
      res.json(updatedContact);
    } catch (error) {
      console.error("Error updating CRM contact:", error);
      res.status(500).json({ message: "Failed to update CRM contact" });
    }
  });

  // CRM API - Deals
  app.get("/api/crm/deals", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const deals = await storage.getCrmDeals(req.user.id);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching CRM deals:", error);
      res.status(500).json({ message: "Failed to fetch CRM deals" });
    }
  });

  app.get("/api/crm/deals/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const deal = await storage.getCrmDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      // Ensure the deal belongs to the authenticated user
      if (deal.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized access to deal" });
      }

      res.json(deal);
    } catch (error) {
      console.error("Error fetching CRM deal:", error);
      res.status(500).json({ message: "Failed to fetch CRM deal" });
    }
  });

  app.post("/api/crm/deals", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const dealData = insertCrmDealSchema.parse({
        ...req.body,
        userId: req.user.id
      });

      const deal = await storage.createCrmDeal(dealData);
      res.status(201).json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid deal data", errors: error.errors });
      }
      console.error("Error creating CRM deal:", error);
      res.status(500).json({ message: "Failed to create CRM deal" });
    }
  });

  app.patch("/api/crm/deals/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if deal exists and belongs to user
      const existingDeal = await storage.getCrmDeal(req.params.id);
      if (!existingDeal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      if (existingDeal.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized access to deal" });
      }

      const updatedDeal = await storage.updateCrmDeal(req.params.id, req.body);
      res.json(updatedDeal);
    } catch (error) {
      console.error("Error updating CRM deal:", error);
      res.status(500).json({ message: "Failed to update CRM deal" });
    }
  });

  // CRM API - Activities
  app.get("/api/crm/activities", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const activities = await storage.getCrmActivities(req.user.id);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching CRM activities:", error);
      res.status(500).json({ message: "Failed to fetch CRM activities" });
    }
  });

  app.get("/api/crm/activities/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const activity = await storage.getCrmActivity(req.params.id);
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      // Ensure the activity belongs to the authenticated user
      if (activity.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized access to activity" });
      }

      res.json(activity);
    } catch (error) {
      console.error("Error fetching CRM activity:", error);
      res.status(500).json({ message: "Failed to fetch CRM activity" });
    }
  });

  app.post("/api/crm/activities", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const activityData = insertCrmActivitySchema.parse({
        ...req.body,
        userId: req.user.id
      });

      const activity = await storage.createCrmActivity(activityData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      }
      console.error("Error creating CRM activity:", error);
      res.status(500).json({ message: "Failed to create CRM activity" });
    }
  });

  app.patch("/api/crm/activities/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if activity exists and belongs to user
      const existingActivity = await storage.getCrmActivity(req.params.id);
      if (!existingActivity) {
        return res.status(404).json({ message: "Activity not found" });
      }

      if (existingActivity.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized access to activity" });
      }

      const updatedActivity = await storage.updateCrmActivity(req.params.id, req.body);
      res.json(updatedActivity);
    } catch (error) {
      console.error("Error updating CRM activity:", error);
      res.status(500).json({ message: "Failed to update CRM activity" });
    }
  });
}
