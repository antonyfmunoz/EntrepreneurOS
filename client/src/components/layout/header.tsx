import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Bell, Building2, CheckCheck, ChevronDown, CircleHelp, LayoutGrid, Loader2, Menu, Search, Settings, User, X } from "lucide-react";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";

interface HeaderProps {
  title?: string;
  portfolioName?: string;
  portfolioHref?: string;
  companyName?: string;
  companyHref?: string;
  roleName?: string;
  onLeftMenuClick?: () => void;
}

interface NotificationRecord {
  id: string;
  title: string;
  content: string;
  read: boolean;
  href?: string | null;
  createdAt?: string;
}

type ActivePanel = "search" | "notifications" | "account" | null;

export default function Header({
  portfolioName,
  portfolioHref,
  companyName,
  companyHref,
  onLeftMenuClick,
}: HeaderProps) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const initials = user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "U";
  const togglePanel = (panel: Exclude<ActivePanel, null>) => setActivePanel((current) => current === panel ? null : panel);

  const notificationCount = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/count"],
    queryFn: () => apiRequest<{ count: number }>("/api/notifications/count"),
    staleTime: 30_000,
  });
  const notifications = useQuery<NotificationRecord[]>({
    queryKey: ["/api/notifications"],
    queryFn: () => apiRequest<NotificationRecord[]>("/api/notifications"),
    enabled: activePanel === "notifications",
  });
  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/notifications/${id}/read`, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] }),
      ]);
    },
  });
  const markAllRead = useMutation({
    mutationFn: () => apiRequest("/api/notifications/read-all", { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] }),
      ]);
    },
  });

  const openNotification = (notification: NotificationRecord) => {
    if (!notification.read) markRead.mutate(notification.id);
    if (!notification.href?.startsWith("/") || notification.href.startsWith("//")) return;
    setActivePanel(null);
    navigate(notification.href);
  };

  const destinations = useMemo(() => {
    const companyRoot = companyHref || "";
    const companyId = companyRoot.match(/\/company\/(\d+)/)?.[1];
    const settingsHref = companyId ? `/settings?companyId=${companyId}` : "/settings";
    return [
      { label: "Portfolios", detail: "Portfolio and organization selection", href: portfolioHref || "/portfolios" },
      ...(companyRoot ? [
        { label: "Home", detail: companyName || "Organization home", href: `${companyRoot}#home` },
        { label: "Command", detail: "Operating state and next action", href: `${companyRoot}#command` },
        { label: "Organization", detail: "Organization compiler and manifest", href: `${companyRoot}#organization` },
        { label: "Operations", detail: "Work packets, approvals, and evidence", href: `${companyRoot}#operations` },
        { label: "Intelligence", detail: "Executive Office, advisor council, sources, and guidance", href: `${companyRoot}#intelligence` },
        { label: "Systems", detail: "Integration authority and fallback state", href: `${companyRoot}#systems` },
      ] : []),
      { label: "Settings", detail: "Profile, company, privacy, AI spend, and billing", href: settingsHref },
      { label: "Support", detail: "Contact EntrepreneurOS support", href: "/support" },
    ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  }, [companyHref, companyName, portfolioHref, searchTerm]);

  const settingsHref = companyHref?.match(/\/company\/(\d+)/)?.[1]
    ? `/settings?companyId=${companyHref.match(/\/company\/(\d+)/)?.[1]}`
    : "/settings";

  return (
    <>
      <header className="eos-glass sticky top-0 z-50 flex-shrink-0 px-3 sm:px-5 lg:px-8">
        <div className="flex h-16 w-full items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-7">
          {onLeftMenuClick && <Button variant="ghost" size="icon" onClick={onLeftMenuClick} className="lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>}

          {(portfolioName || companyName) && (
            <div className="flex min-w-0 items-center gap-2 text-sm" aria-label="Current workspace">
              {portfolioName && <a href={portfolioHref || "/portfolios"} className="max-w-[42vw] truncate font-semibold tracking-[-0.01em] text-foreground hover:text-primary sm:max-w-[220px]">{portfolioName}</a>}
              {portfolioName && companyName && <span className="flex-shrink-0 text-muted-foreground/60">/</span>}
              {companyName && <a href={companyHref} className="max-w-[38vw] truncate font-medium text-muted-foreground hover:text-primary sm:max-w-[220px]">{companyName}</a>}
            </div>
          )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" onClick={() => togglePanel("search")} className="hidden sm:inline-flex" aria-label="Search" aria-expanded={activePanel === "search"}>
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => togglePanel("notifications")} className="relative" aria-label="Notifications" aria-expanded={activePanel === "notifications"}>
            <Bell className="h-5 w-5" />
            {(notificationCount.data?.count || 0) > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />}
          </Button>
          <button type="button" onClick={() => togglePanel("account")} className="ml-1 flex items-center gap-2 rounded-xl p-1.5 text-foreground transition-colors hover:bg-muted" aria-label="Account menu" aria-expanded={activePanel === "account"}>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? "Account"} />
              <AvatarFallback className="bg-[#ae8dff] text-xs font-semibold text-white">{initials || <User className="h-4 w-4" />}</AvatarFallback>
            </Avatar>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
          </button>
          </div>
        </div>

      </header>

      {activePanel && (
        <>
          <button type="button" className="fixed inset-0 z-[55] bg-[#2c2f30]/10 backdrop-blur-[2px]" onClick={() => setActivePanel(null)} aria-label="Close header panel" />
          <section className="eos-glass fixed left-3 right-3 top-[4.5rem] z-[60] max-h-[min(70vh,560px)] overflow-y-auto rounded-2xl p-5 sm:left-auto sm:right-5 sm:w-[390px]" aria-label={`${activePanel} panel`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><p className="eos-label">EntrepreneurOS</p><h2 className="mt-1 text-lg font-semibold">{activePanel === "search" ? "Find a workspace" : activePanel === "notifications" ? "Notifications" : "Account"}</h2></div>
              <Button variant="ghost" size="icon" onClick={() => setActivePanel(null)} aria-label={`Close ${activePanel} panel`}><X className="h-4 w-4" /></Button>
            </div>

            {activePanel === "search" && <div className="space-y-3"><Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search workspaces and actions" autoFocus />{destinations.map((item) => <a key={item.href} href={item.href} onClick={() => setActivePanel(null)} className="block rounded-xl bg-white p-4 transition-colors hover:bg-muted"><div className="font-medium">{item.label}</div><div className="mt-1 text-sm text-muted-foreground">{item.detail}</div></a>)}{!destinations.length && <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No matching workspace.</p>}</div>}

            {activePanel === "notifications" && <div className="space-y-3">{notifications.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading notifications</div>}{notifications.isError && <p className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">Notifications could not be loaded.</p>}{notifications.data?.map((notification) => <button key={notification.id} type="button" onClick={() => openNotification(notification)} className="block w-full rounded-xl bg-white p-4 text-left transition-colors hover:bg-muted"><div className="flex items-start justify-between gap-3"><span className="font-medium">{notification.title}</span>{!notification.read && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}</div><p className="mt-1 text-sm text-muted-foreground">{notification.content}</p></button>)}{notifications.data && notifications.data.length === 0 && <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">You have no notifications.</p>}{(notifications.data?.some((item) => !item.read)) && <Button variant="secondary" className="w-full" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}><CheckCheck className="mr-2 h-4 w-4" />Mark all read</Button>}</div>}

            {activePanel === "account" && <div className="space-y-4"><div className="rounded-xl bg-white p-4"><div className="font-medium">{user?.fullName || "EntrepreneurOS owner"}</div><div className="mt-1 truncate text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</div></div><nav className="space-y-2" aria-label="Account and workspace navigation"><a href="/portfolios" onClick={() => setActivePanel(null)} className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3 text-sm font-medium hover:bg-[#e5e7e9]"><LayoutGrid className="h-4 w-4 text-primary" />Portfolios</a><a href={portfolioHref || "/portfolios"} onClick={() => setActivePanel(null)} className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3 text-sm font-medium hover:bg-[#e5e7e9]"><Building2 className="h-4 w-4 text-primary" />Organizations</a><a href={settingsHref} onClick={() => setActivePanel(null)} className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3 text-sm font-medium hover:bg-[#e5e7e9]"><Settings className="h-4 w-4 text-primary" />Settings</a><a href="/support" onClick={() => setActivePanel(null)} className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3 text-sm font-medium hover:bg-[#e5e7e9]"><CircleHelp className="h-4 w-4 text-primary" />Support</a></nav><Button variant="outline" className="w-full" onClick={() => void signOut({ redirectUrl: "/login" })}>Sign out</Button></div>}
          </section>
        </>
      )}
    </>
  );
}
