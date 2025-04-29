import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import * as admin from "firebase-admin";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// Export the hashPassword function so it can be imported elsewhere
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Initialize Firebase Admin if configuration exists
import { initializeFirebaseAdmin, isFirebaseAdminInitialized } from './firebase';

export function setupAuth(app: Express) {
  // Try to initialize Firebase Admin
  initializeFirebaseAdmin();
  
  // Generate a random secret if not provided
  const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Authentication routes
  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: "Invalid username or password" });
      
      req.login(user, (err: Error | null) => {
        if (err) return next(err);
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err: Error | null) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Return user without password
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Google Authentication route
  app.post("/api/auth/google", async (req, res, next) => {
    try {
      // Check if Firebase Admin is initialized
      if (!isFirebaseAdminInitialized()) {
        return res.status(503).json({
          error: "Google authentication is not available - Firebase Admin SDK not initialized"
        });
      }

      const { uid, email, displayName } = req.body;

      if (!uid || !email) {
        return res.status(400).json({ error: "Missing required user data" });
      }

      // Find if user already exists by Firebase UID
      let user = await storage.getUserByFirebaseUid(uid);
      
      if (!user) {
        // Check if a user with this email already exists
        user = await storage.getUserByEmail(email);
        
        if (user) {
          // Update existing user with Firebase UID
          user = await storage.updateUser(user.id, { firebaseUid: uid });
        } else {
          // Create a new user 
          const username = email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);
          // Generate a random secure password for the user
          const password = await hashPassword(randomBytes(16).toString('hex'));
          
          user = await storage.createUser({
            username,
            email,
            password,
            fullName: displayName || '',
            firebaseUid: uid
          });
        }
      }

      // Log the user in
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Google auth error:", error);
      next(error);
    }
  });
}