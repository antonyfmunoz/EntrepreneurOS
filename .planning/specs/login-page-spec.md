# EntrepreneurOS Login Page - Build Spec

**Project:** EntrepreneurOS
**Feature:** Login Page (Route: `/login`)
**Build Method:** Stitch UI Generation + Backend Integration
**Priority:** P0 - Foundation page, sets design system

---

## 1. Page Overview

**Purpose:** Premium authentication entry point for EntrepreneurOS - the AI-native business operating system for founders.

**Route:** `/login`

**Design System Foundation:**
- **Dark mode first** - dark charcoal/black background
- **Premium, technical, minimal** aesthetic
- **High contrast** - cool neutrals with subtle blue accents
- **Optional secondary accent:** electric cyan or muted violet
- **No playful consumer UI** - founder command center aesthetic
- **Sharp cards, compact spacing, subtle borders, restrained shadows**

## 2. Layout Structure

Centered authentication card containing:
- Logo / Product name: "EntrepreneurOS"
- Tagline: "Your AI operating system for business"
- Email input (required)
- Password input (required)
- "Sign In" primary button
- "Continue with Google" secondary button
- "Create account" link → `/signup`
- "Forgot password?" link

## 3. Technical Requirements

**Backend Integration:**
- Auth endpoint: `POST /api/auth/login` (existing Passport.js)
- Google OAuth: `GET /api/auth/google` (existing flow)
- Session management: Cookie-based via Passport.js

**State Management:**
- Email/password local state
- Loading state during auth
- Error state with inline messages

**Validation:**
- Email format validation
- Password minimum 8 characters
- Inline error display
- Disable submit while loading

## 4. Success Criteria

- User can log in with email/password
- User can log in with Google OAuth
- Form validation works correctly
- Errors display properly
- Successful login redirects to `/home`
- Matches premium dark-mode aesthetic
- Responsive across devices
- Accessible (keyboard + screen reader)
