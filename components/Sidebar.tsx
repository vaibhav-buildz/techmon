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
  CircleUserRound, 
  Menu,
  Settings,
  Users,
  LogOut
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    { label: "Home", icon: House, href: "/" },
    { label: "Search", icon: Search, onClick: () => setIsSearchModalOpen(true) },
    { label: "Feed", icon: Clapperboard, href: "/feed" },
    { label: "Messages", icon: MessageCircle, onClick: () => alert("Messages coming soon") },
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

        <div className="p-3 relative">
          <button 
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="flex w-full items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors text-body group font-medium"
          >
            <div className="shrink-0 transition-transform group-hover:scale-105">
              <Menu className="w-6 h-6 stroke-2" />
            </div>
            <span className="text-base">More</span>
          </button>

          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute bottom-16 left-3 w-64 bg-surface border border-border shadow-xl rounded-xl z-50 overflow-hidden py-2">
                <Link
                  href="/settings"
                  onClick={() => setShowMoreMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-body hover:bg-gray-50 transition-colors font-medium"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                  Settings
                </Link>
                <button
                  onClick={() => {
                    alert("Multiple accounts coming soon");
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-body hover:bg-gray-50 transition-colors font-medium"
                >
                  <Users className="w-4 h-4 text-gray-400" />
                  Switch Accounts
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    handleLogout();
                  }}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  Logout
                </button>
              </div>
            </>
          )}
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
