import React from "react";
import { NavLink } from "react-router-dom";
import { Layers } from "lucide-react";

function navLinkClassName({ isActive }) {
  return `text-sm transition-colors ${isActive ? "text-white" : "text-slate-400 hover:text-white"}`;
}

export const Header = () => (
  <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900 text-white">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
      <a href="/" className="flex items-center gap-2 select-none">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Layers className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">AcuVisor</span>
      </a>
      <nav className="hidden md:flex gap-6 text-sm">
        <NavLink to="/how-it-works" className={navLinkClassName}>
          How It Works
        </NavLink>
        <NavLink to="/about" className={navLinkClassName}>
          About
        </NavLink>
      </nav>
    </div>
  </header>
);
