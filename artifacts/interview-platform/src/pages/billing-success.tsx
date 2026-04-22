import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, Loader2, Crown, Zap, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

interface BillingSuccessProps {
  authMenu?: React.ReactNode;
  authMobileMenu?: React.ReactNode;
}

export default function BillingSuccess({ authMenu, authMobileMenu }: BillingSuccessProps) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [syncing, setSyncing] = useState(true);
  const [result, setResult] = useState<{ plan?: string; type?: string; resumeTailoringCredits?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function syncPlan() {
      try {
        const params = new URLSearchParams(search);
        const sessionId = params.get("session_id");

        const res = await fetch("/api/stripe/sync-user-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) throw new Error("Failed to sync plan");
        const data = await res.json() as { plan?: string; type?: string; resumeTailoringCredits?: number };
        setResult(data);
      } catch (err) {
        setError("Could not sync your subscription — please refresh the page.");
        console.error(err);
      } finally {
        setSyncing(false);
      }
    }
    syncPlan();
  }, [search]);

  const plan = result?.plan;
  const type = result?.type;
  const isTopUp = type === "topup";
  const isPro = plan === "pro";

  return (
    <div className="min-h-screen w-full bg-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-500/30 blur-[90px]" />
        <div className="absolute -top-20 -left-40 w-[500px] h-[500px] rounded-full bg-purple-500/25 blur-[80px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[60vh] bg-gradient-to-b from-blue-100/80 via-purple-50/30 to-transparent pointer-events-none" />

      <AppHeader right={authMenu} mobileMenuExtra={authMobileMenu} />

      <main className="flex-1 flex flex-col items-center justify-center z-10 px-6 py-16">
        <div className="max-w-md w-full text-center space-y-8">

          {syncing ? (
            <div className="space-y-4">
              <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto" />
              <h1 className="text-2xl font-bold text-slate-900">Setting up your account…</h1>
              <p className="text-slate-500">Activating your plan, just a moment.</p>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-9 h-9 text-yellow-500" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Payment received!</h1>
              <p className="text-slate-500 text-sm">{error}</p>
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                Refresh
              </Button>
            </div>
          ) : isTopUp ? (
            <div className="space-y-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                <Gift className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 text-sm text-emerald-700 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Credits added
                </div>
                <h1 className="text-3xl font-bold text-slate-900">Top-up complete!</h1>
                <p className="text-slate-500">
                  Your resume tailoring credits have been added to your account.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => setLocation("/resume-tailor")}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-lg"
                >
                  Tailor a resume now
                </Button>
                <Button onClick={() => setLocation("/start")} variant="outline" className="w-full">
                  Start an interview
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg ${isPro ? "bg-gradient-to-br from-blue-600 to-purple-700" : "bg-gradient-to-br from-blue-500 to-blue-600"}`}>
                {isPro
                  ? <Crown className="w-10 h-10 text-yellow-300" />
                  : <Zap className="w-10 h-10 text-white" />
                }
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 text-sm text-emerald-700 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Subscription activated
                </div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Welcome to {isPro ? "Pro" : "Starter"}!
                </h1>
                <p className="text-slate-500">
                  {isPro
                    ? "You now have unlimited interview sessions and 3 resume tailors per month."
                    : "You now have 4 interview sessions and 1 resume tailor per month."}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => setLocation("/start")}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg"
                >
                  Start an interview
                </Button>
                <Button
                  onClick={() => setLocation("/resume-tailor")}
                  variant="outline"
                  className="w-full"
                >
                  Tailor a resume
                </Button>
              </div>
            </div>
          )}

        </div>
      </main>
      <AppFooter />
    </div>
  );
}
