"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CreatePostModal from "./CreatePostModal";
import SearchModal from "./SearchModal";
import NotificationsPanel from "./NotificationsPanel";
import { 
  House, 
  Clapperboard, 
  MessageCircle, 
  Search, 
  Heart, 
  PlusSquare, 
  CircleUserRound
} from "lucide-react";

type UserProfile = {
  id: string;
  name: string;
  avatar_url?: string;
};

type Props = {
  user: any;
  profile: UserProfile | null;
};

export default function Sidebar({ user, profile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false);
        
      if (!error && count !== null) {
        setUnreadCount(count);
      }
    };
    fetchUnread();
  }, [user]);

  const navItems = [
    { label: "Home", icon: House, href: "/" },
    { label: "Search", icon: Search, onClick: () => setIsSearchModalOpen(true) },
    { label: "Feed", icon: Clapperboard, href: "/feed" },
    { label: "Messages", icon: MessageCircle, onClick: () => alert("Messages coming soon!") },
    { label: "Notifications", icon: Heart, onClick: () => setIsNotificationsPanelOpen(true) },
    { label: "Create", icon: PlusSquare, onClick: () => setIsCreateModalOpen(true) },
    { 
      label: "Profile", 
      icon: profile?.avatar_url ? null : CircleUserRound, 
      href: `/profile/${user.id}`,
      customIcon: profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="Profile" className="w-6 h-6 rounded-full object-cover border border-border" />
      ) : null
    },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col w-64 fixed left-0 inset-y-0 bg-surface border-r border-border z-40">
        <div className="p-6 pb-2">
          <Link href="/" className="text-2xl font-heading font-bold tracking-tight text-heading hover:text-accent transition-colors">
            Techmon
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = item.href && pathname === item.href;
            
            const content = (
              <>
                <div className={`relative shrink-0 transition-transform group-hover:scale-105`}>
                  {item.customIcon ? item.customIcon : item.icon && <item.icon className={`w-6 h-6 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />}
                  {item.label === "Notifications" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface"></span>
                  )}
                </div>
                <span className={`text-base ${isActive ? "font-bold" : "font-medium"}`}>
                  {item.label}
                </span>
              </>
            );

            const className = `flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors group ${isActive ? "text-heading" : "text-body"}`;

            if (item.href) {
              return (
                <Link key={item.label} href={item.href} className={className}>
                  {content}
                </Link>
              );
            }

            return (
              <button key={item.label} onClick={item.onClick} className={className}>
                {content}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-surface border-t border-border z-40 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {navItems.filter(item => ["Home", "Search", "Create", "Notifications", "Profile"].includes(item.label)).map((item) => {
          const isActive = item.href && pathname === item.href;
          
          const content = (
            <div className={`relative p-2 transition-transform active:scale-95 flex items-center justify-center h-full w-full ${isActive ? "text-heading" : "text-body"}`}>
              <div className="relative">
                {item.customIcon ? item.customIcon : item.icon && <item.icon className={`w-6 h-6 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />}
                {item.label === "Notifications" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface"></span>
                )}
              </div>
            </div>
          );

          if (item.href) {
            return (
              <Link key={item.label} href={item.href} className="flex-1 flex justify-center">
                {content}
              </Link>
            );
          }

          return (
            <button key={item.label} onClick={item.onClick} className="flex-1 flex justify-center">
              {content}
            </button>
          );
        })}
      </nav>

      {user && (
        <>
          <CreatePostModal 
            isOpen={isCreateModalOpen} 
            onClose={() => setIsCreateModalOpen(false)} 
            userId={user.id} 
          />
          <SearchModal
            isOpen={isSearchModalOpen}
            onClose={() => setIsSearchModalOpen(false)}
          />
          <NotificationsPanel
            isOpen={isNotificationsPanelOpen}
            onClose={() => setIsNotificationsPanelOpen(false)}
            userId={user.id}
            onRead={() => setUnreadCount(0)}
          />
        </>
      )}
    </>
  );
}
