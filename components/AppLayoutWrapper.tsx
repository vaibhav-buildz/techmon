"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import TopNavbar from "./TopNavbar";
import TopBar from "./TopBar";
import { addAccount } from "@/lib/accountManager";

export default function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);

        if (session?.user) {
          let { data: profileData } = await supabase
            .from("profiles")
            .select("id, name, avatar_url, username")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profileData && !profileData.username) {
            const gen = (profileData.name || "user").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15) || "user";
            const autoUsername = `${gen}_${session.user.id.slice(0, 4)}`;
            profileData.username = autoUsername;
            await supabase.from("profiles").update({ username: autoUsername }).eq("id", session.user.id);
          }

          setProfile(profileData || null);
          addAccount(session, profileData);
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
      setUser(session?.user || null);
      if (session?.user) {
        let { data: profileData } = await supabase
          .from("profiles")
          .select("id, name, avatar_url, username")
          .eq("id", session.user.id)
          .maybeSingle();
        
        if (profileData && !profileData.username) {
          const gen = (profileData.name || "user").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15) || "user";
          const autoUsername = `${gen}_${session.user.id.slice(0, 4)}`;
          profileData.username = autoUsername;
          await supabase.from("profiles").update({ username: autoUsername }).eq("id", session.user.id);
        }

        setProfile(profileData || null);
        addAccount(session, profileData);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
