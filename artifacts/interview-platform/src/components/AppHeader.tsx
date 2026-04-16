import React from "react";
import { Link, useLocation } from "wouter";

interface AppHeaderProps {
  right?: React.ReactNode;
}

export function AppHeader({ right }: AppHeaderProps) {
  const [location] = useLocation();

  return (
    <header className="w-full flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 backdrop-blur-sm print:hidden">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-3 group">
          <img
            src="/logo-icon.png"
            alt="Ocranity AI"
            className="h-9 w-9 rounded-xl object-cover shadow-md"
          />
          <span className="text-xl font-bold tracking-tight leading-none">
            <span className="text-white">Ocranity</span>
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent ml-1">
              AI
            </span>
          </span>
        </Link>

        <Link
          href="/pricing"
          className={`text-sm px-2 py-1 rounded transition-colors ${
            location === "/pricing"
              ? "text-white font-medium"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Pricing
        </Link>

        <Link
          href="/contact"
          className={`text-sm px-2 py-1 rounded transition-colors ${
            location === "/contact"
              ? "text-white font-medium"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Contact
        </Link>
      </div>

      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}
