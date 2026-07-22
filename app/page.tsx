"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PostGrid from "@/components/PostGrid";
import { Post } from "@/lib/types";
import StoriesBar from "@/components/StoriesBar";
import { Users } from "lucide-react";
import ThreeColumnLayout from "@/components/ThreeColumnLayout";
import SuggestedUsers from "@/components/SuggestedUsers";

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ name: string; avatar_url?: string } | null>(null);
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
        .eq("archived", false)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;
      
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = postsData.map(p => p.id);
      const userIds = new Set(postsData.map(p => p.user_id));

      const sharedPostIds = postsData.filter(p => p.type === "repost" && p.shared_post_id).map(p => p.shared_post_id);
      let sharedPostsData: any[] = [];
      if (sharedPostIds.length > 0) {
        const { data: spData } = await supabase.from('posts').select('*').in('id', sharedPostIds);
        if (spData) {
          sharedPostsData = spData;
          spData.forEach(p => userIds.add(p.user_id));
        }
      }

      // 3. Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline, username")
        .in("id", Array.from(userIds));
        
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

      // 5. Fetch if reposted by me
      let myRepostsData: any[] = [];
      if (postIds.length > 0) {
        const targetPostIds = postsData.map(p => p.type === "repost" && p.shared_post_id ? p.shared_post_id : p.id);
        const { data: fetchRepostsData, error: repostsError } = await supabase
          .from("posts")
          .select("shared_post_id")
          .eq("type", "repost")
          .eq("user_id", currentUserId)
          .in("shared_post_id", targetPostIds);
        
        if (repostsError) {
          console.error("Error fetching my reposts:", repostsError);
        } else {
          myRepostsData = fetchRepostsData || [];
        }
      }

      // 6. Fetch saved posts
      let savedPostsData: any[] = [];
      if (postIds.length > 0 && currentUserId) {
        const { data: fetchSavedData, error: savedError } = await supabase
          .from("saved_posts")
          .select("post_id, collection_id")
          .eq("user_id", currentUserId)
          .in("post_id", postIds);
          
        if (savedError) {
          console.error("Error fetching saved posts:", savedError);
        } else {
          savedPostsData = fetchSavedData || [];
        }
      }

      // Merge
      const sharedPostMap = new Map(sharedPostsData.map(p => [p.id, p]));

      const mergedPosts = postsData.map((post) => {
        const postLikes = likesData.filter((l) => l.post_id === post.id);
        const postComments = commentsData.filter((c) => c.post_id === post.id);
        const isLikedByMe = postLikes.some((l) => l.user_id === currentUserId);
        
        const targetPostId = post.type === "repost" && post.shared_post_id ? post.shared_post_id : post.id;
        const isRepostedByMe = myRepostsData.some((r) => r.shared_post_id === targetPostId);
        
        const authorProfile = profileMap.get(post.user_id) || { name: 'Unknown', avatar_url: '', headline: '' };

        const merged: Post = {
          ...post,
          profiles: {
            name: authorProfile.name,
            avatar_url: authorProfile.avatar_url || "",
            headline: authorProfile.headline || "",
          },
          likeCount: postLikes.length,
          commentCount: postComments.length,
          isLikedByMe,
          isRepostedByMe,
          savedCollectionIds: savedPostsData.filter(s => s.post_id === post.id).map(s => s.collection_id),
        };

        if (post.type === "repost" && post.shared_post_id) {
          const original = sharedPostMap.get(post.shared_post_id);
          if (original) {
            const opProfile = profileMap.get(original.user_id) || { name: 'Unknown', avatar_url: '', headline: '' };
            merged.original_post = {
              ...original,
              profiles: {
                name: opProfile.name,
                avatar_url: opProfile.avatar_url || "",
                headline: opProfile.headline || "",
              },
              likeCount: 0,
              commentCount: 0,
              isLikedByMe: false,
            };
          }
        }

        return merged;
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
        // Fetch user profile for stories bar
        const { data: profileData } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("id", uid)
          .single();
        if (profileData) {
          setUserProfile(profileData);
        }
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
    return (
      <div className="min-h-screen py-12 bg-background text-body">
        <div className="max-w-4xl mx-auto px-4 w-full">
          {/* Stories skeleton */}
          <div className="flex gap-4 overflow-hidden py-2 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
                <div className="w-12 h-3 rounded bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="mb-8 space-y-3">
            <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square bg-gray-200"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // LOGGED IN: Following Feed
  if (userId) {
    return (
      <ThreeColumnLayout
        rightColumn={<SuggestedUsers currentUserId={userId} />}
      >
        <div className="flex flex-col gap-6 pb-20 md:pb-0">
          {/* Stories Bar */}
          {userProfile && (
            <StoriesBar userId={userId} userProfile={userProfile} />
          )}

          <div>
            <h1 className="text-2xl font-heading font-bold text-heading">Following</h1>
            <p className="text-sm text-gray-500 mt-1">Posts from people you follow.</p>
          </div>
          
          {!postsLoading && posts.length === 0 ? (
            <div className="bg-surface border border-border shadow-sm rounded-xl p-12 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100 mb-2">
                <Users className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="font-heading font-semibold text-xl text-heading">Welcome to your feed</h3>
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
      </ThreeColumnLayout>
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
