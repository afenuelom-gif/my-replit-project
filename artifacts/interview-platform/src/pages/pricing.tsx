import { useLocation } from "wouter";
import { Check, Zap, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";

interface PricingProps {
  authMenu?: React.ReactNode;
}

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
];

const PRO_FEATURES = [
  "Unlimited sessions (up to 45 min each)",
  "2–3 AI interviewers with voice",
  "Full performance reports",
  "Questions personalized to your role & background",
  "Question history",
  "Priority processing",
];

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
      <span className="text-sm text-zinc-300">{text}</span>
    </li>
  );
}

export default function Pricing({ authMenu }: PricingProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background pointer-events-none" />

      <AppHeader right={authMenu} />

      <main className="flex-1 flex flex-col items-center z-10 px-6 py-16">
        <div className="max-w-5xl w-full space-y-12">

          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              Simple, honest pricing
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
              Ace your next interview
            </h1>
            <p className="text-lg text-zinc-400 max-w-xl mx-auto">
              Practice with AI interviewers that ask real questions based on your role and experience. No commitment to start.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">

            <div className="relative flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-7 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-zinc-400" />
                  <h2 className="text-lg font-semibold text-white">Free Trial</h2>
                </div>
                <p className="text-zinc-500 text-sm">Try it once, no card needed</p>
              </div>

              <div>
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-zinc-500 text-sm ml-2">one session</span>
              </div>

              <ul className="space-y-3 flex-1">
                {FREE_FEATURES.map((f) => (
                  <FeatureItem key={f} text={f} />
                ))}
              </ul>

              <Button
                onClick={() => setLocation("/")}
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                Start free session
              </Button>
            </div>

            <div className="relative flex flex-col rounded-2xl border border-blue-500/40 bg-gradient-to-b from-blue-950/40 to-black/40 backdrop-blur-sm p-7 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">Starter</h2>
                </div>
                <p className="text-zinc-500 text-sm">A few interviews coming up</p>
              </div>

              <div>
                <span className="text-4xl font-bold text-white">$12</span>
                <span className="text-zinc-500 text-sm ml-2">/ month</span>
              </div>

              <ul className="space-y-3 flex-1">
                {STARTER_FEATURES.map((f) => (
                  <FeatureItem key={f} text={f} />
                ))}
              </ul>

              <Button
                onClick={() => setLocation("/sign-up")}
                variant="outline"
                className="w-full border-blue-500/50 text-blue-300 hover:bg-blue-500/10"
              >
                Get started
              </Button>
            </div>

            <div className="relative flex flex-col rounded-2xl border border-purple-500/50 bg-gradient-to-b from-purple-950/40 to-black/40 backdrop-blur-sm p-7 space-y-6">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most popular
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-semibold text-white">Pro</h2>
                </div>
                <p className="text-zinc-500 text-sm">Active job search mode</p>
              </div>

              <div>
                <span className="text-4xl font-bold text-white">$24</span>
                <span className="text-zinc-500 text-sm ml-2">/ month</span>
              </div>

              <ul className="space-y-3 flex-1">
                {PRO_FEATURES.map((f) => (
                  <FeatureItem key={f} text={f} />
                ))}
              </ul>

              <Button
                onClick={() => setLocation("/sign-up")}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0 text-white font-semibold"
              >
                Get Pro
              </Button>
            </div>

          </div>

          <div className="text-center text-sm text-zinc-600">
            Cancel anytime. No hidden fees. Your free trial session does not require a credit card.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-white/5 pt-12">
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-white">2–3</div>
              <div className="text-sm text-zinc-500">AI interviewers per session</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-white">45 min</div>
              <div className="text-sm text-zinc-500">Maximum session length</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-white">Real-time</div>
              <div className="text-sm text-zinc-500">Voice & performance feedback</div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
