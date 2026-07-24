"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CircleUserRound, Users } from "lucide-react";

type Props = {
  currentUserId: string | null;
  layout?: "vertical" | "horizontal" | "modal";
  limit?: number;
  excludeProfileId?: string;
};

export default function SuggestedUsers({
  currentUserId,
  layout = "vertical",
  limit = 5,
  excludeProfileId,
}: Props) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      
      let excludeIds = currentUserId ? [currentUserId] : [];
      if (excludeProfileId && !excludeIds.includes(excludeProfileId)) {
        excludeIds.push(excludeProfileId);
      }

      if (currentUserId) {
        const { data: followData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUserId);

        if (followData) {
          const followedIds = followData.map((f) => f.following_id);
          followedIds.forEach(id => {
            if (!excludeIds.includes(id)) excludeIds.push(id);
          });
        }
      }

      const excludeString = `(${excludeIds.join(',')})`;

      let query = supabase
        .from("profiles")
        .select("id, name, headline, avatar_url, username")
        .limit(limit);

      if (excludeIds.length > 0) {
        query = query.not("id", "in", excludeString);
      }

      const { data } = await query;
      setSuggestions(data || []);
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, limit, excludeProfileId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleFollow = async (targetId: string) => {
    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }
    try {
      setProcessingId(targetId);
      await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: targetId,
      });
      // Remove from suggestions
      setSuggestions(prev => prev.filter(p => p.id !== targetId));
    } catch (err) {
      console.error("Error following:", err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
        <div className={layout === "horizontal" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" : "space-y-4"}>
          {[1, 2, 3].slice(0, limit).map(i => (
            <div key={i} className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-2 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-gray-500" />
        <h3 className="font-heading font-semibold text-heading">Suggested for you</h3>
      </div>
      
      <div className={layout === "horizontal" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" : "space-y-4"}>
        {suggestions.map((profile) => (
          <div key={profile.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-gray-50/50 transition-colors">
            <Link href={`/profile/${(profile as any).username || profile.id}`} className="flex items-center gap-3 min-w-0 group flex-1">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-10 h-10 rounded-full object-cover shrink-0 border border-border group-hover:opacity-90 transition-opacity" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center shrink-0 group-hover:opacity-90 transition-opacity text-sm font-medium text-gray-500">
                  {profile.name?.charAt(0)?.toUpperCase() || <CircleUserRound className="w-5 h-5" />}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-sm text-heading truncate group-hover:underline">{profile.name}</p>
                <p className="text-xs font-mono text-gray-500 truncate">{profile.headline || "Developer"}</p>
              </div>
            </Link>
            
            <button
              onClick={() => handleFollow(profile.id)}
              disabled={processingId === profile.id}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 shrink-0"
            >
              {processingId === profile.id ? "..." : "Follow"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
