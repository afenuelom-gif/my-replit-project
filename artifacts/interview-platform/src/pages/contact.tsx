import React, { useState } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MessageSquare, CheckCircle2, Loader2 } from "lucide-react";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background pointer-events-none" />

      <AppHeader right={authMenu} mobileMenuExtra={authMobileMenu} />

      <main className="flex-1 flex flex-col items-center z-10 px-6 py-16">
        <div className="max-w-4xl w-full space-y-12">

          <div className="text-center space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
              Get in touch
            </h1>
            <p className="text-zinc-400 max-w-md mx-auto">
              Have a question, feedback, or need help? We'd love to hear from you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">

            <div className="md:col-span-2 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Email us</div>
                    <div className="text-sm text-zinc-500 mt-0.5">hello@prepinterv.ai</div>
                    <div className="text-xs text-zinc-600 mt-1">We aim to reply within 24 hours.</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Feedback</div>
                    <div className="text-sm text-zinc-500 mt-0.5">Found a bug or have a feature idea?</div>
                    <div className="text-xs text-zinc-600 mt-1">We read every message and take them seriously.</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 pt-6 space-y-3">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Helpful links</div>
                <div className="space-y-2">
                  <Link href="/pricing" className="flex items-center text-sm text-zinc-400 hover:text-white transition-colors">
                    → Pricing plans
                  </Link>
                  <Link href="/start" className="flex items-center text-sm text-zinc-400 hover:text-white transition-colors">
                    → Start a free session
                  </Link>
                  <Link href="/" className="flex items-center text-sm text-zinc-400 hover:text-white transition-colors">
                    → Back to home
                  </Link>
                </div>
              </div>
            </div>

            <div className="md:col-span-3">
              {submitted ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-5 py-16 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xl font-semibold text-white">Message sent</div>
                    <p className="text-sm text-zinc-400 max-w-xs mx-auto">
                      Thanks for reaching out, {name.split(" ")[0]}. We'll get back to you at {email} within 24 hours.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-white/20 text-zinc-300 hover:bg-white/10 hover:text-white mt-2"
                    onClick={() => {
                      setSubmitted(false);
                      setName("");
                      setEmail("");
                      setSubject("");
                      setMessage("");
                    }}
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 space-y-5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium text-zinc-300">
                        Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Jane Smith"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="bg-black/40 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-zinc-300">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="jane@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-black/40 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-sm font-medium text-zinc-300">
                      Subject <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="subject"
                      placeholder="e.g. Question about pricing"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                      className="bg-black/40 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm font-medium text-zinc-300">
                      Message <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us what's on your mind…"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      rows={5}
                      className="bg-black/40 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-primary resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0 text-white transition-all hover:scale-[1.01]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Send message"
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
