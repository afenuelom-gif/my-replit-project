import React from "react";
import { Link } from "wouter";

interface AppHeaderProps {
  right?: React.ReactNode;
}

export function AppHeader({ right }: AppHeaderProps) {
  return (
    <header className="w-full flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 backdrop-blur-sm print:hidden">
      <Link href="/" className="flex items-center gap-3 group">
        <img
          src="/logo.png"
          alt="IntervYou AI"
          className="h-9 w-9 rounded-xl object-cover shadow-md"
        />
        <span className="text-xl font-bold tracking-tight leading-none">
          <span className="text-white">IntervYou</span>
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent ml-1">
            AI
          </span>
        </span>
      </Link>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}
