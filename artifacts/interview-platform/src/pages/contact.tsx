import React, { useState } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MessageSquare, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

interface ContactProps {
  authMenu?: React.ReactNode;
  authMobileMenu?: React.ReactNode;
}

export default function Contact({ authMenu, authMobileMenu }: ContactProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/interview/sessions/0/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          questionRelevance: "somewhat_relevant",
          feedbackHelpful: true,
          additionalComments: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
        }),
      });
      if (!res.ok) throw new Error("FAILED");
      setSubmitted(true);
    } catch {
      setError("We couldn't send your message right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-blue-500/35 blur-[80px]" />
        <div className="absolute -top-16 -left-32 w-[400px] h-[400px] rounded-full bg-purple-500/30 blur-[70px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-blue-100/90 via-purple-50/40 to-transparent pointer-events-none" />

      <AppHeader right={authMenu} mobileMenuExtra={authMobileMenu} />

      <main className="flex-1 flex flex-col items-center z-10 px-6 py-16">
        <div className="max-w-4xl w-full space-y-12">

          <div className="text-center space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              <span className="text-slate-900">Get in </span>
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">touch</span>
            </h1>
            <p className="text-slate-500 max-w-md mx-auto">
              Have a question, feedback, or need help? We'd love to hear from you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">

            <div className="md:col-span-2 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Email us</div>
                    <div className="text-sm text-slate-500 mt-0.5">hello@prepinterv.com</div>
                    <div className="text-xs text-slate-400 mt-1">We aim to reply within 24 hours.</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Feedback</div>
                    <div className="text-sm text-slate-500 mt-0.5">Found a bug or have a feature idea?</div>
                    <div className="text-xs text-slate-400 mt-1">We read every message and take them seriously.</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Helpful links</div>
                <div className="space-y-2">
                  <Link href="/pricing" className="flex items-center text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">
                    → Pricing plans
                  </Link>
                  <Link href="/start" className="flex items-center text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">
                    → Start a free session
                  </Link>
                  <Link href="/" className="flex items-center text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors">
                    → Back to home
                  </Link>
                </div>
              </div>
            </div>

            <div className="md:col-span-3">
              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              {submitted ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-5 py-16 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xl font-semibold text-slate-900">Message sent</div>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto">
                      Thanks for reaching out, {name.split(" ")[0]}. We'll get back to you at {email} within 24 hours.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-slate-300 text-slate-600 hover:bg-slate-50 mt-2"
                    onClick={() => {
                      setSubmitted(false);
                      setName(""); setEmail(""); setSubject(""); setMessage("");
                    }}
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8 space-y-5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                        Name <span className="text-destructive">*</span>
                      </Label>
                      <Input id="name" placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input id="email" type="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-sm font-medium text-slate-700">
                      Subject <span className="text-destructive">*</span>
                    </Label>
                    <Input id="subject" placeholder="e.g. Question about pricing" value={subject} onChange={(e) => setSubject(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm font-medium text-slate-700">
                      Message <span className="text-destructive">*</span>
                    </Label>
                    <Textarea id="message" placeholder="Tell us what's on your mind…" value={message} onChange={(e) => setMessage(e.target.value)} required rows={5} className="resize-none" />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full h-11 font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0 text-white transition-all hover:scale-[1.01]">
                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : "Send message"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
