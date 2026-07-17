"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";

type UserProfile = {
  id: string;
  name: string;
  avatar_url?: string;
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Function to fetch current user and their profile
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);

        if (session?.user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, name, avatar_url")
            .eq("id", session.user.id)
            .single();

          if (profileData) {
            setProfile(profileData);
          } else {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Error fetching session/profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        // Only fetch profile if not already fetched or if it's a new sign in
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .eq("id", session.user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Get initials for placeholder
  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <nav className="w-full border-b border-border bg-surface text-body h-16 flex items-center">
      <div className="max-w-7xl mx-auto w-full px-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-heading font-bold tracking-tight text-heading hover:text-accent transition-colors">
          Techmon
        </Link>

        <div className="flex items-center gap-4">
          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-4">
                  {profile && (
                    <Link
                      href={`/profile/${user.id}`}
                      className="flex items-center gap-2 group"
                    >
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.name}
                          className="w-8 h-8 rounded-full object-cover border border-border group-hover:border-accent transition-colors"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-xs font-medium text-body group-hover:border-accent transition-colors">
                          {initials}
                        </div>
                      )}
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-body hover:text-accent transition-colors focus:outline-none"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {pathname !== "/login" && (
                    <Link
                      href="/login"
                      className="text-sm font-medium text-body hover:text-accent transition-colors"
                    >
                      Login
                    </Link>
                  )}
                  {pathname !== "/signup" && (
                    <Link
                      href="/signup"
                      className="text-sm font-medium px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
                    >
                      Sign Up
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
