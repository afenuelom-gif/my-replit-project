import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";

interface AppHeaderProps {
  right?: React.ReactNode;
  mobileMenuExtra?: React.ReactNode;
}

export function AppHeader({ right, mobileMenuExtra }: AppHeaderProps) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const navLinkClass = (path: string) =>
    `text-sm px-2 py-1 rounded transition-colors ${
      location === path ? "text-white font-medium" : "text-zinc-400 hover:text-white"
    }`;

  const dropdownLinkClass = (path: string) =>
    `flex items-center px-4 py-2.5 text-sm transition-colors ${
      location === path
        ? "text-white font-medium bg-white/5"
        : "text-zinc-400 hover:text-white hover:bg-white/5"
    }`;

  return (
    <header className="w-full flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-background/80 backdrop-blur-md print:hidden relative z-50">
      {/* Left: logo + desktop nav */}
      <div className="flex items-center gap-4 sm:gap-6">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <img
            src="/logo-icon.png"
            alt="PrepInterv AI"
            className="h-9 w-9 rounded-xl object-cover shadow-md"
          />
          <span className="text-xl font-bold tracking-tight leading-none">
            <span className="text-white">PrepInterv</span>
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent ml-1">
              AI
            </span>
          </span>
        </Link>

        {/* Desktop-only nav links */}
        <div className="hidden sm:flex items-center gap-1">
          <Link href="/pricing" className={navLinkClass("/pricing")}>Pricing</Link>
          <Link href="/contact" className={navLinkClass("/contact")}>Contact</Link>
        </div>
      </div>

      {/* Right: username / sign-in + hamburger */}
      <div className="flex items-center gap-2">
        {/* Always-visible right slot (e.g. username, Sign In, back button) */}
        {right && <div className="flex items-center">{right}</div>}

        {/* Mobile hamburger */}
        <div ref={menuRef} className="relative sm:hidden">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl py-1.5">
              <Link href="/pricing" className={dropdownLinkClass("/pricing")}>
                Pricing
              </Link>
              <Link href="/contact" className={dropdownLinkClass("/contact")}>
                Contact
              </Link>

              {mobileMenuExtra && (
                <>
                  <div className="my-1.5 border-t border-white/10" />
                  {mobileMenuExtra}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
