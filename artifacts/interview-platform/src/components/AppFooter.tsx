import { Link } from "wouter";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 py-5 px-6 bg-slate-900">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-2 text-xs text-slate-300">
        <div className="flex items-center gap-5 flex-wrap justify-center">
          <span className="text-slate-300">AI-generated content — for practice purposes only</span>
          <Link href="/privacy" className="font-medium text-slate-200 hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="font-medium text-slate-200 hover:text-white transition-colors">Terms of Service</Link>
        </div>
        <p className="text-slate-400">© {year} IvanGold Technologies. All rights reserved.</p>
      </div>
    </footer>
  );
}
