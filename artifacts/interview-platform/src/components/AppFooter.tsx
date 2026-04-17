import { Link } from "wouter";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 py-5 px-6">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-2 text-xs text-zinc-600">
        <div className="flex items-center gap-5 flex-wrap justify-center">
          <span className="text-zinc-700">AI-generated content — for practice purposes only</span>
          <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms of Service</Link>
        </div>
        <p>© {year} IvanGold Technologies. All rights reserved.</p>
      </div>
    </footer>
  );
}
