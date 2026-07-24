"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) throw error;

      setMessage("If an account exists with this email, a password reset link has been sent.");
    } catch (err: any) {
      setError(err.message || "Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 bg-background text-body flex items-center justify-center">
      <div className="w-full max-w-md px-4 sm:px-6">
        <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-6">
          <div className="text-left flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Techmon Logo" className="w-8 h-8" />
              <span className="text-2xl font-heading font-bold tracking-tight text-heading">Techmon</span>
            </div>
            <div>
              <h2 className="text-xl font-heading font-semibold text-heading">Forgot Password</h2>
              <p className="text-sm text-body mt-1">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>
          </div>

          {message ? (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 leading-relaxed">
                {message}
              </div>
              <Link
                href="/login"
                className="w-full inline-flex justify-center items-center py-2.5 px-4 bg-accent text-white font-medium rounded-lg text-sm hover:bg-accent/90 transition-colors"
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-heading mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-2.5 px-4 bg-accent text-white font-medium rounded-lg text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>

              <div className="pt-2 text-center">
                <Link href="/login" className="text-xs text-body hover:text-heading font-medium">
                  ← Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
