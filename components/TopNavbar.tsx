"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CreatePostModal from "./CreatePostModal";
import CameraCaptureModal from "./CameraCaptureModal";
import SearchModal from "./SearchModal";
import NotificationsPanel from "./NotificationsPanel";
import { 
  House, 
  Clapperboard, 
  MessageCircle, 
  Search, 
  Heart, 
  PlusSquare,
  Plus,
  CircleUserRound,
  Camera,
  SquarePen,
  Briefcase,
  Users2,
} from "lucide-react";


type UserProfile = {
  id: string;
  name: string;
  avatar_url?: string;
  username?: string;
  is_admin?: boolean;
};

type Props = {
  user: any;
  profile: UserProfile | null;
};

export default function TopNavbar({ user, profile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Modals state
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);



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

      // Fetch unread messages
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
        
      if (convos && convos.length > 0) {
        const convoIds = convos.map(c => c.id);
        const { count: msgCount, error: msgError } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", convoIds)
          .eq("read", false)
          .neq("sender_id", user.id);
          
        if (!msgError && msgCount !== null) {
          setUnreadMessagesCount(msgCount);
        }
      } else {
        setUnreadMessagesCount(0);
      }
    };
    fetchUnread();

    const handleUnreadReset = () => {
      fetchUnread();
    };

    window.addEventListener("notificationsRead", handleUnreadReset);
    window.addEventListener("messagesRead", handleUnreadReset);
    window.addEventListener("unreadStateChanged", handleUnreadReset);

    const channel = supabase
      .channel('navbar-all-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchUnread();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => {
      window.removeEventListener("notificationsRead", handleUnreadReset);
      window.removeEventListener("messagesRead", handleUnreadReset);
      window.removeEventListener("unreadStateChanged", handleUnreadReset);
      supabase.removeChannel(channel);
    };
  }, [user]);


  const navItems = [
    { label: "Home", icon: House, href: "/" },
    { label: "Search", icon: Search, onClick: () => setIsSearchModalOpen(true) },
    { label: "Feed", icon: Clapperboard, href: "/feed" },
    { label: "Jobs", icon: Briefcase, href: "/jobs" },
    { label: "Groups", icon: Users2, href: "/groups" },
    { label: "Messages", icon: MessageCircle, href: "/messages" },
    { label: "Notifications", icon: Heart, onClick: () => setIsNotificationsPanelOpen(true) },
    { label: "Create", icon: PlusSquare, onClick: () => setIsCreateMenuOpen(!isCreateMenuOpen) },
    { 
      label: "Profile", 
      icon: profile?.avatar_url ? null : CircleUserRound, 
      href: profile?.username ? `/profile/${profile.username}` : "/onboarding",
      customIcon: profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="Profile" className="w-6 h-6 rounded-full object-cover border border-border" />
      ) : null
    },
  ];

  const bottomNavItems = navItems.filter(item => ["Home", "Search", "Create", "Notifications", "Profile"].includes(item.label));

  return (
    <>
      {/* Fixed Top Navbar */}
      <header className="fixed top-0 inset-x-0 h-14 md:h-16 bg-background/85 border-b border-border/80 z-40 flex items-center justify-between px-4 sm:px-6 backdrop-blur-md shadow-xs">
        
        {/* Left: Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center p-1 group-hover:bg-accent/20 group-hover:scale-105 transition-all">
              <img src="/logo.svg" alt="Techmon Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl md:text-3xl font-heading font-bold tracking-tight text-heading group-hover:text-accent transition-colors">
              Techmon
            </span>
          </Link>
        </div>

        {/* Center: Search (Desktop only) */}
        {user && (
          <div className="hidden md:flex flex-1 max-w-sm mx-8">
            <button 
              onClick={() => setIsSearchModalOpen(true)}
              className="flex items-center justify-between w-full bg-surface/90 border border-border hover:border-heading/60 rounded-xl transition-all h-9.5 px-3.5 text-gray-500 text-xs font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-accent/15 group shadow-2xs"
            >
              <div className="flex items-center">
                <Search className="w-3.5 h-3.5 mr-2 text-muted group-hover:text-accent transition-colors" />
                <span>SEARCH TECHMON...</span>
              </div>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-muted bg-background border border-border rounded">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {/* Desktop Nav Actions */}
              <div className="hidden md:flex items-center gap-3.5 mr-1">
                <Link href="/" title="Home" className={`p-2 rounded-lg hover:bg-gray-100/70 hover:text-accent transition-all active:scale-95 ${pathname === '/' ? 'text-accent bg-accent/10 font-bold' : 'text-heading'}`}>
                  <House className={`w-5 h-5 ${pathname === '/' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </Link>
                <Link href="/feed" title="Feed" className={`p-2 rounded-lg hover:bg-gray-100/70 hover:text-accent transition-all active:scale-95 ${pathname === '/feed' ? 'text-accent bg-accent/10 font-bold' : 'text-heading'}`}>
                  <Clapperboard className={`w-5 h-5 ${pathname === '/feed' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </Link>
                <Link href="/jobs" title="Jobs" className={`p-2 rounded-lg hover:bg-gray-100/70 hover:text-accent transition-all active:scale-95 ${pathname === '/jobs' ? 'text-accent bg-accent/10 font-bold' : 'text-heading'}`}>
                  <Briefcase className={`w-5 h-5 ${pathname === '/jobs' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </Link>
                <Link href="/groups" title="Groups" className={`p-2 rounded-lg hover:bg-gray-100/70 hover:text-accent transition-all active:scale-95 ${pathname === '/groups' ? 'text-accent bg-accent/10 font-bold' : 'text-heading'}`}>
                  <Users2 className={`w-5 h-5 ${pathname === '/groups' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </Link>

                <button onClick={() => setIsNotificationsPanelOpen(true)} title="Notifications" className="relative p-2 rounded-lg hover:bg-gray-100/70 hover:text-accent transition-all active:scale-95 text-heading">
                  <Heart className="w-5 h-5 stroke-2" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full animate-ping" />
                  )}
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
                  )}
                </button>
                
                {/* Create choice dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)} 
                    title="Create"
                    className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg font-mono text-xs uppercase tracking-wider border border-accent hover:bg-accent/90 transition-all shadow-xs hover:shadow-glow-accent active:scale-95"
                  >
                    <Plus className="w-4 h-4 stroke-2" />
                    <span>Post</span>
                  </button>

                  {isCreateMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsCreateMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-52 bg-surface/95 backdrop-blur-md border border-border shadow-xl rounded-xl z-50 py-1.5 divide-y divide-border animate-in fade-in zoom-in-95 duration-150">
                        <button
                          onClick={() => {
                            setIsCreateMenuOpen(false);
                            setIsCreateModalOpen(true);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-100/70 flex items-center gap-3 transition-all group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 group-hover:scale-105 transition-transform">
                            <SquarePen className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-mono text-xs font-semibold uppercase tracking-wider text-heading group-hover:text-accent transition-colors">Article / Note</div>
                            <div className="text-[10px] text-muted font-sans">Text or Media Post</div>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setIsCreateMenuOpen(false);
                            setIsStoryModalOpen(true);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-100/70 flex items-center gap-3 transition-all group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 group-hover:scale-105 transition-transform">
                            <Camera className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-mono text-xs font-semibold uppercase tracking-wider text-heading group-hover:text-accent transition-colors">Story</div>
                            <div className="text-[10px] text-muted font-sans">24-hour dispatch</div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="w-px h-5 bg-border/80 mx-0.5" />

                <Link href="/messages" title="Messages" className="relative p-2 rounded-lg hover:bg-gray-100/70 hover:text-accent transition-all active:scale-95 text-heading">
                  <MessageCircle className="w-5 h-5 stroke-2" />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
                  )}
                </Link>
              </div>

              {/* Mobile Only Header Actions */}
              <div className="flex md:hidden items-center gap-2">
                <Link href="/messages" className="relative p-2 rounded-lg text-heading">
                  <MessageCircle className="w-5 h-5 stroke-2" />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
                  )}
                </Link>
              </div>

              {/* User Avatar Link */}
              <Link
                href={profile?.username ? `/profile/${profile.username}` : "/onboarding"}
                className="w-8.5 h-8.5 rounded-full overflow-hidden border border-heading/30 hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all block shadow-2xs hover:scale-105 active:scale-95"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-surface flex items-center justify-center font-mono text-xs font-bold text-heading">
                    {profile?.name?.charAt(0)?.toUpperCase() || <CircleUserRound className="w-4 h-4" />}
                  </div>
                )}
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="font-mono text-xs uppercase tracking-wider text-heading hover:text-accent transition-colors">Log In</Link>
              <Link href="/signup" className="font-mono text-xs uppercase tracking-wider px-4 py-2 bg-accent text-white hover:bg-accent/90 transition-all border border-accent rounded-lg shadow-xs hover:shadow-glow-accent active:scale-95">Sign Up</Link>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      {user && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-surface border-t border-border z-40 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {bottomNavItems.map((item) => {
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
      )}

      {/* Modals */}
      {user && (
        <>
          <CreatePostModal 
            isOpen={isCreateModalOpen} 
            onClose={() => setIsCreateModalOpen(false)} 
            userId={user.id} 
          />
          <CameraCaptureModal
            isOpen={isStoryModalOpen}
            onClose={() => setIsStoryModalOpen(false)}
            userId={user.id}
            onStoryCreated={() => {
              setIsStoryModalOpen(false);
              window.dispatchEvent(new Event("storyCreated"));
            }}
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
