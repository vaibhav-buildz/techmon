"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CircleUserRound } from "lucide-react";
import FollowListModal from "./FollowListModal";

export default function MiniProfileCard({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);

  // Modals state
  const [followListModalOpen, setFollowListModalOpen] = useState(false);
  const [followListType, setFollowListType] = useState<"followers" | "following">("followers");

  const fetchProfileAndCounts = useCallback(async () => {
    if (!userId) return;
    try {
      // 1. Profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, name, headline, avatar_url")
        .eq("id", userId)
        .single();
      
      setProfile(profileData);

      // 2. Counts
      const [followersRes, followingRes, postsRes] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", userId)
      ]);

      setCounts({
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
        posts: postsRes.count || 0,
      });
    } catch (err) {
      console.error("Error fetching mini profile:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfileAndCounts();
  }, [fetchProfileAndCounts]);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 animate-pulse">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-gray-200" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <>
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Cover Photo Placeholder */}
        <div className="h-16 bg-accent/10 w-full relative" />
        
        <div className="px-4 pb-4 -mt-8 flex flex-col items-center text-center">
          <Link href={`/profile/${userId}`} className="block relative bg-surface p-1 rounded-full hover:opacity-90 transition-opacity">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-background border border-border flex items-center justify-center text-xl font-medium text-gray-500">
                {profile.name?.charAt(0)?.toUpperCase() || <CircleUserRound className="w-8 h-8" />}
              </div>
            )}
          </Link>
          
          <Link href={`/profile/${userId}`} className="mt-2 block hover:underline">
            <h2 className="font-heading font-semibold text-heading text-lg">{profile.name}</h2>
          </Link>
          <p className="text-sm font-mono text-body mt-1 line-clamp-2">{profile.headline || "Add a headline in your profile"}</p>
        </div>

        <div className="border-t border-border flex justify-between text-center divide-x divide-border">
          <div className="flex-1 flex flex-col py-3">
            <span className="text-sm font-semibold text-heading">{counts.posts}</span>
            <span className="text-xs text-gray-500">Posts</span>
          </div>
          <button 
            onClick={() => { setFollowListType("followers"); setFollowListModalOpen(true); }}
            className="flex-1 flex flex-col py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-heading">{counts.followers}</span>
            <span className="text-xs text-gray-500">Followers</span>
          </button>
          <button 
            onClick={() => { setFollowListType("following"); setFollowListModalOpen(true); }}
            className="flex-1 flex flex-col py-3 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-heading">{counts.following}</span>
            <span className="text-xs text-gray-500">Following</span>
          </button>
        </div>
      </div>

      <FollowListModal
        isOpen={followListModalOpen}
        onClose={() => setFollowListModalOpen(false)}
        type={followListType}
        profileId={userId}
        currentUserId={userId}
        isOwner={true}
        onCountChange={fetchProfileAndCounts}
      />
    </>
  );
}
