import { useUser, useClerk } from "@clerk/clerk-react";
import { Link } from "wouter";
import { Building2, LogOut, User, Briefcase } from "lucide-react";
import {
  colors,
  glassmorphism,
  borderRadius,
} from "@/lib/design-tokens";

interface HeaderProps {
  companyName?: string;
  companyId?: string;
  title?: string;
  children?: React.ReactNode;
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse ${className ?? ""}`}
      style={{ background: colors.surfaceContainerLow, borderRadius: borderRadius.sm }}
    />
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Header({ companyName, companyId, title, children }: HeaderProps) {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();

  const displayName = title ?? companyName ?? "EntrepreneurOS";

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: glassmorphism.background,
        backdropFilter: glassmorphism.backdropFilter,
        WebkitBackdropFilter: glassmorphism.backdropFilter,
        boxShadow: glassmorphism.shadow,
      }}
    >
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left: logo + optional children (e.g. sidebar toggle) */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          {children}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div
                className="flex h-8 w-8 items-center justify-center flex-shrink-0"
                style={{
                  background: colors.primary,
                  borderRadius: borderRadius.default,
                }}
              >
                <span className="text-white text-sm font-semibold">E</span>
              </div>
              <span
                className="hidden sm:block text-base font-semibold tracking-tight"
                style={{ color: colors.onSurface }}
              >
                EntrepreneurOS
              </span>
            </div>
          </Link>
        </div>

        {/* Center: current context */}
        <div className="flex-1 flex justify-center px-4 min-w-0">
          {companyId ? (
            <Link href={`/portfolios`}>
              <div
                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer max-w-xs"
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  borderRadius: borderRadius.default,
                }}
              >
                <Building2
                  className="h-4 w-4 flex-shrink-0"
                  style={{ color: colors.onSurfaceVariant }}
                />
                <span
                  className="truncate text-sm font-medium"
                  style={{ color: colors.onSurface }}
                >
                  {companyName ?? "Company"}
                </span>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <Briefcase
                className="h-4 w-4 flex-shrink-0"
                style={{ color: colors.onSurfaceVariant }}
              />
              <span
                className="truncate text-sm font-medium"
                style={{ color: colors.onSurface }}
              >
                {displayName}
              </span>
            </div>
          )}
        </div>

        {/* Right: user actions */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          {!isLoaded ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="hidden md:block h-4 w-20 rounded" />
            </div>
          ) : clerkUser ? (
            <div className="flex items-center gap-2">
              {/* Avatar */}
              <div className="relative h-9 w-9 rounded-full overflow-hidden flex-shrink-0">
                {clerkUser.imageUrl ? (
                  <img
                    src={clerkUser.imageUrl}
                    alt={clerkUser.fullName ?? "User"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="h-full w-full flex items-center justify-center"
                    style={{
                      background: colors.primary,
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    {getInitials(clerkUser.fullName ?? clerkUser.primaryEmailAddress?.emailAddress ?? "U")}
                  </div>
                )}
              </div>

              {/* Name (hidden on mobile) */}
              <span
                className="hidden md:block text-sm font-medium truncate max-w-[120px]"
                style={{ color: colors.onSurface }}
              >
                {clerkUser.fullName ?? clerkUser.primaryEmailAddress?.emailAddress ?? "User"}
              </span>

              {/* Profile link */}
              <Link href="/settings">
                <button
                  className="h-9 w-9 flex items-center justify-center rounded-full hover:opacity-80 transition-opacity"
                  style={{ color: colors.onSurfaceVariant }}
                  title="Profile settings"
                >
                  <User className="h-4 w-4" />
                </button>
              </Link>

              {/* Sign out */}
              <button
                onClick={() => signOut()}
                className="h-9 w-9 flex items-center justify-center rounded-full hover:opacity-80 transition-opacity"
                style={{ color: colors.onSurfaceVariant }}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default Header;
