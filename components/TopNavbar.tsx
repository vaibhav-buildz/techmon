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
  SquarePen
} from "lucide-react";

type UserProfile = {
  id: string;
  name: string;
  avatar_url?: string;
  username?: string;
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
      }
    };
    fetchUnread();

    const channel = supabase
      .channel('navbar-messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);


  const navItems = [
    { label: "Home", icon: House, href: "/" },
    { label: "Search", icon: Search, onClick: () => setIsSearchModalOpen(true) },
    { label: "Feed", icon: Clapperboard, href: "/feed" },
    { label: "Messages", icon: MessageCircle, href: "/messages" },
    { label: "Notifications", icon: Heart, onClick: () => setIsNotificationsPanelOpen(true) },
    { label: "Create", icon: PlusSquare, onClick: () => setIsCreateMenuOpen(!isCreateMenuOpen) },
    { 
      label: "Profile", 
      icon: profile?.avatar_url ? null : CircleUserRound, 
      href: `/profile/${profile?.username || user?.id}`,
      customIcon: profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="Profile" className="w-6 h-6 rounded-full object-cover border border-border" />
      ) : null
    },
  ];

  const bottomNavItems = navItems.filter(item => ["Home", "Search", "Create", "Notifications", "Profile"].includes(item.label));

  return (
    <>
      {/* Fixed Top Navbar */}
      <header className="fixed top-0 inset-x-0 h-14 md:h-16 bg-surface border-b border-border z-40 flex items-center justify-between px-4 sm:px-6">
        
        {/* Left: Logo */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/logo.svg" alt="Techmon Logo" className="w-7 h-7 md:w-8 md:h-8 group-hover:opacity-90 transition-opacity" />
            <span className="text-xl md:text-2xl font-heading font-bold tracking-tight text-heading group-hover:text-accent transition-colors">
              Techmon
            </span>
          </Link>
        </div>

        {/* Center: Search (Desktop only) */}
        {user && (
          <div className="hidden md:flex flex-1 max-w-sm mx-8">
            <button 
              onClick={() => setIsSearchModalOpen(true)}
              className="flex items-center w-full bg-gray-100 hover:bg-gray-200 transition-colors h-10 rounded-full px-4 text-gray-500 text-sm font-medium focus:outline-none"
            >
              <Search className="w-4 h-4 mr-2" />
              <span>Search Techmon...</span>
            </button>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              {/* Desktop Nav Actions */}
              <div className="hidden md:flex items-center gap-3 mr-3">
                <Link href="/" title="Home" className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${pathname === '/' ? 'text-accent' : 'text-body'}`}>
                  <House className={`w-6 h-6 ${pathname === '/' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </Link>
                <Link href="/feed" title="Feed" className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${pathname === '/feed' ? 'text-accent' : 'text-body'}`}>
                  <Clapperboard className={`w-6 h-6 ${pathname === '/feed' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </Link>
                <button onClick={() => setIsNotificationsPanelOpen(true)} title="Notifications" className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-body">
                  <Heart className="w-6 h-6 stroke-2" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface"></span>
                  )}
                </button>
                
                {/* Create choice dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)} 
                    title="Create"
                    className="flex items-center gap-1.5 px-4 py-2 ml-1 rounded-full bg-accent text-white hover:bg-accent/90 transition-colors font-medium shadow-sm"
                  >
                    <Plus className="w-5 h-5 stroke-2" />
                    <span>Post</span>
                  </button>

                  {isCreateMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsCreateMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-44 bg-surface border border-border shadow-xl rounded-2xl overflow-hidden z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                        <button
                          onClick={() => {
                            setIsCreateMenuOpen(false);
                            setIsCreateModalOpen(true);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium text-heading hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                            <SquarePen className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold">Post</div>
                            <div className="text-[11px] text-body font-normal">Note or Photo/Video</div>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setIsCreateMenuOpen(false);
                            setIsStoryModalOpen(true);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium text-heading hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 text-white flex items-center justify-center">
                            <Camera className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold">Story</div>
                            <div className="text-[11px] text-body font-normal">24-hour photo or video</div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="w-px h-8 bg-border mx-1" />

                <Link href="/messages" title="Messages" className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-body">
                  <MessageCircle className="w-6 h-6 stroke-2" />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface"></span>
                  )}
                </Link>
              </div>

              {/* Mobile Only Header Actions (if any) */}
              <div className="flex md:hidden items-center gap-2">
                <Link href="/messages" className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-body">
                  <MessageCircle className="w-6 h-6 stroke-2" />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface"></span>
                  )}
                </Link>
              </div>

              {/* User Avatar Link */}
              <Link
                href={`/profile/${profile?.username || user.id}`}
                className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden border border-border focus:outline-none hover:ring-2 hover:ring-accent transition-all block"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-background flex items-center justify-center text-sm font-semibold text-gray-500">
                    {profile?.name?.charAt(0)?.toUpperCase() || <CircleUserRound className="w-5 h-5" />}
                  </div>
                )}
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-medium text-heading hover:text-accent transition-colors">Log In</Link>
              <Link href="/signup" className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors">Sign Up</Link>
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
