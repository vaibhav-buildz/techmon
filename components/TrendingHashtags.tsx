"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Hash, TrendingUp } from "lucide-react";

export default function TrendingHashtags() {
  const [hashtags, setHashtags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrending = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from("trending_hashtags_view")
        .select("*")
        .limit(5);

      setHashtags(data || []);
    } catch (err) {
      console.error("Error fetching trending hashtags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 animate-pulse mt-4">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-2 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hashtags.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm mt-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-gray-500" />
        <h3 className="font-heading font-semibold text-heading">Trending</h3>
      </div>
      
      <div className="flex flex-col gap-3">
        {hashtags.map((tag) => (
          <Link
            key={tag.tag}
            href={`/hashtag/${tag.tag}`}
            className="flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-50 border border-border flex items-center justify-center shrink-0 group-hover:bg-gray-100 transition-colors">
                <Hash className="w-5 h-5 text-gray-400 group-hover:text-heading transition-colors" />
              </div>
              <div className="flex flex-col">
                <span className="font-heading font-semibold text-sm text-heading group-hover:text-accent transition-colors">
                  #{tag.tag}
                </span>
                <span className="text-xs text-gray-500">
                  {tag.post_count} post{tag.post_count === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
