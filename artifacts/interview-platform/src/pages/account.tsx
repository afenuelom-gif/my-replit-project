import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Zap, Calendar, AlertTriangle, CheckCircle, ExternalLink, Loader2, RotateCcw, XCircle, CreditCard, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppHeader } from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { useAuthActions } from "@/contexts/auth-actions";

interface AccountPageProps {
  authMenu?: React.ReactNode;
  authMobileMenu?: React.ReactNode;
}

interface UserMe {
  plan: string;
  sessionCredits: number;
  resumeTailoringCredits: number;
  trialUsed: boolean;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
}

interface SubscriptionData {
  plan: string;
  sessionCredits: number;
  resumeTailoringCredits: number;
  subscription: {
    id: string;
    status: string;
    cancel_at_period_end: boolean;
    current_period_end: number;
    current_period_start: number;
    items: { data: Array<{ price: { id: string; unit_amount: number | null; currency: string } }> };
  } | null;
}

const PLAN_LIMITS: Record<string, { sessions: number | null; tailors: number | null; label: string }> = {
  free:    { sessions: 1,    tailors: 0,    label: "Free Trial" },
  starter: { sessions: 4,    tailors: 1,    label: "Starter" },
  pro:     { sessions: null, tailors: 3,    label: "Pro" },
};

