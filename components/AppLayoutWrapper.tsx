"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import TopNavbar from "./TopNavbar";
import TopBar from "./TopBar";
import { addAccount } from "@/lib/accountManager";
import { usePathname, useRouter } from "next/navigation";
import { logLogin, clearLoginSession } from "@/lib/logLogin";

export default function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);

        if (session?.user) {
          let { data: profileData } = await supabase
            .from("profiles")
            .select("id, name, avatar_url, username, is_admin")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profileData && profileData.username) {
            setProfile(profileData);
            addAccount(session, profileData);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user || null;
      setUser((prevUser: any) => (prevUser?.id !== newUser?.id ? newUser : prevUser));

      if (session?.user) {
        logLogin(session.user.id, session.access_token, event);
        let { data: profileData } = await supabase
          .from("profiles")
          .select("id, name, avatar_url, username, is_admin")
          .eq("id", session.user.id)
          .maybeSingle();
        
        if (profileData && profileData.username) {
          setProfile((prevProfile: any) => {
            if (
              prevProfile?.id === profileData.id &&
              prevProfile?.username === profileData.username &&
              prevProfile?.name === profileData.name &&
              prevProfile?.avatar_url === profileData.avatar_url &&
              prevProfile?.is_admin === profileData.is_admin
            ) {
              return prevProfile;
            }
            return profileData;
          });
          addAccount(session, profileData);
        } else {
          setProfile(null);
        }
      } else {
        if (event === "SIGNED_OUT") {
          clearLoginSession();
        }
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Central guard: If user is authenticated but has no profile row, redirect to /onboarding
  useEffect(() => {
    if (loading) return;

    const publicAuthRoutes = [
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/auth/callback",
      "/onboarding",
    ];

    if (user && !profile && !publicAuthRoutes.includes(pathname)) {
      router.push("/onboarding");
    }
  }, [loading, user, profile, pathname, router]);

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopBar />
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pt-14 md:pt-16 bg-background">
      <TopNavbar user={user} profile={profile} />
      <main className="flex-1 flex flex-col pb-14 md:pb-0">
        {children}
      </main>
    </div>
  );
}
