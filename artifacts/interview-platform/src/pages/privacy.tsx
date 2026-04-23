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
            <li><span className="text-zinc-300">Clerk</span> — authentication and account management (development environment)</li>
            <li><span className="text-zinc-300">Auth0</span> — authentication and account management (production environment)</li>
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

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">6. Cookies and local storage</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            We use a small number of cookies and browser local storage entries to operate the service. When you first visit PrepInterv AI, a consent banner lets you choose between essential-only or full acceptance. Your choice is saved in your browser's local storage under the key <code className="text-zinc-300 bg-white/5 px-1 rounded text-xs">cookie_consent</code> and is respected on every subsequent visit.
          </p>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-300">Essential cookies — always active</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              These are necessary for the service to function and cannot be disabled. They do not require your consent under the ePrivacy Directive.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-zinc-400 border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 font-semibold text-zinc-300 whitespace-nowrap">Cookie / key</th>
                    <th className="text-left py-2 pr-4 font-semibold text-zinc-300">Set by</th>
                    <th className="text-left py-2 font-semibold text-zinc-300">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-2 pr-4 font-mono whitespace-nowrap text-zinc-300">__clerk_*, __session</td>
                    <td className="py-2 pr-4 whitespace-nowrap">Clerk / Auth0</td>
                    <td className="py-2">Maintains your authenticated session so you stay signed in between pages.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono whitespace-nowrap text-zinc-300">__stripe_*, __hssc</td>
                    <td className="py-2 pr-4 whitespace-nowrap">Stripe</td>
                    <td className="py-2">Fraud prevention and secure payment processing during checkout.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono whitespace-nowrap text-zinc-300">cookie_consent</td>
                    <td className="py-2 pr-4 whitespace-nowrap">PrepInterv AI</td>
                    <td className="py-2">Stores your cookie preference so the consent banner does not reappear. Saved in local storage, not transmitted to our servers.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-300">Functional cookies — only if you accept all</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              If you click <em>Accept all</em> on the consent banner, we may additionally store local preferences (such as your interview configuration choices) in your browser's local storage to improve your experience on return visits. These entries are never transmitted to third parties.
            </p>
            <p className="text-zinc-400 text-sm leading-relaxed">
              We do not use any analytics, advertising, or tracking cookies. No third-party ad networks have access to your browsing behaviour on this site.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-300">Managing your preferences</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              You can withdraw or change your cookie consent at any time by clearing your browser's local storage (usually found in your browser's developer tools under Application → Local Storage → <code className="text-zinc-300 bg-white/5 px-1 rounded text-xs">cookie_consent</code>). Essential cookies cannot be disabled through the consent mechanism — if you wish to block them entirely you may do so through your browser settings, though this will prevent you from signing in to the service.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">7. Your rights</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            You have the right to access, correct, or delete your personal data. To exercise these rights, please contact us at <a href="mailto:hello@prepinterv.com" className="text-primary hover:underline">hello@prepinterv.com</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">8. Changes to this policy</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on the platform or sending an email to the address associated with your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">9. Contact</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            For any privacy-related questions, contact us at <a href="mailto:hello@prepinterv.com" className="text-primary hover:underline">hello@prepinterv.com</a>.
          </p>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
