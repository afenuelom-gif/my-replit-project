import { Link } from "wouter";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 py-5 px-6 bg-white/50">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-5 flex-wrap justify-center">
          <span className="text-slate-400">AI-generated content — for practice purposes only</span>
          <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms of Service</Link>
        </div>
        <p>© {year} IvanGold Technologies. All rights reserved.</p>
      </div>
    </footer>
  );
}
