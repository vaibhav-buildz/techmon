"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PostGrid from "@/components/PostGrid";
import { Post } from "@/components/PostDetailModal";

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Following Feed State
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const fetchFollowingPosts = useCallback(async (currentUserId: string) => {
    try {
      setPostsLoading(true);
      
      // 1. Fetch followed users
      const { data: followData, error: followError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId);

      if (followError) throw followError;

      const followingIds = followData?.map(f => f.following_id) || [];
      
      if (followingIds.length === 0) {
        setPosts([]);
        return;
      }

      // 2. Fetch posts from followed users
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .in("user_id", followingIds)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;
      
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = postsData.map(p => p.id);
      const userIds = [...new Set(postsData.map(p => p.user_id))];

      // 3. Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline")
        .in("id", userIds);
        
      if (profilesError) throw profilesError;

      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // 4. Fetch likes
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
        const isLikedByMe = postLikes.some((l) => l.user_id === currentUserId);
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
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || null;
      setUserId(uid);
      setLoading(false);
      
      if (uid) {
        fetchFollowingPosts(uid);
      } else {
        setPostsLoading(false);
      }
    };
    
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (uid) {
        fetchFollowingPosts(uid);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchFollowingPosts]);

  // Listen for custom events
  useEffect(() => {
    if (!userId) return;
    const handleRefresh = () => {
      fetchFollowingPosts(userId);
    };

    window.addEventListener('postCreated', handleRefresh);
    window.addEventListener('postDeleted', handleRefresh);
    window.addEventListener('postUpdated', handleRefresh);
    
    return () => {
      window.removeEventListener('postCreated', handleRefresh);
      window.removeEventListener('postDeleted', handleRefresh);
      window.removeEventListener('postUpdated', handleRefresh);
    };
  }, [userId, fetchFollowingPosts]);

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  // LOGGED IN: Following Feed
  if (userId) {
    return (
      <div className="min-h-screen py-12 bg-background text-body">
        <div className="max-w-4xl mx-auto px-4 w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-heading font-bold text-heading">Following</h1>
            <p className="text-body mt-2">Posts from people you follow.</p>
          </div>
          
          {!postsLoading && posts.length === 0 ? (
            <div className="bg-surface border border-border shadow-sm rounded-xl p-12 text-center flex flex-col items-center gap-4">
              <p className="text-gray-500 font-medium">Follow people to see their posts here.</p>
              <Link 
                href="/feed"
                className="px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors"
              >
                Explore Techmon
              </Link>
            </div>
          ) : (
            <PostGrid posts={posts} loading={postsLoading} currentUserId={userId} />
          )}
        </div>
      </div>
    );
  }

  // LOGGED OUT: Landing Page
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-background text-body px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold tracking-tight text-heading">
          The network for people who build.
        </h1>
        
        <p className="text-lg sm:text-xl text-body max-w-2xl mx-auto leading-relaxed">
          Connect with tech students and professionals. Share projects, code, and ideas.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 min-h-[60px]">
          <Link
            href="/signup"
            className="px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors w-full sm:w-auto"
          >
            Sign Up
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 bg-surface border border-border shadow-sm text-heading font-medium rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto"
          >
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
