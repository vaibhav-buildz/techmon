"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { User, Activity, Archive, Shield, ChevronRight, ArrowLeft, ShieldAlert } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/login");
      } else {
        setCurrentUserId(session.user.id);
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profile?.is_admin) {
          setIsAdmin(true);
        }
        
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading || !currentUserId) {
    return (
      <main className="min-h-screen bg-background pt-24 px-4">
        <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </main>
    );
  }

  const settingsItems = [
    {
      title: "Edit Profile",
      description: "Update your name, bio, avatar, skills, and links",
      icon: User,
      href: "/profile/edit",
      isAdminItem: false,
    },
    {
      title: "Your Activity",
      description: "View saved posts, liked posts, and collections",
      icon: Activity,
      href: "/activity",
      isAdminItem: false,
    },
    {
      title: "Archive",
      description: "Manage your archived posts",
      icon: Archive,
      href: "/archive",
      isAdminItem: false,
    },
    {
      title: "Login Activity",
      description: "Check active sessions, devices, and security history",
      icon: Shield,
      href: "/login-activity",
      isAdminItem: false,
    },
  ];

  if (isAdmin) {
    settingsItems.push({
      title: "Admin Panel",
      description: "Platform moderation, user directory, posts & system stats",
      icon: ShieldAlert,
      href: "/admin",
      isAdminItem: true,
    });
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2.5 hover:bg-surface border border-border/60 hover:border-heading/40 rounded-xl transition-all text-body hover:text-heading active:scale-95 shadow-2xs"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight text-heading">Settings</h1>
            <p className="text-sm text-muted">Manage your account preferences, security, and activity</p>
          </div>
        </div>

        {/* Navigation List */}
        <div className="bg-surface border border-border/80 rounded-2xl divide-y divide-border/80 overflow-hidden shadow-sm">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                className={`flex items-center justify-between p-4.5 sm:p-5 transition-all group ${
                  item.isAdminItem ? "bg-accent/5 hover:bg-accent/10" : "hover:bg-gray-50/80"
                }`}
                href={item.href}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-2xs ${
                    item.isAdminItem ? "bg-accent text-white" : "bg-accent/10 border border-accent/20 text-accent"
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-semibold text-heading text-base group-hover:text-accent transition-colors">
                        {item.title}
                      </h3>
                      {item.isAdminItem && (
                        <span className="px-2 py-0.5 bg-accent text-white font-mono text-[9px] uppercase font-bold tracking-wider rounded-md shadow-2xs">
                          Admin Only
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted font-sans mt-0.5">{item.description}</p>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-heading group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
