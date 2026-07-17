"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
      setLoading(false);
    };
    
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-background text-body px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold tracking-tight text-heading">
          The network for people who build.
        </h1>
        
        <p className="text-lg sm:text-xl text-body max-w-2xl mx-auto leading-relaxed">
          Connect with tech students and professionals. Share projects, code, and ideas.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 min-h-[60px]">
          {!loading && (
            userId ? (
              <Link
                href={`/profile/${userId}`}
                className="px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors w-full sm:w-auto"
              >
                Go to your profile
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors w-full sm:w-auto"
                >
                  Sign Up
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3 bg-surface border border-border shadow-sm text-heading font-medium rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto"
                >
                  Log In
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
