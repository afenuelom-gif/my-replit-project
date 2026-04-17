import React from "react";
import { Link } from "wouter";
import AppFooter from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";
import { ProductPreview } from "@/components/ProductPreview";

interface HomeProps {
  authMenu?: React.ReactNode;
  authMobileMenu?: React.ReactNode;
}

export default function Home({ authMenu, authMobileMenu }: HomeProps) {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col relative overflow-hidden">
      {/* Subtle light gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,_var(--tw-gradient-stops))] from-blue-100 via-background to-background pointer-events-none" />

      <AppHeader right={authMenu} mobileMenuExtra={authMobileMenu} />

      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-24">
        <div className="flex justify-center mb-6">
          <img
            src="/logo.png"
            alt="PrepInterv AI"
            className="h-20 w-20 rounded-3xl shadow-xl shadow-blue-200 object-cover ring-2 ring-blue-100"
          />
        </div>

        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-sm text-blue-700 font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Free trial — no credit card required
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl text-slate-900">
          Practice interviews.{" "}
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Land the job.
          </span>
        </h1>

        <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
          Sit down with 2–3 AI interviewers who ask real questions based on your role and background. Get a detailed performance report when you're done.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mt-8">
          {["Voice-powered AI interviewers", "Personalised questions", "Detailed performance report"].map(f => (
            <span key={f} className="text-xs bg-white border border-slate-200 text-slate-600 rounded-full px-3 py-1.5 shadow-sm">
              {f}
            </span>
          ))}
        </div>

        <div className="mt-10 w-full">
          <ProductPreview />
        </div>

        <Link
          href="/start"
          className="mt-10 w-full max-w-sm mx-auto block text-center py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm transition-all hover:scale-[1.02] shadow-lg shadow-blue-200"
        >
          Start your free session
        </Link>
        <p className="mt-3 text-xs text-slate-400">
          Sign up in seconds. First session free.{" "}
          <Link href="/pricing" className="text-slate-500 underline underline-offset-2 hover:text-slate-800 transition-colors">
            See plans
          </Link>
        </p>
      </section>
      <AppFooter />
    </div>
  );
}
