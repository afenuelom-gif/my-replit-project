import { useLocation } from "wouter";
import { useAuthActions } from "@/contexts/auth-actions";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { AdminNav } from "@/components/AdminNav";
import AppFooter from "@/components/AppFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Loader2,
  TrendingUp,
  Users,
  UserMinus,
  ShoppingBag,
  ChevronLeft,
  BarChart3,
  Receipt,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AdminRevenueProps {
  authMenu?: React.ReactNode;
  authMobileMenu?: React.ReactNode;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

interface RecentCharge {
  date: string;
  amount: number;
  description: string;
  type: string;
  status: string;
}

interface RevenueData {
  mrr: number;
  totalRevenue: number;
  totalSubscriptionRevenue: number;
  totalTopUpRevenue: number;
  activeSubscribers: number;
  starterCount: number;
  proCount: number;
  churnedThisMonth: number;
  monthlyRevenue: MonthlyRevenue[];
  recentCharges: RecentCharge[];
}

function fmt(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function typeBadge(type: string) {
  if (type === "Top-up") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Top-up</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Subscription</Badge>;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-sm">
        <p className="font-semibold text-slate-700">{label}</p>
        <p className="text-emerald-700 font-bold">{fmt(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export default function AdminRevenue({ authMenu, authMobileMenu }: AdminRevenueProps) {
  const [, setLocation] = useLocation();
  const { getAuthHeaders } = useAuthActions();

  const { data, isLoading, error } = useQuery<RevenueData>({
    queryKey: ["admin-revenue"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/users/admin/revenue", {
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
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Revenue
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Live data pulled from Stripe — last 100 invoices</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        )}

        {error && (
          <div className="text-center py-16 text-slate-400">Failed to load revenue data.</div>
        )}

        {data && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm sm:col-span-1">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    MRR
                  </div>
                  <div className="text-3xl font-black text-emerald-700">{fmt(data.mrr)}</div>
                  <div className="text-xs text-slate-400">monthly recurring</div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm sm:col-span-1">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <DollarSign className="w-3.5 h-3.5 text-blue-500" />
                    Total revenue
                  </div>
                  <div className="text-3xl font-black text-slate-900">{fmt(data.totalRevenue)}</div>
                  <div className="flex gap-2 text-xs text-slate-400 flex-wrap">
                    <span>Subs {fmt(data.totalSubscriptionRevenue)}</span>
                    <span>·</span>
                    <span>Top-ups {fmt(data.totalTopUpRevenue)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm sm:col-span-1">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    Subscribers
                  </div>
                  <div className="text-3xl font-black text-blue-700">{data.activeSubscribers}</div>
                  <div className="flex gap-2 text-xs text-slate-400 flex-wrap">
                    <span>{data.starterCount} Starter</span>
                    <span>·</span>
                    <span>{data.proCount} Pro</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm sm:col-span-1">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <UserMinus className="w-3.5 h-3.5 text-rose-500" />
                    Churn (30d)
                  </div>
                  <div className={`text-3xl font-black ${data.churnedThisMonth > 0 ? "text-rose-600" : "text-slate-400"}`}>
                    {data.churnedThisMonth}
                  </div>
                  <div className="text-xs text-slate-400">canceled subs</div>
                </CardContent>
              </Card>
            </div>

            {/* Monthly revenue chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-700 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                  Monthly Revenue
                  <span className="text-xs font-normal text-slate-400 ml-1">last 12 months</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 pb-4">
                {data.monthlyRevenue.every((m) => m.revenue === 0) ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No paid invoices found yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.monthlyRevenue} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => "$" + (v / 100).toFixed(0)}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f0fdf4" }} />
                      <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Recent charges */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-700 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-500" />
                  Recent Payments
                  <span className="text-xs font-normal text-slate-400 ml-1">last 20 paid invoices</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.recentCharges.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No invoices yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Description</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Type</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentCharges.map((charge, i) => (
                          <tr
                            key={i}
                            className={`border-b border-slate-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"} hover:bg-emerald-50/30 transition-colors`}
                          >
                            <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap text-xs">{fmtDate(charge.date)}</td>
                            <td className="px-4 py-2.5 text-slate-600 max-w-[280px] truncate">{charge.description}</td>
                            <td className="px-4 py-2.5">{typeBadge(charge.type)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmt(charge.amount)}</td>
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
