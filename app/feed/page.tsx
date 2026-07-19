"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import PostGrid from "@/components/PostGrid";
import { Post } from "@/lib/types";
import ThreeColumnLayout from "@/components/ThreeColumnLayout";
import SuggestedUsers from "@/components/SuggestedUsers";

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

      // 2. Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline")
        .in("id", Array.from(userIds));
        
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

      // 5. Fetch if reposted by me
      let myRepostsData: any[] = [];
      if (postIds.length > 0 && viewerId) {
        const targetPostIds = postsData.map(p => p.type === "repost" && p.shared_post_id ? p.shared_post_id : p.id);
        const { data: fetchRepostsData, error: repostsError } = await supabase
          .from("posts")
          .select("shared_post_id")
          .eq("type", "repost")
          .eq("user_id", viewerId)
          .in("shared_post_id", targetPostIds);
        
        if (repostsError) {
          console.error("Error fetching my reposts:", repostsError);
        } else {
          myRepostsData = fetchRepostsData || [];
        }
      }

      // 6. Fetch saved posts
      let savedPostsData: any[] = [];
      if (postIds.length > 0 && viewerId) {
        const { data: fetchSavedData, error: savedError } = await supabase
          .from("saved_posts")
          .select("post_id, collection_id")
          .eq("user_id", viewerId)
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
        const isLikedByMe = viewerId ? postLikes.some((l) => l.user_id === viewerId) : false;
        
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
    <ThreeColumnLayout
      rightColumn={<SuggestedUsers currentUserId={currentUserId} />}
    >
      <div className="flex flex-col gap-6 pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-heading font-bold text-heading">Explore</h1>
          <p className="text-sm text-gray-500 mt-1">Discover posts from developers around the world.</p>
        </div>
        
        <PostGrid posts={posts} loading={loading} currentUserId={currentUserId} />
      </div>
    </ThreeColumnLayout>
  );
}
