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
    <div className="min-h-screen w-full bg-white flex flex-col relative overflow-hidden">

      {/* Rich gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full bg-blue-500/35 blur-[90px]" />
        <div className="absolute -top-32 -left-48 w-[600px] h-[600px] rounded-full bg-purple-500/30 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] rounded-full bg-indigo-400/20 blur-[110px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full bg-cyan-400/20 blur-[80px]" />
      </div>

      {/* Top gradient wash */}
      <div className="absolute top-0 left-0 right-0 h-[70vh] bg-gradient-to-b from-blue-100/90 via-purple-50/40 to-transparent pointer-events-none" />

      <AppHeader right={authMenu} mobileMenuExtra={authMobileMenu} />

      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-24">
        <div className="flex justify-center mb-6">
          <img
            src="/logo.png"
            alt="PrepInterv AI"
            className="h-20 w-20 rounded-3xl shadow-2xl shadow-blue-300/50 object-cover ring-2 ring-blue-200"
          />
        </div>

        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-full px-4 py-1.5 text-sm text-blue-700 font-medium mb-6 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Free trial — no credit card required
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl text-slate-900">
          Practice interviews.{" "}
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Land the job.
          </span>
        </h1>

        <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
          Sit down with 2–3 AI interviewers who ask real questions based on your role and background. Get a detailed performance report when you're done.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mt-8">
          {["Voice-powered AI interviewers", "Personalised questions", "Detailed performance report"].map(f => (
            <span key={f} className="text-xs bg-white/80 border border-blue-100 text-slate-600 rounded-full px-3 py-1.5 shadow-sm backdrop-blur-sm">
              {f}
            </span>
          ))}
        </div>

        <div className="mt-10 w-full">
          <ProductPreview />
        </div>

        <Link
          href="/start"
          className="mt-10 w-full max-w-sm mx-auto block text-center py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all hover:scale-[1.02] shadow-xl shadow-blue-400/30"
        >
          Start your free session
        </Link>
        <p className="mt-3 text-sm text-slate-500">
          Sign up in seconds. First session free.{" "}
          <Link href="/pricing" className="text-blue-600 font-medium hover:text-blue-800 underline underline-offset-2 transition-colors">
            See plans
          </Link>
        </p>
      </section>
      <AppFooter />
    </div>
  );
}
