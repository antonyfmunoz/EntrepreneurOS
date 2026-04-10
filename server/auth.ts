import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { createClerkClient, verifyToken } from "@clerk/express";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

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

function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;
  return createClerkClient({ secretKey });
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        let user = await storage.getUserByUsername(username);
        if (!user && username.includes('@')) {
          user = await storage.getUserByEmail(username);
        }
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
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Clerk auth endpoint — verifies Clerk session token and syncs user to DB
  app.post("/api/auth/clerk", async (req, res, next) => {
    try {
      const clerk = getClerkClient();
      if (!clerk) {
        return res.status(503).json({
          error: "Clerk authentication is not available — CLERK_SECRET_KEY not set"
        });
      }

      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Missing Clerk session token" });
      }

      // Verify the JWT with Clerk
      const secretKey = process.env.CLERK_SECRET_KEY!;
      const { sub: clerkUserId } = await verifyToken(token, { secretKey });

      if (!clerkUserId) {
        return res.status(401).json({ error: "Invalid Clerk token" });
      }

      // Get full user details from Clerk
      const clerkUser = await clerk.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");

      if (!email) {
        return res.status(400).json({ error: "Email not available from Clerk" });
      }

      // Find or create local user
      let user = await storage.getUserByClerkId(clerkUserId);

      if (!user) {
        user = await storage.getUserByEmail(email);

        if (user) {
          // Link existing user to Clerk
          user = await storage.updateUser(user.id, { clerkUserId });
        } else {
          // Create new user from Clerk data
          const username = clerkUser.username || email.split('@')[0] + '_' + Math.floor(Math.random() * 10000);
          const password = await hashPassword(randomBytes(32).toString('hex'));

          user = await storage.createUser({
            username,
            email,
            password,
            fullName: fullName || '',
            avatar: clerkUser.imageUrl || '',
            clerkUserId,
          });
        }
      }

      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    } catch (error: any) {
      console.error("Clerk auth error:", error);
      if (error.message?.includes("expired")) {
        return res.status(401).json({ error: "Token expired" });
      }
      next(error);
    }
  });
}
