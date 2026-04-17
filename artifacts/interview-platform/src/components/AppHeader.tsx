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
    `text-sm px-3 py-1.5 rounded-lg transition-colors ${
      location === path
        ? "text-slate-900 font-medium bg-slate-100"
        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
    }`;

  const dropdownLinkClass = (path: string) =>
    `flex items-center px-4 py-2.5 text-sm transition-colors ${
      location === path
        ? "text-slate-900 font-medium bg-slate-100"
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
    }`;

  return (
    <header className="w-full flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 bg-white/90 backdrop-blur-md print:hidden relative z-50 shadow-sm">
      {/* Left: logo + desktop nav */}
      <div className="flex items-center gap-4 sm:gap-6">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <img
            src="/logo-icon.png"
            alt="PrepInterv AI"
            className="h-9 w-9 rounded-xl object-cover shadow-sm"
          />
          <span className="text-xl font-bold tracking-tight leading-none">
            <span className="text-slate-900">PrepInterv</span>
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ml-1">
              AI
            </span>
          </span>
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          <Link href="/pricing" className={navLinkClass("/pricing")}>Pricing</Link>
          <Link href="/contact" className={navLinkClass("/contact")}>Contact</Link>
        </div>
      </div>

      {/* Right: auth slot + hamburger */}
      <div className="flex items-center gap-2">
        {right && <div className="flex items-center">{right}</div>}

        <div ref={menuRef} className="relative sm:hidden">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-lg py-1.5">
              <Link href="/pricing" className={dropdownLinkClass("/pricing")}>
                Pricing
              </Link>
              <Link href="/contact" className={dropdownLinkClass("/contact")}>
                Contact
              </Link>

              {mobileMenuExtra && (
                <>
                  <div className="my-1.5 border-t border-slate-200" />
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
