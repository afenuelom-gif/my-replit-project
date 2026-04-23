import { useLocation } from "wouter";
import { useAuthActions } from "@/contexts/auth-actions";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { AdminNav } from "@/components/AdminNav";
import AppFooter from "@/components/AppFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Loader2,
  TrendingUp,
  CalendarDays,
  Clock,
  CreditCard,
  Users,
  ChevronLeft,
} from "lucide-react";

interface AdminTailorProps {
  authMenu?: React.ReactNode;
  authMobileMenu?: React.ReactNode;
}

interface TailorStats {
  totalAllTime: number;
  totalThisMonth: number;
  totalToday: number;
  totalCreditsOutstanding: number;
  usersWithCredits: number;
}

interface UsageRow {
  id: number;
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  scope: string;
  aggressiveness: string;
  created_at: string;
}

interface CreditBalanceRow {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  plan: string;
  resume_tailoring_credits: number;
  total_used: string;
}

interface TailorData {
  stats: TailorStats;
  recentUsage: UsageRow[];
  creditBalances: CreditBalanceRow[];
}

function fmtDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function planBadge(plan: string) {
  if (plan === "pro") return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Pro</Badge>;
  if (plan === "starter") return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Starter</Badge>;
  return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Free</Badge>;
}

function scopeLabel(scope: string) {
  return scope === "full" ? "Full rewrite" : "Role-specific";
}

function aggressivenessLabel(level: string) {
  if (level === "conservative") return <span className="text-emerald-600 font-medium">Conservative</span>;
  if (level === "balanced") return <span className="text-blue-600 font-medium">Balanced</span>;
  return <span className="text-orange-600 font-medium">Strong</span>;
}

function userLabel(row: { email: string | null; first_name: string | null; last_name: string | null }) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
  return name || row.email || "Unknown";
}

export default function AdminTailors({ authMenu, authMobileMenu }: AdminTailorProps) {
  const [, setLocation] = useLocation();
  const { getAuthHeaders } = useAuthActions();

  const { data, isLoading, error } = useQuery<TailorData>({
    queryKey: ["admin-tailors"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/users/admin/tailors", {
        credentials: "include",
        headers,
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col">
      <AppHeader right={authMenu} mobileMenuExtra={authMobileMenu} />
      <AdminNav />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/admin/users")}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Resume Tailor Tracking
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Usage activity and credit balances across all users</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        )}

        {error && (
          <div className="text-center py-16 text-slate-400">Failed to load tailor data.</div>
        )}

        {data && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <Card className="border-0 shadow-sm col-span-1">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <TrendingUp className="w-3.5 h-3.5" />
                    All time
                  </div>
                  <div className="text-3xl font-black text-slate-900">{data.stats.totalAllTime}</div>
                  <div className="text-xs text-slate-400">tailors run</div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm col-span-1">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <CalendarDays className="w-3.5 h-3.5" />
                    This month
                  </div>
                  <div className="text-3xl font-black text-blue-600">{data.stats.totalThisMonth}</div>
                  <div className="text-xs text-slate-400">tailors run</div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm col-span-1">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5" />
                    Today
                  </div>
                  <div className="text-3xl font-black text-indigo-600">{data.stats.totalToday}</div>
                  <div className="text-xs text-slate-400">tailors run</div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm col-span-1">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <CreditCard className="w-3.5 h-3.5" />
                    Outstanding
                  </div>
                  <div className="text-3xl font-black text-purple-600">{data.stats.totalCreditsOutstanding}</div>
                  <div className="text-xs text-slate-400">credits held</div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm col-span-1">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5" />
                    With credits
                  </div>
                  <div className="text-3xl font-black text-emerald-600">{data.stats.usersWithCredits}</div>
                  <div className="text-xs text-slate-400">users</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent usage */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-500" />
                  Recent Usage
                  <span className="text-xs font-normal text-slate-400 ml-1">last 100 events</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.recentUsage.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No tailor activity yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">User</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Job Title</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Scope</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Aggressiveness</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentUsage.map((row, i) => (
                          <tr
                            key={row.id}
                            className={`border-b border-slate-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-purple-50/30 transition-colors`}
                          >
                            <td className="px-4 py-2.5 text-slate-700 font-medium max-w-[180px] truncate">{userLabel(row)}</td>
                            <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate">{row.job_title || <span className="text-slate-300 italic">—</span>}</td>
                            <td className="px-4 py-2.5 text-slate-600">{scopeLabel(row.scope)}</td>
                            <td className="px-4 py-2.5">{aggressivenessLabel(row.aggressiveness)}</td>
                            <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap text-xs">{fmtDate(row.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Credit balances */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-500" />
                  Credit Balances
                  <span className="text-xs font-normal text-slate-400 ml-1">paid & active users</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.creditBalances.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No paid users yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">User</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Plan</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Credits left</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Total used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.creditBalances.map((row, i) => (
                          <tr
                            key={row.user_id}
                            className={`border-b border-slate-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-purple-50/30 transition-colors`}
                          >
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-slate-700 truncate max-w-[200px]">{userLabel(row)}</div>
                              {row.email && userLabel(row) !== row.email && (
                                <div className="text-xs text-slate-400 truncate max-w-[200px]">{row.email}</div>
                              )}
                            </td>
                            <td className="px-4 py-2.5">{planBadge(row.plan)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`font-bold ${row.resume_tailoring_credits > 0 ? "text-purple-700" : "text-slate-300"}`}>
                                {row.resume_tailoring_credits}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-600 font-medium">{row.total_used}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
