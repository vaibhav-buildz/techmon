"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import PostGrid from "@/components/PostGrid";
import { Post } from "@/lib/types";
import { X } from "lucide-react";

export default function ActivityPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"saved" | "liked">("saved");
  
  // Collections & Saved Posts state
  const [collections, setCollections] = useState<any[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string>("all");
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedPostsLoading, setSavedPostsLoading] = useState(true);

  // Liked Posts state
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [likedPostsLoading, setLikedPostsLoading] = useState(false);

  const fetchCollections = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("collections")
      .select("id, name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    
    if (!error && data) {
      setCollections(data);
    }
  }, []);

  const fetchPostsData = useCallback(async (userId: string, postIds: string[]) => {
    if (!postIds || postIds.length === 0) return [];
    
    try {
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .eq("archived", false)
        .in("id", postIds)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;
      if (!postsData || postsData.length === 0) return [];

      const fetchedPostIds = postsData.map(p => p.id);
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

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline")
        .in("id", Array.from(userIds));

      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      let likesData: any[] = [];
      const { data: fetchLikesData, error: likesError } = await supabase
        .from("likes")
        .select("post_id, user_id")
        .in("post_id", fetchedPostIds);

      if (!likesError && fetchLikesData) {
        likesData = fetchLikesData;
      }

      let commentsData: any[] = [];
      const { data: fetchCommentsData, error: commentsError } = await supabase
        .from("comments")
        .select("post_id")
        .in("post_id", fetchedPostIds);

      if (!commentsError && fetchCommentsData) {
        commentsData = fetchCommentsData;
      }

      let savedData: any[] = [];
      const { data: fetchSavedData, error: savedError } = await supabase
        .from("saved_posts")
        .select("post_id, collection_id")
        .eq("user_id", userId)
        .in("post_id", fetchedPostIds);
        
      if (!savedError && fetchSavedData) {
        savedData = fetchSavedData;
      }

      const mergedPosts = postsData.map((post) => {
        const authorProfile = profileMap.get(post.user_id) || { name: "Unknown", avatar_url: "", headline: "" };
        const postLikes = likesData.filter((l) => l.post_id === post.id);
        const postComments = commentsData.filter((c) => c.post_id === post.id);
        const isLikedByMe = postLikes.some((l) => l.user_id === userId);

        let originalPost = null;
        if (post.type === "repost" && post.shared_post_id) {
          const sp = sharedPostsData.find(p => p.id === post.shared_post_id);
          if (sp) {
            const spAuthor = profileMap.get(sp.user_id) || { name: "Unknown", avatar_url: "", headline: "" };
            originalPost = {
              ...sp,
              profiles: spAuthor
            };
          }
        }

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
          isRepostedByMe: false,
          savedCollectionIds: savedData.filter(s => s.post_id === post.id).map(s => s.collection_id),
          original_post: originalPost
        };
      });

      return mergedPosts as Post[];
    } catch (err: any) {
      console.error("Posts fetch failed:", err.message);
      return [];
    }
  }, []);

  const loadSavedPosts = useCallback(async (userId: string) => {
    setSavedPostsLoading(true);
    let query = supabase.from("saved_posts").select("post_id").eq("user_id", userId).order("created_at", { ascending: false });
    
    if (activeCollectionId !== "all") {
      query = query.eq("collection_id", activeCollectionId);
    }
    
    const { data: savedData, error: savedError } = await query;
    if (savedError || !savedData || savedData.length === 0) {
      setSavedPosts([]);
      setSavedPostsLoading(false);
      return;
    }
    
    const postIds = savedData.map(s => s.post_id);
    const data = await fetchPostsData(userId, postIds);
    setSavedPosts(data);
    setSavedPostsLoading(false);
  }, [activeCollectionId, fetchPostsData]);

  const loadLikedPosts = useCallback(async (userId: string) => {
    setLikedPostsLoading(true);
    const { data: likedData, error: likedError } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
      
    if (likedError || !likedData || likedData.length === 0) {
      setLikedPosts([]);
      setLikedPostsLoading(false);
      return;
    }
    
    const postIds = likedData.map(l => l.post_id);
    const data = await fetchPostsData(userId, postIds);
    
    // Maintain original ordered list of likes (most recently liked first)
    const sortedData = data.sort((a, b) => postIds.indexOf(a.id) - postIds.indexOf(b.id));
    
    setLikedPosts(sortedData);
    setLikedPostsLoading(false);
  }, [fetchPostsData]);

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm("Are you sure you want to delete this collection?")) return;
    const { error } = await supabase.from("collections").delete().eq("id", collectionId);
    if (!error) {
      if (activeCollectionId === collectionId) setActiveCollectionId("all");
      if (currentUserId) fetchCollections(currentUserId);
    } else {
      alert("Failed to delete collection.");
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setCurrentUserId(session.user.id);
        fetchCollections(session.user.id);
      }
    };
    checkAuth();
  }, [router, fetchCollections]);

  useEffect(() => {
    if (!currentUserId) return;
    if (activeTab === "saved") {
      loadSavedPosts(currentUserId);
    } else if (activeTab === "liked") {
      loadLikedPosts(currentUserId);
    }
  }, [activeTab, currentUserId, activeCollectionId, loadSavedPosts, loadLikedPosts]);

  // Listen for custom events from Modals
  useEffect(() => {
    if (!currentUserId) return;
    const handleRefresh = () => {
      if (activeTab === "saved") loadSavedPosts(currentUserId);
      else if (activeTab === "liked") loadLikedPosts(currentUserId);
    };

    window.addEventListener('postCreated', handleRefresh);
    window.addEventListener('postDeleted', handleRefresh);
    window.addEventListener('postUpdated', handleRefresh);
    
    return () => {
      window.removeEventListener('postCreated', handleRefresh);
      window.removeEventListener('postDeleted', handleRefresh);
      window.removeEventListener('postUpdated', handleRefresh);
    };
  }, [currentUserId, activeTab, loadSavedPosts, loadLikedPosts]);

  if (!currentUserId) return null;

  return (
    <main className="min-h-screen bg-background">


      <div className="max-w-3xl mx-auto px-4 pt-24 pb-12">
        <h1 className="text-2xl font-heading font-bold text-heading mb-6">Your Activity</h1>
        
        <div className="flex items-center gap-6 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab("saved")}
            className={`font-heading font-semibold text-lg transition-colors border-b-2 pb-2 ${
              activeTab === "saved"
                ? "text-accent border-accent"
                : "text-gray-400 border-transparent hover:text-gray-600"
            }`}
          >
            Saved
          </button>
          <button
            onClick={() => setActiveTab("liked")}
            className={`font-heading font-semibold text-lg transition-colors border-b-2 pb-2 ${
              activeTab === "liked"
                ? "text-accent border-accent"
                : "text-gray-400 border-transparent hover:text-gray-600"
            }`}
          >
            Liked
          </button>
        </div>
        
        {activeTab === "saved" && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setActiveCollectionId("all")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeCollectionId === "all"
                      ? "bg-accent text-white"
                      : "bg-surface border border-border text-heading hover:bg-gray-50"
                  }`}
                >
                  All Posts
                </button>
                {collections.filter(c => c.name !== "All Posts").map(collection => (
                  <div key={collection.id} className="relative group flex items-center">
                    <button
                      onClick={() => setActiveCollectionId(collection.id)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                        activeCollectionId === collection.id
                          ? "bg-accent text-white"
                          : "bg-surface border border-border text-heading hover:bg-gray-50"
                      }`}
                    >
                      {collection.name}
                    </button>
                    {activeCollectionId === collection.id && (
                      <button
                        onClick={() => handleDeleteCollection(collection.id)}
                        className="absolute -top-1 -right-1 bg-white border border-border rounded-full p-0.5 text-gray-500 hover:text-red-500 shadow-sm"
                        title="Delete collection"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {savedPostsLoading ? (
              <PostGrid posts={[]} loading={true} currentUserId={currentUserId} />
            ) : savedPosts.length === 0 ? (
              <div className="text-center py-20 text-gray-500 font-medium bg-surface border border-border rounded-xl">
                No saved posts
              </div>
            ) : (
              <PostGrid posts={savedPosts} loading={false} currentUserId={currentUserId} />
            )}
          </>
        )}

        {activeTab === "liked" && (
          <>
            {likedPostsLoading ? (
              <PostGrid posts={[]} loading={true} currentUserId={currentUserId} />
            ) : likedPosts.length === 0 ? (
              <div className="text-center py-20 text-gray-500 font-medium bg-surface border border-border rounded-xl">
                No liked posts
              </div>
            ) : (
              <PostGrid posts={likedPosts} loading={false} currentUserId={currentUserId} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
