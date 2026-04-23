import { useLocation } from "wouter";
import { Check, Zap, Crown, Sparkles, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import React, { useState } from "react";

interface PricingProps {
  authMenu?: React.ReactNode;
  authMobileMenu?: React.ReactNode;
  isSignedIn?: boolean;
}

const STARTER_PRICE_ID = "price_1TP7dFRtEcuSwbZwGirNXwpc";
const PRO_PRICE_ID = "price_1TP7dZRtEcuSwbZw0Sb4ywUP";

const TOPUP_PACKS = [
  { priceId: "price_1TP7dnRtEcuSwbZwinKg4z5b", credits: 1, price: "$3", label: "1 tailor credit" },
  { priceId: "price_1TP7doRtEcuSwbZwAslgIUPe", credits: 3, price: "$7", label: "3 tailor credits", popular: true },
  { priceId: "price_1TP7dnRtEcuSwbZwHAftqQp5", credits: 10, price: "$20", label: "10 tailor credits" },
];

const FREE_FEATURES = [
  "1 session, up to 15 minutes",
  "2–3 AI interviewers with voice",
  "Full performance report",
  "Questions personalized to your role & background",
  "No credit card required",
];

const STARTER_FEATURES = [
  "4 sessions per month (up to 45 min each)",
  "2–3 AI interviewers with voice",
  "Full performance reports",
  "Questions personalized to your role & background",
  "Question history",
  "1 AI resume tailor per month",
];

const PRO_FEATURES = [
  "Unlimited sessions (up to 45 min each)",
  "2–3 AI interviewers with voice",
  "Full performance reports",
  "Questions personalized to your role & background",
  "Question history",
  "3 AI resume tailors per month",
  "Early access to new features",
];

function FeatureItem({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${dark ? "text-emerald-300" : "text-emerald-500"}`} />
      <span className={`text-sm ${dark ? "text-blue-50" : "text-slate-600"}`}>{text}</span>
    </li>
  );
}

async function startCheckout(priceId: string, type: "subscription" | "topup" = "subscription"): Promise<void> {
  const endpoint = type === "topup" ? "/api/stripe/checkout/topup" : "/api/stripe/checkout/subscription";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceId }),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? "Failed to start checkout");
  }
  const data = await res.json() as { url?: string };
  if (data.url) window.location.href = data.url;
}

export default function Pricing({ authMenu, authMobileMenu, isSignedIn }: PricingProps) {
  const [, setLocation] = useLocation();
  const [loadingStarter, setLoadingStarter] = useState(false);
  const [loadingPro, setLoadingPro] = useState(false);
  const [loadingTopUp, setLoadingTopUp] = useState<string | null>(null);

  async function handleStarterClick() {
    if (!isSignedIn) { setLocation("/sign-up"); return; }
    setLoadingStarter(true);
    try { await startCheckout(STARTER_PRICE_ID); }
    catch (err) { console.error(err); }
    finally { setLoadingStarter(false); }
  }

  async function handleProClick() {
    if (!isSignedIn) { setLocation("/sign-up"); return; }
    setLoadingPro(true);
    try { await startCheckout(PRO_PRICE_ID); }
    catch (err) { console.error(err); }
    finally { setLoadingPro(false); }
  }

  async function handleTopUpClick(priceId: string) {
    if (!isSignedIn) { setLocation("/sign-up"); return; }
    setLoadingTopUp(priceId);
    try { await startCheckout(priceId, "topup"); }
    catch (err) { console.error(err); }
    finally { setLoadingTopUp(null); }
  }

  return (
    <div className="min-h-screen w-full bg-white flex flex-col relative overflow-hidden">

      {/* Rich gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-blue-500/35 blur-[90px]" />
        <div className="absolute -top-20 -left-40 w-[500px] h-[500px] rounded-full bg-purple-500/30 blur-[80px]" />
        <div className="absolute top-2/3 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-indigo-400/20 blur-[80px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[60vh] bg-gradient-to-b from-blue-100/90 via-purple-50/40 to-transparent pointer-events-none" />

      <AppHeader right={authMenu} mobileMenuExtra={authMobileMenu} />

      <main className="flex-1 flex flex-col items-center z-10 px-6 py-16">
        <div className="max-w-5xl w-full space-y-12">

          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-full px-4 py-1.5 text-sm text-blue-700 font-medium shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Simple, honest pricing
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
              Ace your next interview
            </h1>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Practice with AI interviewers that ask real questions based on your role and experience. No commitment to start.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">

            {/* Free */}
            <div className="relative flex flex-col rounded-2xl border border-slate-200 bg-white shadow-md p-7 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-slate-400" />
                  <h2 className="text-lg font-semibold text-slate-900">Free Trial</h2>
                </div>
                <p className="text-slate-500 text-sm">Try it once, no card needed</p>
              </div>
              <div>
                <span className="text-4xl font-bold text-slate-900">$0</span>
                <span className="text-slate-400 text-sm ml-2">one session</span>
              </div>
              <ul className="space-y-3 flex-1">
                {FREE_FEATURES.map((f) => <FeatureItem key={f} text={f} />)}
              </ul>
              <Button onClick={() => setLocation("/")} variant="outline" className="w-full border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                Start free session
              </Button>
            </div>

            {/* Starter */}
            <div className="relative flex flex-col rounded-2xl border border-blue-200 bg-white shadow-lg shadow-blue-100/60 p-7 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-semibold text-slate-900">Starter</h2>
                </div>
                <p className="text-slate-500 text-sm">A few interviews coming up</p>
              </div>
              <div>
                <span className="text-4xl font-bold text-slate-900">$12</span>
                <span className="text-slate-400 text-sm ml-2">/ month</span>
              </div>
              <ul className="space-y-3 flex-1">
                {STARTER_FEATURES.map((f) => <FeatureItem key={f} text={f} />)}
              </ul>
              <Button
                onClick={handleStarterClick}
                disabled={loadingStarter}
                variant="outline"
                className="w-full border-blue-400 text-blue-700 hover:bg-blue-50 hover:text-blue-900 disabled:opacity-60"
              >
                {loadingStarter ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Get started
              </Button>
            </div>

            {/* Pro — gradient card */}
            <div className="relative flex flex-col rounded-2xl border border-transparent bg-gradient-to-b from-blue-600 to-purple-700 shadow-2xl shadow-blue-400/30 p-7 pt-9 space-y-6 text-white">
              {/* inner shine */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none rounded-2xl" />
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-indigo-400/20 blur-2xl pointer-events-none" />

              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-white text-purple-700 text-xs font-bold px-3 py-1 rounded-full shadow-md">
                  Most popular
                </span>
              </div>
              <div className="space-y-2 relative z-10 pt-2">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-300" />
                  <h2 className="text-lg font-semibold text-white">Pro</h2>
                </div>
                <p className="text-blue-100 text-sm">Active job search mode</p>
              </div>
              <div className="relative z-10">
                <span className="text-4xl font-bold text-white">$24</span>
                <span className="text-blue-200 text-sm ml-2">/ month</span>
              </div>
              <ul className="space-y-3 flex-1 relative z-10">
                {PRO_FEATURES.map((f) => <FeatureItem key={f} text={f} dark />)}
              </ul>
              <Button
                onClick={handleProClick}
                disabled={loadingPro}
                className="relative z-10 w-full bg-white hover:bg-blue-50 text-purple-700 font-bold border-0 shadow-lg hover:text-purple-900 transition-colors disabled:opacity-60"
              >
                {loadingPro ? <Loader2 className="w-4 h-4 animate-spin mr-2 text-purple-700" /> : null}
                Get Pro
              </Button>
            </div>

          </div>

          <div className="text-center text-sm text-slate-400">
            Cancel anytime. No hidden fees. Your free trial session does not require a credit card.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-slate-200 pt-12">
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">2–3</div>
              <div className="text-sm text-slate-500">AI interviewers per session</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">45 min</div>
              <div className="text-sm text-slate-500">Maximum session length</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Real-time</div>
              <div className="text-sm text-slate-500">Voice & performance feedback</div>
            </div>
          </div>

          {/* Top-up packs */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-base font-semibold text-slate-900">Need more Resume Tailors?</h2>
                </div>
                <p className="text-sm text-slate-500">One-time purchase — credits never expire and stack on top of your plan.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TOPUP_PACKS.map((pack) => (
                <div
                  key={pack.priceId}
                  className={`relative flex flex-col items-center gap-3 rounded-xl border bg-white p-5 shadow-sm text-center ${pack.popular ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"}`}
                >
                  {pack.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                      Best value
                    </span>
                  )}
                  <div className="text-3xl font-bold text-slate-900">{pack.price}</div>
                  <div className="text-sm font-medium text-slate-700">{pack.label}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingTopUp === pack.priceId}
                    onClick={() => handleTopUpClick(pack.priceId)}
                    className={`w-full mt-1 ${pack.popular ? "border-indigo-400 text-indigo-700 hover:bg-indigo-50" : "border-slate-300 text-slate-700 hover:bg-slate-50"} disabled:opacity-60`}
                  >
                    {loadingTopUp === pack.priceId ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    {isSignedIn ? "Buy now" : "Sign up to buy"}
                  </Button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
      <AppFooter />
    </div>
  );
}
