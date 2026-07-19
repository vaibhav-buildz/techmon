"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import PostGrid from "@/components/PostGrid";
import { Post } from "@/lib/types";

export default function ArchivePage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArchivedPosts = useCallback(async (userId: string) => {
    try {
      setLoading(true);

      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", true)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;
      
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = postsData.map(p => p.id);
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline")
        .eq("id", userId)
        .single();
        
      if (profileError) throw profileError;

      // Fetch likes
      const { data: likesData, error: likesError } = await supabase
        .from("likes")
        .select("post_id, user_id")
        .in("post_id", postIds);

      if (likesError) console.error("Error fetching likes:", likesError);

      // Fetch comments count
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("post_id, id")
        .in("post_id", postIds);

      if (commentsError) console.error("Error fetching comments count:", commentsError);

      // Fetch saved posts
      let savedPostsData: any[] = [];
      const { data: fetchSavedData, error: savedError } = await supabase
        .from("saved_posts")
        .select("post_id, collection_id")
        .eq("user_id", userId)
        .in("post_id", postIds);
        
      if (!savedError && fetchSavedData) {
        savedPostsData = fetchSavedData;
      }

      const mergedPosts = postsData.map((post) => {
        const postLikes = (likesData || []).filter((l) => l.post_id === post.id);
        const postComments = (commentsData || []).filter((c) => c.post_id === post.id);
        const isLikedByMe = postLikes.some((l) => l.user_id === userId);

        return {
          ...post,
          profiles: {
            name: profileData.name,
            avatar_url: profileData.avatar_url || "",
            headline: profileData.headline || "",
          },
          likeCount: postLikes.length,
          commentCount: postComments.length,
          isLikedByMe,
          isRepostedByMe: false, // Archiving reposts is possible, but we don't query it here for simplicity
          savedCollectionIds: savedPostsData.filter(s => s.post_id === post.id).map(s => s.collection_id),
        };
      });

      setPosts(mergedPosts as Post[]);
    } catch (err: any) {
      console.error("Failed to load archived posts:", err.message);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setCurrentUserId(session.user.id);
        fetchArchivedPosts(session.user.id);
      }
    };
    
    checkAuth();
  }, [router, fetchArchivedPosts]);

  // Listen for custom events from Modals
  useEffect(() => {
    if (!currentUserId) return;

    const handleRefresh = () => {
      fetchArchivedPosts(currentUserId);
    };

    window.addEventListener('postCreated', handleRefresh);
    window.addEventListener('postDeleted', handleRefresh);
    window.addEventListener('postUpdated', handleRefresh);
    
    return () => {
      window.removeEventListener('postCreated', handleRefresh);
      window.removeEventListener('postDeleted', handleRefresh);
      window.removeEventListener('postUpdated', handleRefresh);
    };
  }, [currentUserId, fetchArchivedPosts]);

  if (!currentUserId) return null;

  return (
    <main className="min-h-screen bg-background">


      <div className="max-w-3xl mx-auto px-4 pt-24 pb-12">
        <h1 className="text-2xl font-heading font-bold text-heading mb-6">Archive</h1>
        
        {loading ? (
          <PostGrid posts={[]} loading={true} currentUserId={currentUserId} />
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500 font-medium bg-surface border border-border rounded-xl">
            No archived posts
          </div>
        ) : (
          <PostGrid posts={posts} loading={false} currentUserId={currentUserId} />
        )}
      </div>
    </main>
  );
}
