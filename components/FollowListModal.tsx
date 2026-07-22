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
  username?: string;
  isFollowingBack?: boolean; // Only relevant for followers of own profile
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  type: "followers" | "following";
  profileId: string;
  currentUserId: string | null;
  isOwner: boolean;
  onCountChange?: () => void;
};

export default function FollowListModal({
  isOpen,
  onClose,
  type,
  profileId,
  currentUserId,
  isOwner,
  onCountChange,
}: Props) {
  const [users, setUsers] = useState<ProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!profileId) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch from follows table
      let followRows: any[] = [];
      if (type === "followers") {
        const { data, error } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", profileId);
        if (error) throw error;
        followRows = data || [];
      } else {
        const { data, error } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", profileId);
        if (error) throw error;
        followRows = data || [];
      }

      const targetIds = followRows.map((r) => 
        type === "followers" ? r.follower_id : r.following_id
      );

      if (targetIds.length === 0) {
        setUsers([]);
        return;
      }

      // 2. Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline, username")
        .in("id", targetIds);

      if (profilesError) throw profilesError;

      // 3. If viewing own followers list, check who we follow back
      let followingSet = new Set<string>();
      if (isOwner && type === "followers" && currentUserId) {
        const { data: myFollowing } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUserId);
        
        myFollowing?.forEach((f) => followingSet.add(f.following_id));
      }

      const mappedUsers = (profiles || []).map((p) => ({
        id: p.id,
        name: p.name,
        avatar_url: p.avatar_url || undefined,
        headline: p.headline || undefined,
        isFollowingBack: isOwner && type === "followers" ? followingSet.has(p.id) : undefined,
      }));

      setUsers(mappedUsers);
    } catch (err: any) {
      console.error(`Error fetching ${type}:`, err);
      setError(`Failed to load ${type}.`);
    } finally {
      setLoading(false);
    }
  }, [profileId, type, isOwner, currentUserId]);

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

      // Update local state
      setUsers((current) =>
        current.map((u) => (u.id === targetId ? { ...u, isFollowingBack: true } : u))
      );

      if (onCountChange) onCountChange();
    } catch (err: any) {
      console.error("Error following user:", err);
      alert("Failed to follow user. Please try again.");
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

      // Update local state
      if (type === "following") {
        // If we are looking at our own following list, remove them from the list
        setUsers((current) => current.filter((u) => u.id !== targetId));
      } else {
        // If we are looking at followers, just update the follow-back state
        setUsers((current) =>
          current.map((u) => (u.id === targetId ? { ...u, isFollowingBack: false } : u))
        );
      }

      if (onCountChange) onCountChange();
    } catch (err: any) {
      console.error("Error unfollowing user:", err);
      alert("Failed to unfollow user. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-heading font-semibold text-heading text-lg capitalize">
            {type}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-body hover:text-heading hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-normal">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="space-y-4 py-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-body font-medium text-sm">
                {type === "followers" ? "No followers yet" : "Not following anyone yet"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/profile/${user.username || user.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 flex-1 min-w-0 mr-3 hover:opacity-80 transition-opacity"
                  >
                    {/* Avatar */}
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-sm font-semibold text-gray-400 shrink-0">
                        {user.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}

                    {/* Meta */}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-heading truncate">
                        {user.name}
                      </p>
                      {user.headline && (
                        <p className="text-xs text-body truncate font-mono mt-0.5">
                          {user.headline}
                        </p>
                      )}
                    </div>
                  </Link>

                  {/* Actions (Only for Own Profile) */}
                  {isOwner && currentUserId && user.id !== currentUserId && (
                    <div className="shrink-0">
                      {type === "followers" && !user.isFollowingBack && (
                        <button
                          onClick={() => handleFollow(user.id)}
                          disabled={actionLoadingId === user.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Follow</span>
                        </button>
                      )}

                      {type === "followers" && user.isFollowingBack && (
                        <button
                          onClick={() => handleUnfollow(user.id)}
                          disabled={actionLoadingId === user.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-heading text-xs font-semibold rounded-lg hover:border-red-500 hover:text-red-600 transition-colors disabled:opacity-50 group"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-accent group-hover:hidden" />
                          <span className="group-hover:hidden">Following</span>
                          <span className="hidden group-hover:inline">Unfollow</span>
                        </button>
                      )}

                      {type === "following" && (
                        <button
                          onClick={() => handleUnfollow(user.id)}
                          disabled={actionLoadingId === user.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-heading text-xs font-semibold rounded-lg hover:border-red-500 hover:text-red-600 transition-colors disabled:opacity-50 group"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-accent group-hover:hidden" />
                          <span className="group-hover:hidden">Following</span>
                          <span className="hidden group-hover:inline">Unfollow</span>
                        </button>
                      )}
                    </div>
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
