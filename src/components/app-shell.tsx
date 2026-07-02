"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  MapPin,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/search", label: "Search", icon: Search, exact: false },
  { href: "/businesses", label: "Businesses", icon: Building2, exact: false },
  { href: "/leads", label: "Leads", icon: Users, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
];

interface AuthMe {
  authEnabled: boolean;
  email: string | null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [auth, setAuth] = React.useState<AuthMe | null>(null);
  const [signingOut, setSigningOut] = React.useState(false);

  const bare =
    pathname.startsWith("/login") || pathname.startsWith("/preview");

  React.useEffect(() => {
    if (bare) return;
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? (res.json() as Promise<AuthMe>) : null))
      .then((data) => {
        if (!cancelled && data) setAuth(data);
      })
      .catch(() => {
        // Ignore — the shell still renders without auth info.
      });
    return () => {
      cancelled = true;
    };
  }, [bare]);

  if (bare) {
    return <>{children}</>;
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors; still navigate to the login page.
    }
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-card">
        <div className="flex items-start gap-3 px-5 py-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              Dubai Lead Gen
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Website opportunities
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-5 py-4">
          {auth?.authEnabled ? (
            <div className="space-y-2">
              {auth.email && (
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={auth.email}
                >
                  {auth.email}
                </p>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Local admin mode</p>
          )}
        </div>
      </aside>

      <main className="ml-60 min-h-screen bg-muted/30 p-8">{children}</main>
    </div>
  );
}
