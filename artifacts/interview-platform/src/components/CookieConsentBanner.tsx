import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "cookie_consent";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  const save = (value: "all" | "essential") => {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] p-3 sm:p-4 print:hidden">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-300/40 px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5">

        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
            <Cookie className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            We use <strong className="text-slate-800">essential cookies</strong> for sign-in and secure payment processing.
            Accepting all also enables functional cookies that remember your preferences.{" "}
            <Link href="/privacy" className="text-blue-600 hover:text-blue-700 underline underline-offset-2 font-medium whitespace-nowrap">
              Privacy Policy
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => save("essential")}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            Essential only
          </button>
          <button
            onClick={() => save("all")}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
          >
            Accept all
          </button>
        </div>

      </div>
    </div>
  );
}
