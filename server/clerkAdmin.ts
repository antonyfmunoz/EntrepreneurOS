import { createClerkClient } from "@clerk/express";

const secretKey = process.env.CLERK_SECRET_KEY;

export const clerkClient = secretKey
  ? createClerkClient({ secretKey })
  : null;
