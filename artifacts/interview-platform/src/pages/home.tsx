import React from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/AppHeader";
import { ProductPreview } from "@/components/ProductPreview";

interface HomeProps {
  authMenu?: React.ReactNode;
}

export default function Home({ authMenu }: HomeProps) {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/25 via-background to-background pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-900/10 rounded-full blur-3xl pointer-events-none" />

      <AppHeader right={authMenu} />

      {/* ── Hero Section ── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-24">
        <div className="flex justify-center mb-6">
          <img
            src="/logo.png"
            alt="Ocranity AI"
            className="h-20 w-20 rounded-3xl shadow-2xl shadow-blue-500/20 object-cover"
          />
        </div>

        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Free trial — no credit card required
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl">
          <span className="text-white">Practice interviews.</span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Land the job.
          </span>
        </h1>

        <p className="mt-5 text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Sit down with 2–3 AI interviewers who ask real questions based on your role and background. Get a detailed performance report when you're done.
        </p>

        <div className="mt-10 w-full">
          <ProductPreview />
        </div>

        <Link
          href="/start"
          className="mt-10 w-full max-w-sm mx-auto block text-center py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm transition-all hover:scale-[1.02] shadow-lg shadow-blue-500/20"
        >
          Start your free session
        </Link>
        <p className="mt-3 text-xs text-zinc-600">
          Sign up in seconds. First session free.{" "}
          <Link href="/pricing" className="text-zinc-500 underline underline-offset-2 hover:text-zinc-300 transition-colors">
            See plans
          </Link>
        </p>
      </section>
    </div>
  );
}
