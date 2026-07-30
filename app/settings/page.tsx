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
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-body hover:text-heading"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-heading">Settings</h1>
            <p className="text-sm text-body">Manage your account preferences and activity</p>
          </div>
        </div>

        {/* Navigation List */}
        <div className="bg-surface border border-border divide-y divide-border overflow-hidden">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between p-4 sm:p-5 transition-colors group ${
                  item.isAdminItem ? "bg-accent/5 hover:bg-accent/10" : "hover:bg-gray-50/80"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                    item.isAdminItem ? "bg-accent text-white" : "bg-accent/10 text-accent"
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-semibold text-heading text-base group-hover:text-accent transition-colors">
                        {item.title}
                      </h3>
                      {item.isAdminItem && (
                        <span className="px-2 py-0.5 bg-accent text-white font-mono text-[9px] uppercase font-bold tracking-wider">
                          Admin Only
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-body font-normal">{item.description}</p>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-heading group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
