import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Users,
  MapPin,
  Clock,
  Monitor,
  Globe,
  Copy,
  Check,
  ChevronLeft,
  Search,
  X,
  Download,
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  sessionCredits: number;
  createdAt: string;
  totalLogins: number;
  completedSessions: number;
  lastLogin: string | null;
  lastCountry: string | null;
  lastCity: string | null;
}

interface LoginEvent {
  id: number;
  userId: string;
  clerkSessionId: string | null;
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface InterviewSession {
  id: number;
  jobRole: string;
  durationMinutes: number;
  status: string;
  createdAt: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fullName(user: AdminUser): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "—";
}

function locationStr(country: string | null, city: string | null): string {
  const parts = [city, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function parseUserAgent(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: "Unknown", os: "Unknown" };

  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";

  let os = "Unknown";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Mac OS/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return { browser, os };
}

function AccessDenied({
  errorMsg,
  meData,
  isMeError,
  openSignIn,
}: {
  errorMsg: string;
  meData: { userId: string } | undefined;
  isMeError: boolean;
  openSignIn: (opts?: object) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isNoAdmins = errorMsg === "NO_ADMINS_CONFIGURED";
  const isForbidden = errorMsg === "FORBIDDEN";
  const isLoggedOut = errorMsg === "UNAUTHORIZED";

  function handleCopy() {
    if (!meData?.userId) return;
    navigator.clipboard.writeText(meData.userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card className="bg-white border-red-200 shadow-sm">
      <CardContent className="py-12 text-center space-y-3">
        <p className="text-red-600 font-semibold text-lg">Access Denied</p>
        {isNoAdmins ? (
          <>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              No admin users have been configured yet. To grant yourself access, set the{" "}
              <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">
                ADMIN_USER_IDS
              </code>{" "}
              environment secret in your Replit project settings.
            </p>
            {meData?.userId && (
              <div className="max-w-sm mx-auto space-y-2 pt-1">
                <p className="text-slate-500 text-xs font-medium">Your Clerk user ID:</p>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <code className="flex-1 text-left text-slate-800 font-mono text-sm break-all">
                    {meData.userId}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
            {isMeError && (
              <p className="text-slate-400 text-xs max-w-sm mx-auto pt-1">
                Couldn't load your user ID — try refreshing.
              </p>
            )}
          </>
        ) : isForbidden ? (
          <>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              Your account does not have admin access. Ask the project owner to add your user ID to the{" "}
              <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">
                ADMIN_USER_IDS
              </code>{" "}
              environment secret.
            </p>
            {meData?.userId && (
              <div className="max-w-sm mx-auto space-y-2 pt-1">
                <p className="text-slate-500 text-xs font-medium">Your Clerk user ID:</p>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <code className="flex-1 text-left text-slate-800 font-mono text-sm break-all">
                    {meData.userId}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : isLoggedOut ? (
          <div className="space-y-4">
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              You must be signed in to access this page.
            </p>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => openSignIn({ redirectUrl: window.location.href })}
            >
              Sign In
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LoginEventRow({ event }: { event: LoginEvent }) {
  const { browser, os } = parseUserAgent(event.userAgent);
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <td className="py-3 px-4 text-sm text-slate-700 whitespace-nowrap">
        {formatDate(event.createdAt)}
      </td>
      <td className="py-3 px-4 text-sm text-slate-600">
        {event.ipAddress ?? "—"}
      </td>
      <td className="py-3 px-4 text-sm text-slate-600">
        {locationStr(event.country, event.city)}
      </td>
      <td className="py-3 px-4 text-sm text-slate-600">
        {browser} / {os}
      </td>
    </tr>
  );
}

function SessionRow({ session }: { session: InterviewSession }) {
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <td className="py-3 px-4 text-sm text-slate-700 whitespace-nowrap">
        {formatDate(session.createdAt)}
      </td>
      <td className="py-3 px-4 text-sm text-slate-700">
        {session.jobRole}
      </td>
      <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
        {session.durationMinutes} min
      </td>
    </tr>
  );
}

function UserDetailPanel({
  user,
  onBack,
}: {
  user: AdminUser;
  onBack: () => void;
}) {
  const { data: events, isLoading: eventsLoading, isError: eventsError } = useQuery<LoginEvent[]>({
    queryKey: ["admin-user-login-events", user.id],
    queryFn: async () => {
      const res = await fetch(`/api/users/admin/users/${encodeURIComponent(user.id)}/login-events`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("FETCH_FAILED");
      return res.json();
    },
    retry: false,
  });

  const { data: sessions, isLoading: sessionsLoading, isError: sessionsError } = useQuery<InterviewSession[]>({
    queryKey: ["admin-user-sessions", user.id],
    queryFn: async () => {
      const res = await fetch(`/api/users/admin/users/${encodeURIComponent(user.id)}/sessions`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("FETCH_FAILED");
      return res.json();
    },
    retry: false,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4" />
          All Users
        </Button>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">
            {fullName(user)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-0.5">Email</p>
              <p className="text-slate-800 break-all">{user.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-0.5">Signed Up</p>
              <p className="text-slate-800">{formatDateShort(user.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-0.5">Total Logins</p>
              <p className="text-slate-800">{user.totalLogins}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-0.5">Completed Sessions</p>
              <p className="text-slate-800">{user.completedSessions}</p>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs font-medium text-slate-500 mb-0.5">Last Login</p>
              <p className="text-slate-800">{formatDate(user.lastLogin)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-3">Interview Sessions</h2>

        {sessionsLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
          </div>
        )}

        {sessionsError && (
          <Card className="bg-white border-red-200 shadow-sm">
            <CardContent className="py-8 text-center text-red-600 text-sm">
              Failed to load interview sessions. Please try again.
            </CardContent>
          </Card>
        )}

        {!sessionsLoading && !sessionsError && sessions && (
          <>
            {sessions.length === 0 ? (
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="py-8 text-center text-slate-500 text-sm">
                  No completed interview sessions for this user.
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Date
                        </th>
                        <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Job Role
                        </th>
                        <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Duration
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => (
                        <SessionRow key={session.id} session={session} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-3">Login History</h2>

        {eventsLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
          </div>
        )}

        {eventsError && (
          <Card className="bg-white border-red-200 shadow-sm">
            <CardContent className="py-8 text-center text-red-600 text-sm">
              Failed to load login history. Please try again.
            </CardContent>
          </Card>
        )}

        {!eventsLoading && !eventsError && events && (
          <>
            {events.length === 0 ? (
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="py-8 text-center text-slate-500 text-sm">
                  No login events recorded for this user.
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Date / Time
                        </th>
                        <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          IP Address
                        </th>
                        <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Location
                        </th>
                        <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Device / Browser
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <LoginEventRow key={event.id} event={event} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const { openSignIn } = useClerk();
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const [filters, setFilters] = useState({
    search: "",
    signedUpFrom: "",
    signedUpTo: "",
    lastLoginFrom: "",
    lastLoginTo: "",
  });

  const debouncedFilters = useDebounce(filters, 250);

  const { data: users, isLoading, isError, error } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/users/admin/users", { credentials: "include" });
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body?.code === "NO_ADMINS_CONFIGURED") throw new Error("NO_ADMINS_CONFIGURED");
        throw new Error("FORBIDDEN");
      }
      if (!res.ok) throw new Error("FETCH_FAILED");
      return res.json();
    },
    retry: false,
  });

  const errorMsg = (error as Error | null)?.message ?? "";
  const isUnauthorized =
    errorMsg === "UNAUTHORIZED" ||
    errorMsg === "FORBIDDEN" ||
    errorMsg === "NO_ADMINS_CONFIGURED";

  const showUserId = errorMsg === "NO_ADMINS_CONFIGURED" || errorMsg === "FORBIDDEN";

  const filteredUsers = (users ?? []).filter((user) => {
    if (debouncedFilters.search) {
      const q = debouncedFilters.search.toLowerCase();
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ").toLowerCase();
      const email = (user.email ?? "").toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    if (debouncedFilters.signedUpFrom) {
      if (new Date(user.createdAt) < new Date(debouncedFilters.signedUpFrom)) return false;
    }
    if (debouncedFilters.signedUpTo) {
      const to = new Date(debouncedFilters.signedUpTo);
      to.setDate(to.getDate() + 1);
      if (new Date(user.createdAt) >= to) return false;
    }
    if (debouncedFilters.lastLoginFrom) {
      if (!user.lastLogin || new Date(user.lastLogin) < new Date(debouncedFilters.lastLoginFrom)) return false;
    }
    if (debouncedFilters.lastLoginTo) {
      const to = new Date(debouncedFilters.lastLoginTo);
      to.setDate(to.getDate() + 1);
      if (!user.lastLogin || new Date(user.lastLogin) >= to) return false;
    }
    return true;
  });

  const hasActiveFilters =
    debouncedFilters.search ||
    debouncedFilters.signedUpFrom ||
    debouncedFilters.signedUpTo ||
    debouncedFilters.lastLoginFrom ||
    debouncedFilters.lastLoginTo;

  function clearFilters() {
    setFilters({ search: "", signedUpFrom: "", signedUpTo: "", lastLoginFrom: "", lastLoginTo: "" });
  }

  function exportCSV() {
    const headers = ["Name", "Email", "Signed Up", "Last Login", "Total Logins", "Location"];
    const rows = filteredUsers.map((user) => [
      fullName(user),
      user.email ?? "",
      formatDate(user.createdAt),
      formatDate(user.lastLogin),
      String(user.totalLogins),
      locationStr(user.lastCountry, user.lastCity),
    ]);
    const sanitize = (v: string) => /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    const escape = (v: string) => `"${sanitize(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const { data: meData, isError: isMeError } = useQuery<{ userId: string }>({
    queryKey: ["users-me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me", { credentials: "include" });
      if (!res.ok) throw new Error("FETCH_FAILED");
      return res.json();
    },
    enabled: showUserId,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full bg-blue-500/35 blur-[90px]" />
        <div className="absolute -top-32 -left-48 w-[600px] h-[600px] rounded-full bg-purple-500/30 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] rounded-full bg-indigo-400/20 blur-[110px]" />
      </div>

      <div className="absolute top-0 left-0 right-0 h-[60vh] bg-gradient-to-b from-blue-100/90 via-purple-50/40 to-transparent pointer-events-none" />

      <AppHeader
        right={
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600 font-medium hover:text-blue-700 hover:bg-blue-50 gap-2"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        }
      />

      <div className="flex-1 p-6 relative z-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">User Dashboard</h1>
              <p className="text-slate-500 text-sm">All registered users and their login activity</p>
            </div>
            {!isUnauthorized && users && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">
                    {hasActiveFilters
                      ? `${filteredUsers.length} of ${users.length} user${users.length !== 1 ? "s" : ""}`
                      : `${users.length} user${users.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filteredUsers.length === 0}
                  className="gap-1.5 text-slate-600 border-slate-200 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={exportCSV}
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            )}
          </div>

          {isUnauthorized && (
            <AccessDenied
              errorMsg={errorMsg}
              meData={meData}
              isMeError={isMeError}
              openSignIn={openSignIn}
            />
          )}

          {!isUnauthorized && (
            <>
              {isLoading && (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              )}

              {isError && !isUnauthorized && (
                <Card className="bg-white border-red-200 shadow-sm">
                  <CardContent className="py-8 text-center text-red-600">
                    Failed to load users. Please try again.
                  </CardContent>
                </Card>
              )}

              {!isLoading && !isError && users && (
                <>
                  {selectedUser ? (
                    <UserDetailPanel
                      user={selectedUser}
                      onBack={() => setSelectedUser(null)}
                    />
                  ) : (
                    <>
                      {users.length === 0 ? (
                        <Card className="bg-white border-slate-200 shadow-sm">
                          <CardContent className="py-12 text-center text-slate-500 text-sm">
                            No users have signed up yet.
                          </CardContent>
                        </Card>
                      ) : (
                        <>
                          <Card className="bg-white border-slate-200 shadow-sm">
                            <CardContent className="p-4 space-y-3">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                <Input
                                  value={filters.search}
                                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                                  placeholder="Search by name or email…"
                                  className="pl-9 pr-9 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus-visible:ring-blue-500"
                                />
                                {filters.search && (
                                  <button
                                    onClick={() => setFilters((f) => ({ ...f, search: "" }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-slate-500">Signed up from</label>
                                  <Input
                                    type="date"
                                    value={filters.signedUpFrom}
                                    onChange={(e) => setFilters((f) => ({ ...f, signedUpFrom: e.target.value }))}
                                    className="bg-slate-50 border-slate-200 text-slate-800 text-sm focus-visible:ring-blue-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-slate-500">Signed up to</label>
                                  <Input
                                    type="date"
                                    value={filters.signedUpTo}
                                    onChange={(e) => setFilters((f) => ({ ...f, signedUpTo: e.target.value }))}
                                    className="bg-slate-50 border-slate-200 text-slate-800 text-sm focus-visible:ring-blue-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-slate-500">Last login from</label>
                                  <Input
                                    type="date"
                                    value={filters.lastLoginFrom}
                                    onChange={(e) => setFilters((f) => ({ ...f, lastLoginFrom: e.target.value }))}
                                    className="bg-slate-50 border-slate-200 text-slate-800 text-sm focus-visible:ring-blue-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-slate-500">Last login to</label>
                                  <Input
                                    type="date"
                                    value={filters.lastLoginTo}
                                    onChange={(e) => setFilters((f) => ({ ...f, lastLoginTo: e.target.value }))}
                                    className="bg-slate-50 border-slate-200 text-slate-800 text-sm focus-visible:ring-blue-500"
                                  />
                                </div>
                              </div>
                              {hasActiveFilters && (
                                <div className="flex items-center justify-between pt-0.5">
                                  <p className="text-xs text-slate-500">
                                    Showing {filteredUsers.length} of {users.length} users
                                  </p>
                                  <button
                                    onClick={clearFilters}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                    Clear filters
                                  </button>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {filteredUsers.length === 0 ? (
                            <Card className="bg-white border-slate-200 shadow-sm">
                              <CardContent className="py-12 text-center text-slate-500 text-sm">
                                No users match the current filters.
                              </CardContent>
                            </Card>
                          ) : (
                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                      <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Name
                                      </th>
                                      <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Email
                                      </th>
                                      <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Signed Up
                                      </th>
                                      <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Logins
                                      </th>
                                      <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Sessions
                                      </th>
                                      <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Last Login
                                      </th>
                                      <th className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                        Last Location
                                      </th>
                                      <th className="py-2.5 px-4" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredUsers.map((user) => (
                                      <tr
                                        key={user.id}
                                        className="border-b border-slate-100 last:border-0 hover:bg-blue-50/50 transition-colors cursor-pointer"
                                        onClick={() => setSelectedUser(user)}
                                      >
                                        <td className="py-3 px-4 text-sm font-medium text-slate-800 whitespace-nowrap">
                                          {fullName(user)}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-600 max-w-[200px] truncate">
                                          {user.email ?? "—"}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                                          {formatDateShort(user.createdAt)}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-600 text-center">
                                          {user.totalLogins}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-600 text-center">
                                          {user.completedSessions}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                                          {formatDate(user.lastLogin)}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                                          {locationStr(user.lastCountry, user.lastCity)}
                                        </td>
                                        <td className="py-3 px-4">
                                          <ArrowRight className="h-4 w-4 text-slate-300" />
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </Card>
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
