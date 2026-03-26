# Testing Patterns

**Analysis Date:** 2026-03-25

## Test Framework

**Status:** Not detected

**Current State:**
- No Jest, Vitest, or other test runner in devDependencies
- No test files in source directories (`client/src`, `server`, `shared`)
- TypeScript strict mode serves as compile-time type safety only
- No test configuration files present

## Validation Framework in Use

**Zod for Runtime Validation:**
- Database schemas defined in `shared/schema.ts` with Zod
- Insert schemas for all entities: `insertUserSchema`, `insertAgentSchema`, `insertTaskSchema`
- Frontend forms use Zod with react-hook-form via `zodResolver`

Example from `shared/schema.ts`:
```typescript
export const insertUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address"),
});
```

Example from `client/src/components/create-agent-form.tsx`:
```typescript
import { zodResolver } from "@hookform/resolvers/zod";

const agentFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  roleLevel: z.enum(["chief", "manager", "laborer"]).default("laborer"),
});

type AgentFormValues = z.infer<typeof agentFormSchema>;

const form = useForm<AgentFormValues>({
  resolver: zodResolver(agentFormSchema),
});
```

## Recommended Testing Setup

### Install Testing Dependencies

```bash
npm install --save-dev jest ts-jest @testing-library/react @testing-library/hooks @testing-library/jest-dom @types/jest supertest @types/supertest
```

### Configure Jest

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/client/src', '<rootDir>/server', '<rootDir>/shared'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
};
```

### Add Test Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Test File Organization

Co-locate tests with source files:

```
client/src/hooks/
├── use-auth.tsx
├── __tests__/
│   └── use-auth.test.tsx
├── use-company.ts
└── __tests__/
    └── use-company.test.ts
```

## Test Pattern Examples

### Hook Testing

File: `client/src/hooks/__tests__/use-company.test.tsx`

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useCompany } from '../use-company';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('useCompany', () => {
  it('returns null company when API returns 404', async () => {
    const { result } = renderHook(() => useCompany(), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.hasCompany).toBe(false);
  });
});
```

### Schema Validation Testing

File: `shared/__tests__/schema.test.ts`

```typescript
import { insertUserSchema } from '../schema';

describe('User Schema Validation', () => {
  it('accepts valid user data', () => {
    const validUser = {
      username: 'johndoe',
      password: 'password123',
      email: 'john@example.com',
    };
    const result = insertUserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });
  
  it('rejects username too short', () => {
    const invalidUser = {
      username: 'ab',
      password: 'password123',
      email: 'john@example.com',
    };
    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });
});
```

### API Route Testing

File: `server/__tests__/auth.test.ts`

```typescript
import request from 'supertest';
import express from 'express';
import { setupAuth } from '../auth';

describe('Authentication Endpoints', () => {
  let app = express();
  
  beforeAll(() => {
    app.use(express.json());
    setupAuth(app);
  });
  
  it('POST /api/register creates user', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({
        username: 'testuser',
        password: 'pass123',
        email: 'test@example.com',
      });
    
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('username');
    expect(res.body).not.toHaveProperty('password');
  });
});
```

### Component Testing

File: `client/src/lib/__tests__/protected-route.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from '../protected-route';
import { useAuth } from '@/hooks/use-auth';
import { useCompany } from '@/hooks/use-company';

jest.mock('@/hooks/use-auth');
jest.mock('@/hooks/use-company');

describe('ProtectedRoute', () => {
  it('shows spinner while loading', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: true,
    });
    (useCompany as jest.Mock).mockReturnValue({
      isLoading: true,
    });
    
    render(
      <ProtectedRoute path="/test" component={() => <div>Test</div>} />
    );
    
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
```

## Error Handling Tests

Test Firebase error patterns:

```typescript
it('handles MFA required error', async () => {
  const error = new Error('MFA required');
  (error as any).code = 'auth/multi-factor-auth-required';
  
  // Test that MFA resolver is set, not showing generic error toast
});

it('rejects invalid Firebase credentials', async () => {
  const error = new Error('Invalid credentials');
  (error as any).code = 'auth/wrong-password';
  
  // Test error message is specific and helpful
});
```

## Key Testing Considerations

**TanStack Query:**
- Mock useQuery and useMutation calls
- Test loading, success, and error states

**Firebase Auth:**
- Firebase initialization is conditional
- Mock firebase/auth functions
- Test both Firebase and fallback auth

**AI Providers:**
- Provider availability controlled by environment variables
- Test fallback when provider unavailable
- Mock API calls

**Custom Hooks:**
- Wrap in appropriate providers (QueryClientProvider, AuthProvider)
- Test both success and error paths
- Verify state updates

## Coverage Goals

Target minimum coverage:
- Critical paths: 80%+
- Schema validation: 100%
- Hooks: 70%+
- Components: 60%+

---

*Testing analysis: 2026-03-25*
