"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import PostGrid from "@/components/PostGrid";
import { Post } from "@/lib/types";
import { Hash } from "lucide-react";

export default function HashtagPage({ params }: { params: { tag: string } }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  const tag = params.tag.toLowerCase();

  const fetchPosts = useCallback(async (userId: string | null) => {
    try {
      setLoading(true);

      // 1. Get hashtag ID
      const { data: hashtagData, error: tagError } = await supabase
        .from("hashtags")
        .select("id")
        .eq("tag", tag)
        .single();
        
      if (tagError || !hashtagData) {
        setPosts([]);
        return;
      }

      // 2. Get post IDs linked to this hashtag
      const { data: postHashtags, error: linkError } = await supabase
        .from("post_hashtags")
        .select("post_id")
        .eq("hashtag_id", hashtagData.id);

      if (linkError || !postHashtags || postHashtags.length === 0) {
        setPosts([]);
        return;
      }
      
      const postIds = postHashtags.map(ph => ph.post_id);

      // 3. Fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .in("id", postIds)
        .eq("archived", false)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;
      
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const userIds = new Set(postsData.map(p => p.user_id));
      
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline")
        .in("id", Array.from(userIds));

      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const { data: likesData } = await supabase
        .from("likes")
        .select("post_id, user_id")
        .in("post_id", postIds);

      const { data: commentsData } = await supabase
        .from("comments")
        .select("post_id, id")
        .in("post_id", postIds);

      let savedPostsData: any[] = [];
      if (userId) {
        const { data: fetchSavedData } = await supabase
          .from("saved_posts")
          .select("post_id, collection_id")
          .in("post_id", postIds)
          .eq("user_id", userId);
        savedPostsData = fetchSavedData || [];
      }

      const mergedPosts = postsData.map(post => {
        const pProfile = profileMap.get(post.user_id) || { name: 'Unknown', avatar_url: '', headline: '' };
        
        const postLikes = likesData?.filter(l => l.post_id === post.id) || [];
        const postComments = commentsData?.filter(c => c.post_id === post.id) || [];
        
        const isLikedByMe = userId ? postLikes.some(l => l.user_id === userId) : false;
        const savedCollectionIds = savedPostsData.filter(sp => sp.post_id === post.id).map(sp => sp.collection_id);
        
        return {
          ...post,
          profiles: {
            name: pProfile.name,
            avatar_url: pProfile.avatar_url || "",
            headline: pProfile.headline || "",
          },
          likeCount: postLikes.length,
          commentCount: postComments.length,
          isLikedByMe,
          savedCollectionIds
        };
      });

      setPosts(mergedPosts as Post[]);
    } catch (err: any) {
      console.error("Hashtag posts fetch failed:", err.message);
    } finally {
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      setCurrentUserId(userId);
      fetchPosts(userId);
    };
    init();
  }, [fetchPosts]);

  return (
    <div className="flex flex-col gap-6 pb-20 md:pb-0 pt-6 px-4 md:px-0 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-4 bg-surface p-6 rounded-2xl border border-border shadow-sm">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center shrink-0 border border-gray-200">
          <Hash className="w-8 h-8 text-gray-500" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-heading">#{tag}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? "Loading..." : `${posts.length} post${posts.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
      
      <PostGrid posts={posts} loading={loading} currentUserId={currentUserId} />
    </div>
  );
}
