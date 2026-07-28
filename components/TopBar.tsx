"use client";

import Link from "next/link";

export default function TopBar() {
  return (
    <nav className="w-full border-b border-border bg-background text-body h-16 flex items-center shrink-0">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <img src="/logo.svg" alt="Techmon Logo" className="w-7 h-7" />
          <span className="text-2xl font-heading font-bold tracking-tight text-heading group-hover:text-accent transition-colors">
            Techmon
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-xs font-mono uppercase tracking-wider text-heading hover:text-accent transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="text-xs font-mono uppercase tracking-wider px-4 py-2 bg-accent text-white hover:bg-accent/90 transition-colors border border-accent rounded-none"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
}
