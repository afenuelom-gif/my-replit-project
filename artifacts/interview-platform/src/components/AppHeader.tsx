import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ShieldCheck } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface AppHeaderProps {
  right?: React.ReactNode;
  mobileMenuExtra?: React.ReactNode;
}

export function AppHeader({ right, mobileMenuExtra }: AppHeaderProps) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = useIsAdmin();
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
    `text-sm px-3 py-1.5 rounded-lg font-medium transition-all ${
      location === path
        ? "text-blue-700 bg-blue-50 border border-blue-200"
        : "text-slate-600 hover:text-blue-700 hover:bg-blue-50"
    }`;

  const dropdownLinkClass = (path: string) =>
    `flex items-center px-4 py-2.5 text-sm font-medium transition-all ${
      location === path
        ? "text-blue-700 bg-blue-50"
        : "text-slate-700 hover:text-blue-700 hover:bg-blue-50"
    }`;

  return (
    <header className="w-full flex items-center justify-between px-4 sm:px-6 py-4 border-b border-blue-100 bg-white/90 backdrop-blur-md print:hidden relative z-50 shadow-sm">
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
          {isAdmin && (
            <div className="relative group">
              <Link
                href="/admin/feedback"
                aria-describedby="admin-nav-tooltip"
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-all ${
                  location === "/admin/feedback"
                    ? "text-purple-700 bg-purple-50 border border-purple-200"
                    : "text-purple-600 hover:text-purple-700 hover:bg-purple-50 border border-purple-200/60"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                Admin
              </Link>
              <div
                id="admin-nav-tooltip"
                role="tooltip"
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1.5 text-xs font-medium text-white bg-slate-800 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 pointer-events-none z-50 shadow-lg"
              >
                Admin-only: Feedback Dashboard
                <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-slate-800 rotate-45 rounded-sm" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: auth slot + hamburger */}
      <div className="flex items-center gap-2">
        {right && <div className="flex items-center">{right}</div>}

        <div ref={menuRef} className="relative sm:hidden">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            className="p-2 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-blue-100 bg-white shadow-xl shadow-blue-100/50 py-1.5">
              <Link href="/pricing" className={dropdownLinkClass("/pricing")}>
                Pricing
              </Link>
              <Link href="/contact" className={dropdownLinkClass("/contact")}>
                Contact
              </Link>
              {isAdmin && (
                <>
                  <div className="my-1.5 border-t border-slate-100" />
                  <Link
                    href="/admin/feedback"
                    aria-describedby="admin-mobile-desc"
                    className={`flex items-start gap-2 px-4 py-2.5 text-sm font-medium transition-all ${
                      location === "/admin/feedback"
                        ? "text-purple-700 bg-purple-50"
                        : "text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        Admin Feedback
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-purple-100 text-purple-600 rounded px-1.5 py-0.5">
                          Admin
                        </span>
                      </span>
                      <span
                        id="admin-mobile-desc"
                        className="block text-[11px] font-normal text-purple-400 mt-0.5"
                      >
                        Admin-only: Feedback Dashboard
                      </span>
                    </span>
                  </Link>
                </>
              )}

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
