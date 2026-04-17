import { useEffect } from "react";
import { Link } from "wouter";
import AppFooter from "@/components/AppFooter";

export default function Privacy() {
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-white/5 px-6 py-4">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">← Back to PrepInterv AI</Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-zinc-500 text-sm">Last updated: April 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">1. What we collect</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            When you use PrepInterv AI we collect the information you provide directly — including your name, email address (via Clerk authentication), job role, resume text, and job description text. These are used to personalise your interview questions and are automatically deleted from our database as soon as your performance report is generated. During interview sessions your spoken answers are recorded locally, sent for transcription, and the resulting text transcript is stored against your session. The raw audio is processed in real time and is not retained. Your camera is used during sessions to assess posture — individual frames are analysed on the fly and only a posture score and brief text note are stored; no images or video footage are ever saved. We also collect session metadata such as duration, question history, and AI-generated performance scores.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">2. How we use your data</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Your data is used solely to operate the service — generating interview questions personalised to your role and background, transcribing your spoken answers, and producing your performance report. We do not sell your personal data to third parties.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">3. Third-party services</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            We use the following third-party services to deliver the platform:
          </p>
          <ul className="list-disc list-inside text-zinc-400 text-sm space-y-1 ml-2">
            <li><span className="text-zinc-300">Clerk</span> — authentication and account management</li>
            <li><span className="text-zinc-300">OpenAI</span> — AI question generation and answer analysis</li>
            <li><span className="text-zinc-300">ElevenLabs</span> — text-to-speech voice synthesis</li>
          </ul>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Each provider processes data under their own privacy policies. Audio and text content is transmitted to these providers to fulfil your requests and is not retained by them beyond their standard processing windows.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">4. Session recordings</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Audio captured during your interview session is streamed to our transcription provider in real time. Only the resulting text transcript is stored — the raw audio is never written to our database or any persistent storage. Your camera is used solely for posture analysis; individual frames are processed on the fly and immediately discarded — no images or video footage are stored at any point. Transcripts and posture scores are associated with your account to generate your performance report and allow you to review your session history. You may request deletion of your session data at any time by contacting us.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">5. Data retention</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Session data is retained for as long as your account is active. If you delete your account, your personal data and session history will be removed within 30 days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">6. Your rights</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            You have the right to access, correct, or delete your personal data. To exercise these rights, please contact us at <a href="mailto:hello@prepinterv.com" className="text-primary hover:underline">hello@prepinterv.com</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">7. Changes to this policy</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on the platform or sending an email to the address associated with your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">8. Contact</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            For any privacy-related questions, contact us at <a href="mailto:hello@prepinterv.com" className="text-primary hover:underline">hello@prepinterv.com</a>.
          </p>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
