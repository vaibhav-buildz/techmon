"use client";

import { useState, useEffect, useCallback } from "react";
import { X, UserPlus, UserCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type ProfileListItem = {
  id: string;
  name: string;
  avatar_url?: string;
  headline?: string;
  isFollowing?: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  currentUserId: string | null;
};

export default function LikesModal({
  isOpen,
  onClose,
  postId,
  currentUserId,
}: Props) {
  const [users, setUsers] = useState<ProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!postId) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch from likes table
      const { data: likesRows, error } = await supabase
        .from("likes")
        .select("user_id")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });
        
      if (error) throw error;

      const targetIds = (likesRows || []).map((r) => r.user_id);

      if (targetIds.length === 0) {
        setUsers([]);
        return;
      }

      // 2. Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline")
        .in("id", targetIds);

      if (profilesError) throw profilesError;

      // 3. Check who the current user follows
      let followingSet = new Set<string>();
      if (currentUserId) {
        const { data: myFollowing } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUserId)
          .in("following_id", targetIds);
        
        myFollowing?.forEach((f) => followingSet.add(f.following_id));
      }

      const mappedUsers = targetIds.map(id => {
        const p = profiles?.find(prof => prof.id === id);
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          avatar_url: p.avatar_url || undefined,
          headline: p.headline || undefined,
          isFollowing: currentUserId ? followingSet.has(p.id) : undefined,
        };
      }).filter(Boolean) as ProfileListItem[];

      setUsers(mappedUsers);
    } catch (err: any) {
      console.error(`Error fetching likes:`, err);
      setError(`Failed to load likes.`);
    } finally {
      setLoading(false);
    }
  }, [postId, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  if (!isOpen) return null;

  const handleFollow = async (targetId: string) => {
    if (!currentUserId || actionLoadingId) return;
    setActionLoadingId(targetId);

    try {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: currentUserId, following_id: targetId });
      
      if (error) throw error;

      // Create notification
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          recipient_id: targetId,
          actor_id: currentUserId,
          type: "follow",
          post_id: null,
        });

      if (notifError) {
        console.error("Error creating follow notification:", notifError);
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, isFollowing: true } : u))
      );
    } catch (err: any) {
      console.error("Error following user:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnfollow = async (targetId: string) => {
    if (!currentUserId || actionLoadingId) return;
    setActionLoadingId(targetId);

    try {
      const { error } = await supabase
        .from("follows")
        .delete()
        .match({ follower_id: currentUserId, following_id: targetId });
      
      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, isFollowing: false } : u))
      );
    } catch (err: any) {
      console.error("Error unfollowing user:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-xl font-heading font-bold text-heading">Likes</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-heading hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div>
              <p className="mt-4 text-sm text-gray-500 font-medium">Loading likes...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
              <p className="text-red-600 font-medium">{error}</p>
              <button 
                onClick={fetchUsers}
                className="mt-4 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <UserCheck className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">No likes yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between group">
                  <Link 
                    href={`/profile/${user.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        className="w-12 h-12 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 border border-border flex items-center justify-center text-sm font-bold text-gray-400">
                        {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="font-heading font-semibold text-heading truncate">
                        {user.name}
                      </div>
                      <div className="text-xs text-body truncate font-mono mt-0.5">
                        {user.headline || "No headline"}
                      </div>
                    </div>
                  </Link>

                  {currentUserId && currentUserId !== user.id && (
                    <button
                      onClick={() => user.isFollowing ? handleUnfollow(user.id) : handleFollow(user.id)}
                      disabled={actionLoadingId === user.id}
                      className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                        user.isFollowing
                          ? "bg-surface border border-border text-heading hover:bg-gray-50"
                          : "bg-accent text-white hover:bg-accent/90"
                      } ${actionLoadingId === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {user.isFollowing ? (
                        <>Following</>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" /> Follow
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
