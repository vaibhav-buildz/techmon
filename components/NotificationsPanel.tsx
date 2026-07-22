"use client";

import { useState, useEffect } from "react";
import { X, Heart, UserPlus, MessageCircle, Bell, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import PostDetailModal from "@/components/PostDetailModal";
import { Post } from "@/lib/types";

type NotificationResult = {
  id: string;
  created_at: string;
  type: string;
  post_id: string | null;
  read: boolean;
  actor_id: string;
  actor_profile?: {
    name: string;
    avatar_url: string;
    username?: string;
  };
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onRead: () => void;
};

function timeAgo(dateString: string) {
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
}

export default function NotificationsPanel({ isOpen, onClose, userId, onRead }: Props) {
  const [notifications, setNotifications] = useState<NotificationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Modal State for clicking a post notification
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loadingPost, setLoadingPost] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        // 1. Fetch notifications
        const { data: notifsData, error: notifsError } = await supabase
          .from("notifications")
          .select("*")
          .eq("recipient_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (notifsError) throw notifsError;

        if (!notifsData || notifsData.length === 0) {
          setNotifications([]);
          return;
        }

        const unreadIds = notifsData.filter((n) => !n.read).map((n) => n.id);
        const actorIds = [...new Set(notifsData.map((n) => n.actor_id))];

        // 2. Fetch actor profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, avatar_url, username")
          .in("id", actorIds);

        if (profilesError) throw profilesError;

        const profileMap = new Map(profilesData?.map((p) => [p.id, p]) || []);

        const mergedNotifs = notifsData.map((n) => {
          const profile = profileMap.get(n.actor_id);
          return {
            ...n,
            actor_profile: profile
              ? { name: profile.name, avatar_url: profile.avatar_url || "", username: profile.username }
              : { name: "Someone", avatar_url: "" },
          };
        });

        setNotifications(mergedNotifs);

        // 3. Mark as read
        if (unreadIds.length > 0) {
          const { error: updateError } = await supabase
            .from("notifications")
            .update({ read: true })
            .in("id", unreadIds);

          if (updateError) {
            console.error("Failed to mark notifications as read:", updateError);
          } else {
            // Notify parent to clear badge
            onRead();
          }
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [isOpen, userId, onRead]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleNotificationClick = async (notif: NotificationResult) => {
    if (notif.type === "follow") {
      onClose();
      router.push(`/profile/${notif.actor_profile?.username || notif.actor_id}`);
      return;
    }

    if (notif.post_id) {
      try {
        setLoadingPost(true);
        // Fetch post
        const { data: postData, error: postError } = await supabase
          .from("posts")
          .select("*")
          .eq("id", notif.post_id)
          .single();

        if (postError || !postData) {
          console.error("Post not found");
          return;
        }

        // Fetch author
        const { data: authorData } = await supabase
          .from("profiles")
          .select("name, avatar_url, headline")
          .eq("id", postData.user_id)
          .single();

        // Fetch likes
        const { data: likesData } = await supabase
          .from("likes")
          .select("user_id")
          .eq("post_id", notif.post_id);
          
        // Fetch comments count
        const { data: commentsData } = await supabase
          .from("comments")
          .select("id")
          .eq("post_id", notif.post_id);

        const likeCount = likesData?.length || 0;
        const commentCount = commentsData?.length || 0;
        const isLikedByMe = likesData?.some((l) => l.user_id === userId) || false;

        const fullPost: Post = {
          ...postData,
          profiles: authorData || { name: "Unknown", avatar_url: "", headline: "" },
          likeCount,
          commentCount,
          isLikedByMe,
        };

        setSelectedPost(fullPost);
      } catch (e) {
        console.error("Error opening post:", e);
      } finally {
        setLoadingPost(false);
      }
    }
  };

  const handleLike = async (postId: string, currentlyLiked: boolean) => {
    if (!selectedPost || !userId) return;

    setSelectedPost({
      ...selectedPost,
      isLikedByMe: !currentlyLiked,
      likeCount: currentlyLiked ? Math.max(0, selectedPost.likeCount - 1) : selectedPost.likeCount + 1,
    });

    try {
      if (currentlyLiked) {
        const { error } = await supabase.from("likes").delete().match({ post_id: postId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({ post_id: postId, user_id: userId });
        if (error) throw error;
      }
      window.dispatchEvent(new Event('postUpdated')); // Refresh grid in background
    } catch (err: any) {
      console.error(err);
      // Revert optimistic update
      setSelectedPost({
        ...selectedPost,
        isLikedByMe: currentlyLiked,
        likeCount: currentlyLiked ? selectedPost.likeCount : Math.max(0, selectedPost.likeCount - 1),
      });
      setError("Failed to update like. Please try again.");
      setTimeout(() => setError(null), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
        <div 
          className="bg-surface w-full max-w-lg rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
            <div className="flex items-center gap-2 text-heading">
              <Bell className="w-5 h-5" />
              <h2 className="font-heading font-semibold text-lg">Notifications</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-heading">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {error && (
              <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            {loading ? (
              <div className="py-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-full flex items-start gap-4 px-4 py-4 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0"></div>
                    <div className="flex-1 space-y-2 mt-1">
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-3">
                <Bell className="w-8 h-8 text-gray-300" />
                <p>You don't have any notifications yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notif) => {
                  let icon = null;
                  let text = "";

                  if (notif.type === "like") {
                    icon = <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
                    text = "liked your post";
                  } else if (notif.type === "follow") {
                    icon = <UserPlus className="w-4 h-4 text-accent" />;
                    text = "started following you";
                  } else if (notif.type === "comment") {
                    icon = <MessageCircle className="w-4 h-4 text-blue-500" />;
                    text = "commented on your post";
                  }

                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full flex items-start gap-4 px-4 py-4 transition-colors text-left ${
                        !notif.read ? "bg-accent/5 hover:bg-accent/10" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="relative shrink-0 mt-1">
                        {notif.actor_profile?.avatar_url ? (
                          <img src={notif.actor_profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-border" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-medium text-gray-500 border border-border">
                            {notif.actor_profile?.name ? notif.actor_profile.name.charAt(0).toUpperCase() : "?"}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-surface rounded-full p-0.5 border border-border shadow-sm">
                          {icon}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm text-body leading-snug">
                          <span className="font-heading font-semibold text-heading mr-1">
                            {notif.actor_profile?.name}
                          </span>
                          {text}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {timeAgo(notif.created_at)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <PostDetailModal 
        isOpen={selectedPost !== null}
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        handleLike={handleLike}
        currentUserId={userId}
      />
      
      {/* Loading overlay for fetching post details */}
      {loadingPost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-surface p-4 rounded-xl shadow-lg border border-border flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
            <span className="font-medium text-sm">Loading post...</span>
          </div>
        </div>
      )}
    </>
  );
}
