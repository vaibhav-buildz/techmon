"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addAccount } from "@/lib/accountManager";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [gitHubLoading, setGitHubLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset loading states on mount, pageshow (BFCache restore), window focus, or visibilitychange
  useEffect(() => {
    const handleResetLoading = () => {
      setLoading(false);
      setGitHubLoading(false);
      setGoogleLoading(false);
    };

    handleResetLoading();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleResetLoading();
      }
    };

    window.addEventListener("focus", handleResetLoading);
    window.addEventListener("pageshow", handleResetLoading);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleResetLoading);
      window.removeEventListener("pageshow", handleResetLoading);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Fallback timer: reset loading state if stuck in loading for more than 10 seconds
  useEffect(() => {
    if (loading || gitHubLoading || googleLoading) {
      const timer = setTimeout(() => {
        setLoading(false);
        setGitHubLoading(false);
        setGoogleLoading(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [loading, gitHubLoading, googleLoading]);

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setGoogleLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    try {
      setGitHubLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setGitHubLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (data.session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url, username")
          .eq("id", data.session.user.id)
          .maybeSingle();
        addAccount(data.session, profile);

        if (profile?.username) {
          router.push(`/profile/${profile.username}`);
        } else {
          router.push("/onboarding");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-16 bg-background text-body flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="bg-surface border border-border rounded-none p-8 md:p-10 space-y-8 shadow-xs">
          <div className="text-left space-y-3">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <img src="/logo.svg" alt="Techmon Logo" className="w-8 h-8" />
              <span className="text-2xl font-heading font-bold tracking-tight text-heading group-hover:text-accent transition-colors">
                Techmon
              </span>
            </Link>
            <div>
              <h2 className="text-3xl font-heading font-bold text-heading tracking-tight">Welcome back</h2>
              <p className="text-sm font-sans text-muted mt-1">Sign in to your publication account</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading || gitHubLoading || loading}
                className="w-full flex justify-center items-center gap-2.5 py-2.5 px-4 border border-heading/30 bg-surface rounded-none text-xs font-mono uppercase tracking-wider text-heading hover:border-heading transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                {googleLoading ? "Connecting..." : "Sign in with Google"}
              </button>

              <button
                onClick={handleGitHubSignIn}
                disabled={gitHubLoading || googleLoading || loading}
                className="w-full flex justify-center items-center gap-2.5 py-2.5 px-4 border border-heading/30 bg-surface rounded-none text-xs font-mono uppercase tracking-wider text-heading hover:border-heading transition-colors disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-heading">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                {gitHubLoading ? "Connecting..." : "Sign in with GitHub"}
              </button>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-surface px-3 font-mono text-[11px] uppercase tracking-wider text-muted">Or with email</span>
              </div>
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-5">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-heading mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-transparent border-b-2 border-border focus:border-accent text-sm text-heading placeholder-gray-400 focus:outline-none transition-colors rounded-none"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-mono text-xs uppercase tracking-wider text-heading">
                    Password
                  </label>
                  <Link href="/forgot-password" className="font-mono text-xs text-accent hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-transparent border-b-2 border-border focus:border-accent text-sm text-heading placeholder-gray-400 focus:outline-none transition-colors rounded-none"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="font-mono text-xs text-red-600 bg-red-50 p-3 border border-red-200 rounded-none">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || gitHubLoading || googleLoading}
                className="w-full py-3 px-4 bg-accent text-white font-mono text-xs uppercase tracking-wider hover:bg-accent/90 transition-colors border border-accent disabled:opacity-50 rounded-none"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="text-center font-sans text-sm text-muted pt-2">
              Don't have an account?{" "}
              <Link href="/signup" className="text-accent hover:underline font-semibold">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
