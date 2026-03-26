# Coding Conventions

**Analysis Date:** 2026-03-25

## Naming Patterns

**Files:**
- Kebab-case for component files: `use-auth.tsx`, `protected-route.tsx`, `company-guard.tsx`
- Kebab-case for utilities and hooks: `use-company.ts`, `use-ai-models.ts`
- PascalCase for React component exports (files themselves are kebab-case)
- Page files follow kebab-case: `auth-page.tsx`, `dashboard.tsx`, `task-board-page.tsx`

**Functions:**
- camelCase for function names: `generateResponse()`, `comparePasswords()`, `shouldEscalateToSonnet()`
- Custom hooks use `use` prefix: `useAuth()`, `useCompany()`, `useToast()`
- Factory/utility functions: `createUserWithEmailAndPassword()`, `getMultiFactorResolver()`
- Database/API layer: `getUserByUsername()`, `createUser()`, `getUser()`

**Variables:**
- camelCase: `firebaseUser`, `isLoading`, `mfaResolver`, `sessionSettings`
- Boolean flags: `isLoading`, `hasCompany`, `isFirebaseConfigured()`, `shouldEscalateToSonnet()`
- Constants use UPPER_SNAKE_CASE: `SESSION_SECRET`, `COMPLEXITY_KEYWORDS`
- Arrays/collections: `collaboratorIds`, `agentIcons`, `departments`, `allowedKeys`

**Types:**
- PascalCase: `AuthContextType`, `LoginData`, `FirebaseLoginData`, `UserWithoutPassword`
- Generic parameters: single letters or descriptive names

## Code Style

**Formatting:**
- No external formatter configured (prettier not found)
- Tailwind CSS utility classes for styling
- Explicit import grouping
- 2-space indentation (TypeScript default)

**Linting:**
- No ESLint config found
- TypeScript strict mode: `strict: true` in `tsconfig.json`

## Import Organization

**Order:**
1. Third-party library imports
2. Type-only imports
3. Internal aliases (@/ and @shared/)
4. Relative imports for co-located files

**Path Aliases:**
- `@/*` maps to `./client/src/*`
- `@shared/*` maps to `./shared/*`

**Example from `client/src/hooks/use-auth.tsx`:**
```typescript
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
```

## Error Handling

**Patterns:**
- Try-catch blocks for async operations
- Explicit error checks before using optional values
- Descriptive error messages
- HTTP status codes: 400, 401, 403, 404, 500
- Client mutations display errors via toast()
- Firebase errors checked with specific code checks

**Server example from `server/auth.ts`:**
```typescript
try {
  const cred = await signInWithEmailAndPassword(auth as Auth, data.email, data.password);
  await syncFirebaseUser(cred.user);
} catch (error: any) {
  if (error.code === 'auth/multi-factor-auth-required') {
    const resolver = getMultiFactorResolver(auth as Auth, error);
    setMfaResolver(resolver);
    throw new Error("MFA_REQUIRED");
  }
  if (error.code === 'auth/wrong-password') {
    throw new Error("Invalid email or password");
  }
  throw error;
}
```

## Logging

**Framework:** Console methods (`console.error`, `console.log`)

**Patterns:**
- Log errors with context: `console.error("Error syncing Firebase user:", err)`
- Use toast for success messages, not console
- No centralized logging service

## Comments

**When to Comment:**
- Explain complex logic or non-obvious decisions
- Mark implementation gaps
- Describe why, not what
- Flag incomplete API endpoints

**Guidelines:**
- Single-line comments for clarification
- Multi-line for complex blocks
- NO JSDoc/TSDoc patterns in codebase

## Function Design

**Size:**
- Average 20-50 lines per function
- Larger functions split into helpers
- Async handlers use try-catch in mutation callbacks

**Parameters:**
- Destructured object parameters
- Type annotations always present: `(email: string): Promise<void>`
- Optional marked with `?`: `icon?: string`

**Return Values:**
- Explicit return types: `async (): Promise<void>`, `(): Promise<string>`
- Objects from custom hooks: `{ company, hasCompany, isLoading }`

**Example from `server/auth.ts`:**
```typescript
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
```

## Module Design

**Exports:**
- Named exports for utilities: `export function useAuth() { ... }`
- Default exports for pages: `export default Dashboard`
- Barrel files not heavily used

**Type exports:**
```typescript
export type AuthContextType = { ... }
export type LoginData = { ... }
```

**Context & Providers:**
- Context with explicit type: `createContext<AuthContextType | null>(null)`
- Provider and hook exported together
- Hook validates usage: `if (!context) throw new Error(...)`

**File: `client/src/hooks/use-auth.tsx`:**
```typescript
export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // implementation
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

---

*Convention analysis: 2026-03-25*
