"use client";

import Link from "next/link";

export default function TopBar() {
  return (
    <nav className="w-full border-b border-border bg-surface text-body h-16 flex items-center shrink-0">
      <div className="max-w-7xl mx-auto w-full px-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-heading font-bold tracking-tight text-heading hover:text-accent transition-colors">
          Techmon
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-body hover:text-accent transition-colors"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
}
