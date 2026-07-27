"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const processUser = async (userId: string) => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, username")
          .eq("id", userId)
          .maybeSingle();

        if (error) throw error;

        if (profile && profile.username) {
          router.push(`/profile/${profile.username}`);
        } else {
          router.push("/onboarding");
        }
      } catch (err: any) {
        console.error("[AuthCallback] Error fetching profile:", err);
        if (isMounted) setError(err.message);
      }
    };

    const handleAuthCallback = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          await processUser(session.user.id);
          return;
        }

        // Listen for auth state change if session is not immediately ready
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (currentSession?.user) {
            subscription.unsubscribe();
            await processUser(currentSession.user.id);
          }
        });

        // Fallback timer
        setTimeout(async () => {
          if (!isMounted) return;
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            await processUser(currentUser.id);
          } else {
            router.push("/login");
          }
        }, 2500);
      } catch (err: any) {
        console.error("[AuthCallback] Error:", err);
        if (isMounted) {
          setError(err.message);
          setTimeout(() => router.push("/login"), 2000);
        }
      }
    };

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-body">
      <div className="text-center space-y-4">
        {error ? (
          <div className="text-red-600 bg-red-50 p-4 rounded-lg border border-red-100 max-w-md">
            <p className="font-medium">Authentication Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-heading">Completing sign in...</p>
          </div>
        )}
      </div>
    </div>
  );
}
