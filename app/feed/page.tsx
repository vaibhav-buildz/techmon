"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import PostGrid from "@/components/PostGrid";
import { Post } from "@/components/PostDetailModal";

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchPosts = useCallback(async (viewerId: string | null) => {
    try {
      setLoading(true);
      
      // 1. Fetch all posts
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;
      
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = postsData.map(p => p.id);
      const userIds = [...new Set(postsData.map(p => p.user_id))];

      // 2. Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline")
        .in("id", userIds);
        
      if (profilesError) throw profilesError;

      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // 3. Fetch likes
      let likesData: any[] = [];
      if (postIds.length > 0) {
        const { data: fetchLikesData, error: likesError } = await supabase
          .from("likes")
          .select("post_id, user_id")
          .in("post_id", postIds);

        if (likesError) {
          console.error("Error fetching likes:", likesError);
        } else {
          likesData = fetchLikesData || [];
        }
      }

      // 4. Fetch comments count
      let commentsData: any[] = [];
      if (postIds.length > 0) {
        const { data: fetchCommentsData, error: commentsError } = await supabase
          .from("comments")
          .select("post_id")
          .in("post_id", postIds);

        if (commentsError) {
          console.error("Error fetching comments:", commentsError);
        } else {
          commentsData = fetchCommentsData || [];
        }
      }

      // Merge
      const mergedPosts = postsData.map((post) => {
        const postLikes = likesData.filter((l) => l.post_id === post.id);
        const postComments = commentsData.filter((c) => c.post_id === post.id);
        const isLikedByMe = viewerId ? postLikes.some((l) => l.user_id === viewerId) : false;
        const authorProfile = profileMap.get(post.user_id) || { name: 'Unknown', avatar_url: '', headline: '' };

        return {
          ...post,
          profiles: {
            name: authorProfile.name,
            avatar_url: authorProfile.avatar_url || "",
            headline: authorProfile.headline || "",
          },
          likeCount: postLikes.length,
          commentCount: postComments.length,
          isLikedByMe,
        };
      });

      setPosts(mergedPosts as Post[]);
    } catch (err: any) {
      console.error("Posts fetch failed:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      setCurrentUserId(userId);
      fetchPosts(userId);
    };
    init();
  }, [fetchPosts]);

  // Listen for custom events
  useEffect(() => {
    const handleRefresh = () => {
      fetchPosts(currentUserId);
    };

    window.addEventListener('postCreated', handleRefresh);
    window.addEventListener('postDeleted', handleRefresh);
    window.addEventListener('postUpdated', handleRefresh);
    
    return () => {
      window.removeEventListener('postCreated', handleRefresh);
      window.removeEventListener('postDeleted', handleRefresh);
      window.removeEventListener('postUpdated', handleRefresh);
    };
  }, [currentUserId, fetchPosts]);

  return (
    <div className="min-h-screen py-12 bg-background text-body">
      <div className="max-w-4xl mx-auto px-4 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-heading">Explore</h1>
          <p className="text-body mt-2">Discover posts from developers around the world.</p>
        </div>
        
        <PostGrid posts={posts} loading={loading} currentUserId={currentUserId} />
      </div>
    </div>
  );
}
