import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Layers, Menu, X } from "lucide-react";

function navLinkClassName({ isActive }) {
  return `text-sm transition-colors ${isActive ? "text-white" : "text-slate-400 hover:text-white"}`;
}

function mobileNavLinkClassName({ isActive }) {
  return `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
  }`;
}

// Global site navigation bar
export const Header = ({ onHomeClick }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleHomeClick = () => {
    setMobileOpen(false);
    onHomeClick?.();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" onClick={handleHomeClick} className="flex items-center gap-2 select-none">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">AcuVisor</span>
          </Link>

          <nav className="hidden md:flex gap-6 text-sm">
            <NavLink to="/how-it-works" className={navLinkClassName}>
              How It Works
            </NavLink>
            <NavLink to="/about" className={navLinkClassName}>
              About
            </NavLink>
          </nav>

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <nav id="mobile-navigation" className="border-t border-slate-800 py-3 md:hidden">
            <div className="flex flex-col gap-2">
              <NavLink to="/how-it-works" className={mobileNavLinkClassName}>
                How It Works
              </NavLink>
              <NavLink to="/about" className={mobileNavLinkClassName}>
                About
              </NavLink>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};