function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function AccountPage({ authMenu, authMobileMenu }: AccountPageProps) {
  const [, setLocation] = useLocation();
  const { getAuthHeaders } = useAuthActions();
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: me, isLoading: meLoading } = useQuery<UserMe>({
    queryKey: ["users-me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me", { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json() as Promise<UserMe>;
    },
    retry: false,
  });

  const { data: sub, isLoading: subLoading } = useQuery<SubscriptionData>({
    queryKey: ["stripe-subscription"],
    queryFn: async () => {
      const res = await fetch("/api/stripe/subscription", { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load subscription");
      return res.json() as Promise<SubscriptionData>;
    },
    enabled: !!me,
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stripe/cancel", { method: "POST", headers: await getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      setConfirmCancel(false);
      qc.invalidateQueries({ queryKey: ["stripe-subscription"] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stripe/reactivate", { method: "POST", headers: await getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to reactivate");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stripe-subscription"] });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stripe/portal", { method: "POST", headers: await getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to open portal");
      const data = await res.json() as { url: string };
      return data.url;
    },
    onSuccess: (url) => { window.location.href = url; },
  });

  const isLoading = meLoading || subLoading;
  const plan = me?.plan ?? "free";
  const planInfo = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const subscription = sub?.subscription;
  const isCancelledAtEnd = subscription?.cancel_at_period_end ?? false;
  const periodEnd = subscription?.current_period_end;
  const isPro = plan === "pro";
  const isStarter = plan === "starter";
  const hasSub = !!subscription;

  const sessionCredits = me?.sessionCredits ?? 0;
  const resumeCredits = me?.resumeTailoringCredits ?? 0;

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col">
      <AppHeader right={authMenu} mobileMenuExtra={authMobileMenu} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Account & Billing</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your subscription and credits</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* Cancellation banner */}
            {isCancelledAtEnd && periodEnd && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Subscription ending</p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    Your {planInfo.label} plan is active until <strong>{fmt(periodEnd)}</strong>. After that your account will revert to Free.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0"
                  onClick={() => reactivateMutation.mutate()}
                  disabled={reactivateMutation.isPending}
                >
                  {reactivateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Keep plan"}
                </Button>
              </div>
            )}

            {/* Plan card */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-slate-700">
                  {isPro ? <Crown className="w-4.5 h-4.5 text-yellow-500" /> : <Zap className="w-4.5 h-4.5 text-blue-500" />}
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl font-bold ${isPro ? "text-purple-700" : isStarter ? "text-blue-700" : "text-slate-600"}`}>
                        {planInfo.label}
                      </span>
                      {hasSub && !isCancelledAtEnd && (
                        <span className="text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Active</span>
                      )}
                    </div>
                    {hasSub && periodEnd && !isCancelledAtEnd && (
                      <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Next billing: {fmt(periodEnd)}
                      </p>
                    )}
                    {!hasSub && plan === "free" && (
                      <p className="text-sm text-slate-500 mt-1">Upgrade to get more sessions and features</p>
                    )}
                  </div>
                  {!hasSub && (
                    <Button
                      onClick={() => setLocation("/pricing")}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
                      size="sm"
                    >
                      Upgrade
                    </Button>
                  )}
                </div>

                {/* Credits */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <div className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1">Interview Sessions</div>
                    <div className="flex items-baseline gap-1">
                      {isPro ? (
                        <span className="text-2xl font-black text-blue-700">∞</span>
                      ) : (
                        <>
                          <span className="text-2xl font-black text-blue-700">{sessionCredits}</span>
                          {planInfo.sessions !== null && (
                            <span className="text-sm text-blue-400">/ {planInfo.sessions} this month</span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-blue-400 mt-1">
                      {isPro ? "Unlimited sessions" : `${sessionCredits} session${sessionCredits !== 1 ? "s" : ""} remaining`}
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-xl p-4">
                    <div className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-1">Resume Tailors</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-purple-700">{resumeCredits}</span>
                      {planInfo.tailors !== null && (
                        <span className="text-sm text-purple-400">/ {planInfo.tailors} this month</span>
                      )}
                    </div>
                    <div className="text-xs text-purple-400 mt-1">
                      {resumeCredits === 0 ? "Buy a top-up pack" : `${resumeCredits} tailor${resumeCredits !== 1 ? "s" : ""} remaining`}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  {hasSub && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-slate-200 text-slate-600"
                      onClick={() => portalMutation.mutate()}
                      disabled={portalMutation.isPending}
                    >
                      {portalMutation.isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CreditCard className="w-3.5 h-3.5" />}
                      Manage billing
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-slate-200 text-slate-600"
                    onClick={() => setLocation("/history")}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Interview history
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Top-up pack */}
            {(isStarter || isPro) && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-700">Need more resume tailors?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500 mb-3">Buy a one-time top-up pack — credits never expire.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/pricing")}
                    className="border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    View top-up packs
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Cancel section */}
            {hasSub && !isCancelledAtEnd && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-700">Cancel subscription</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-500">
                    You can cancel any time. You'll keep full access until the end of your billing period on <strong>{periodEnd ? fmt(periodEnd) : "your next billing date"}</strong>.
                  </p>
                  {!confirmCancel ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50 gap-1.5"
                      onClick={() => setConfirmCancel(true)}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel subscription
                    </Button>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700 flex-1">Are you sure? You'll lose access on {periodEnd ? fmt(periodEnd) : "your billing date"}.</p>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" className="text-slate-600" onClick={() => setConfirmCancel(false)}>
                          Keep it
                        </Button>
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => cancelMutation.mutate()}
                          disabled={cancelMutation.isPending}
                        >
                          {cancelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Yes, cancel"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Reactivate when cancelled */}
            {hasSub && isCancelledAtEnd && (
              <Card className="border-0 shadow-sm border-amber-100">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <RotateCcw className="w-5 h-5 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">Want to stay?</p>
                      <p className="text-sm text-slate-500">Reactivate your subscription and we'll continue billing as normal.</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shrink-0"
                      onClick={() => reactivateMutation.mutate()}
                      disabled={reactivateMutation.isPending}
                    >
                      {reactivateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reactivate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Free plan upgrade nudge */}
            {plan === "free" && (
              <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-purple-50">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">Ready for more?</p>
                      <p className="text-sm text-slate-500">Starter gives you 4 sessions + 1 resume tailor per month for $12.</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shrink-0"
                      onClick={() => setLocation("/pricing")}
                    >
                      Upgrade
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
