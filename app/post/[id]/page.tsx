"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Post } from "@/lib/types";
import PostDetailView from "@/components/PostDetailView";

export default function StandalonePostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async (viewerId: string | null) => {
    try {
      setLoading(true);
      setError(null);

      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select("*")
        .eq("id", postId)
        .single();

      if (postError) {
        if (postError.code === "PGRST116") {
          setError("Post not found.");
        } else {
          throw postError;
        }
        return;
      }

      // Collect user IDs to fetch profiles
      const userIdsToFetch = new Set<string>();
      userIdsToFetch.add(postData.user_id);

      // Fetch original post if repost
      let originalPostData = null;
      if (postData.type === "repost" && postData.shared_post_id) {
        const { data: opData } = await supabase
          .from("posts")
          .select("*")
          .eq("id", postData.shared_post_id)
          .single();
        
        if (opData) {
          originalPostData = opData;
          userIdsToFetch.add(opData.user_id);
        }
      }

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline")
        .in("id", Array.from(userIdsToFetch));
        
      if (profilesError) throw profilesError;
      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Fetch likes
      const { data: likesData, error: likesError } = await supabase
        .from("likes")
        .select("user_id")
        .eq("post_id", postData.id);

      if (likesError) console.error("Error fetching likes:", likesError);

      // Fetch comments count
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("id")
        .eq("post_id", postData.id);

      if (commentsError) console.error("Error fetching comments count:", commentsError);

      const postLikes = likesData || [];
      const isLikedByMe = viewerId ? postLikes.some((l) => l.user_id === viewerId) : false;
      
      const authorProfile = profileMap.get(postData.user_id) || { name: 'Unknown', avatar_url: '', headline: '' };

      const mergedPost: Post = {
        ...postData,
        profiles: {
          name: authorProfile.name,
          avatar_url: authorProfile.avatar_url || "",
          headline: authorProfile.headline || "",
        },
        likeCount: postLikes.length,
        commentCount: (commentsData || []).length,
        isLikedByMe,
      };

      if (originalPostData) {
        const opProfile = profileMap.get(originalPostData.user_id) || { name: 'Unknown', avatar_url: '', headline: '' };
        mergedPost.original_post = {
          ...originalPostData,
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

      setPost(mergedPost);
    } catch (err: any) {
      console.error("Failed to fetch post:", err);
      setError("Failed to load post.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      setCurrentUserId(userId);
      fetchPost(userId);
    };
    init();
  }, [fetchPost]);

  const handleLike = async (id: string, currentlyLiked: boolean) => {
    if (!currentUserId || !post) return;

    // Optimistic
    setPost({
      ...post,
      isLikedByMe: !currentlyLiked,
      likeCount: currentlyLiked ? Math.max(0, post.likeCount - 1) : post.likeCount + 1,
    });

    try {
      if (currentlyLiked) {
        await supabase
          .from("likes")
          .delete()
          .match({ post_id: id, user_id: currentUserId });
      } else {
        await supabase
          .from("likes")
          .insert({ post_id: id, user_id: currentUserId });
          
        if (post.user_id !== currentUserId) {
          await supabase
            .from("notifications")
            .insert({
              recipient_id: post.user_id,
              actor_id: currentUserId,
              type: "like",
              post_id: id
            });
        }
      }
    } catch (err) {
      console.error("Error toggling like:", err);
      // Revert
      setPost({
        ...post,
        isLikedByMe: currentlyLiked,
        likeCount: currentlyLiked ? post.likeCount : Math.max(0, post.likeCount - 1),
      });
    }
  };

  const handleClose = () => {
    // Go back, or if opened directly, go to home
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="px-4 pb-20 pt-6 flex justify-center w-full">
      <div className="w-full max-w-2xl bg-surface border border-border shadow-sm rounded-2xl overflow-hidden min-h-[60vh] flex flex-col relative">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error || !post ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100">
                <span className="text-2xl">😕</span>
              </div>
              <h2 className="text-xl font-heading font-semibold text-heading">{error || "Post not found"}</h2>
              <p className="text-body text-sm text-gray-500">This post may have been deleted or the link is invalid.</p>
              <button 
                onClick={() => router.push("/")}
                className="mt-4 px-6 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors"
              >
                Go Home
              </button>
            </div>
          ) : (
            <PostDetailView
              post={post}
              handleLike={handleLike}
              currentUserId={currentUserId}
              onClose={handleClose}
              isModal={false}
            />
          )}
      </div>
    </div>
  );
}
