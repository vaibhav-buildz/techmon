"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    // Check if we have an active session (or recovery session created by Supabase link)
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setHasRecoverySession(true);
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();

    // Listen for auth state change (e.g. PASSWORD_RECOVERY event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err: any) {
      setError(err.message || "Failed to update password. Your reset link may be invalid or expired.");
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
              <h2 className="text-xl font-heading font-semibold text-heading">Set New Password</h2>
              <p className="text-sm text-body mt-1">
                Please enter a new password for your account.
              </p>
            </div>
          </div>

          {checkingSession ? (
            <div className="py-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : success ? (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 leading-relaxed">
                🎉 Password updated successfully! Redirecting to sign in page...
              </div>
              <Link
                href="/login"
                className="w-full inline-flex justify-center items-center py-2.5 px-4 bg-accent text-white font-medium rounded-lg text-sm hover:bg-accent/90 transition-colors"
              >
                Sign In Now
              </Link>
            </div>
          ) : !hasRecoverySession ? (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 leading-relaxed">
                No active password reset session found. Your reset link may have expired or is invalid. Please request a new reset link.
              </div>
              <Link
                href="/forgot-password"
                className="w-full inline-flex justify-center items-center py-2.5 px-4 bg-accent text-white font-medium rounded-lg text-sm hover:bg-accent/90 transition-colors"
              >
                Request New Reset Link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-heading mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow"
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-heading mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow"
                  placeholder="Repeat new password"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                  {error}
                  <div className="mt-2 text-xs">
                    <Link href="/forgot-password" className="text-accent underline font-medium">
                      Request a new reset link
                    </Link>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full py-2.5 px-4 bg-accent text-white font-medium rounded-lg text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              >
                {loading ? "Updating..." : "Reset Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
