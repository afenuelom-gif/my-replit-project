import { Link } from "wouter";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-blue-100 py-5 px-6 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/50">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-2 text-xs text-slate-800">
        <div className="flex items-center gap-5 flex-wrap justify-center">
          <span className="text-slate-800">AI-generated content — for practice purposes only</span>
          <Link href="/privacy" className="font-medium text-slate-900 hover:text-blue-700 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="font-medium text-slate-900 hover:text-blue-700 transition-colors">Terms of Service</Link>
        </div>
        <p className="text-slate-700">© {year} IvanGold Technologies. All rights reserved.</p>
      </div>
    </footer>
  );
}
