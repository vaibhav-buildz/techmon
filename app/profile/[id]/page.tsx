"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import PostDetailModal, { Post } from "@/components/PostDetailModal";
import EditPostModal from "@/components/EditPostModal";
import { Type, Code, Heart, StickyNote, MoreHorizontal, Trash2, Edit2 } from "lucide-react";

type Profile = {
  id: string;
  name: string;
  headline: string;
  organization: string;
  bio: string;
  skills: string[];
  avatar_url?: string;
  github_url?: string;
  linkedin_url?: string;
  portfolio_url?: string;
};

export default function ProfilePage() {
  const params = useParams();
  const id = params?.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  
  // Modal state
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Grid Action Menu State
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [showDeleteConfirmFor, setShowDeleteConfirmFor] = useState<Post | null>(null);
  const [showEditModalFor, setShowEditModalFor] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProfileAndUser = useCallback(async () => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (profileError) {
        if (profileError.code === "PGRST116") {
          setProfile(null);
        } else {
          throw profileError;
        }
      } else {
        setProfile(profileData);
      }

      // Fetch current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        if (user.id === id) {
          setIsOwner(true);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchPosts = useCallback(async (userId: string, currentViewerId: string | null, authorProfile: Profile | null) => {
    if (!authorProfile) return;
    try {
      setPostsLoading(true);
      
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;
      
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = postsData.map((post) => post.id);

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

      const mergedPosts = postsData.map((post) => {
        const postLikes = likesData.filter((l) => l.post_id === post.id);
        const isLikedByMe = currentViewerId ? postLikes.some((l) => l.user_id === currentViewerId) : false;

        return {
          ...post,
          profiles: {
            name: authorProfile.name,
            avatar_url: authorProfile.avatar_url || "",
            headline: authorProfile.headline || "",
          },
          likeCount: postLikes.length,
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
    if (!id) return;
    fetchProfileAndUser();
  }, [id, fetchProfileAndUser]);

  useEffect(() => {
    if (profile && !loading) {
      fetchPosts(id, currentUserId, profile);
    }
  }, [profile, currentUserId, loading, id, fetchPosts]);

  // Listen for custom events from Modals
  useEffect(() => {
    if (!profile) return;

    const handleRefresh = () => {
      fetchPosts(id, currentUserId, profile);
    };

    window.addEventListener('postCreated', handleRefresh);
    window.addEventListener('postDeleted', handleRefresh);
    window.addEventListener('postUpdated', handleRefresh);
    
    return () => {
      window.removeEventListener('postCreated', handleRefresh);
      window.removeEventListener('postDeleted', handleRefresh);
      window.removeEventListener('postUpdated', handleRefresh);
    };
  }, [profile, id, currentUserId, fetchPosts]);

  const handleDeleteGridPost = async () => {
    const post = showDeleteConfirmFor;
    if (!post || isDeleting) return;
    setIsDeleting(true);

    try {
      if (post.type === "media" && post.media_url) {
        try {
          const urlParts = post.media_url.split('/posts/');
          if (urlParts.length === 2) {
            const filePath = urlParts[1];
            await supabase.storage.from("posts").remove([filePath]);
          }
        } catch (e) {
          console.error("Failed to delete media from storage", e);
        }
      }

      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;

      window.dispatchEvent(new Event('postDeleted'));
      setShowDeleteConfirmFor(null);
    } catch (err: any) {
      console.error("Error deleting post:", err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLike = async (postId: string, currentlyLiked: boolean) => {
    if (!currentUserId) return;

    // Optimistic update for the grid list
    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id === postId) {
          const updatedPost = {
            ...post,
            isLikedByMe: !currentlyLiked,
            likeCount: currentlyLiked ? Math.max(0, post.likeCount - 1) : post.likeCount + 1,
          };
          
          // Also optimistically update the modal if it's the one being viewed
          if (selectedPost && selectedPost.id === postId) {
            setSelectedPost(updatedPost);
          }
          
          return updatedPost;
        }
        return post;
      })
    );

    try {
      if (currentlyLiked) {
        // Unlike: Delete row
        const { error } = await supabase
          .from("likes")
          .delete()
          .match({ post_id: postId, user_id: currentUserId });
          
        if (error) throw error;
      } else {
        // Like: Insert row
        const { error } = await supabase
          .from("likes")
          .insert({ post_id: postId, user_id: currentUserId });
          
        if (error) throw error;
      }
    } catch (err) {
      console.error("Error toggling like:", err);
      // Fallback: Re-fetch posts on error to fix desync
      if (profile) fetchPosts(id, currentUserId, profile);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-body">
        <div className="text-gray-400 animate-pulse font-medium">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-body">
        <div className="text-red-600 bg-red-50 p-4 rounded-lg border border-red-100">
          Error loading profile: {error}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-body">
        <h2 className="text-2xl font-heading font-bold tracking-tight text-heading">Profile not found</h2>
        <p className="text-body mt-2 text-sm">The user you are looking for does not exist.</p>
        <Link href="/" className="mt-6 text-sm text-accent hover:underline font-medium">
          Return home
        </Link>
      </div>
    );
  }

  // Get initials for avatar placeholder
  const initials = profile.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <>
      <div className="min-h-screen py-16 bg-background text-body">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8">
            {/* Left Column (Sticky Sidebar) */}
            <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-8 h-fit lg:sticky lg:top-24">
              
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-6">
                {/* Avatar */}
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="w-24 h-24 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-background border border-border flex items-center justify-center text-3xl font-medium text-gray-400">
                    {initials}
                  </div>
                )}

                {/* Basic Info */}
                <div className="space-y-2 w-full">
                  <h1 className="text-2xl font-heading font-bold tracking-tight text-heading">
                    {profile.name}
                  </h1>
                  <p className="text-sm font-mono text-body">
                    {profile.headline}
                  </p>
                  {profile.organization && (
                    <p className="text-sm text-gray-500 mt-1">
                      {profile.organization}
                    </p>
                  )}
                </div>
              </div>

              {/* Edit Button (if owner) */}
              {isOwner && (
                <div className="w-full pt-2">
                  <Link
                    href="/profile/edit"
                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium text-heading hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    Edit Profile
                  </Link>
                </div>
              )}

              {/* Links */}
              {(profile.github_url || profile.linkedin_url || profile.portfolio_url) && (
                <div className="space-y-3 pt-6 border-t border-border">
                  <h2 className="font-mono text-xs uppercase text-accent">&gt; Links</h2>
                  <div className="flex flex-col gap-3">
                    {profile.github_url && (
                      <a
                        href={profile.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-body hover:text-accent transition-colors w-fit"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                        </svg>
                        GitHub
                      </a>
                    )}
                    {profile.linkedin_url && (
                      <a
                        href={profile.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-body hover:text-accent transition-colors w-fit"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                        LinkedIn
                      </a>
                    )}
                    {profile.portfolio_url && (
                      <a
                        href={profile.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-body hover:text-accent transition-colors w-fit"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        Portfolio
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              
              {/* Profile Details Cards */}
              <div className="space-y-8">
                {/* Bio */}
                {profile.bio && (
                  <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-4">
                    <h2 className="font-mono text-xs uppercase text-accent">&gt; About</h2>
                    <p className="text-body leading-relaxed whitespace-pre-wrap">
                      {profile.bio}
                    </p>
                  </div>
                )}

                {/* Skills */}
                {profile.skills && profile.skills.length > 0 && (
                  <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-5">
                    <h2 className="font-mono text-xs uppercase text-accent">&gt; Skills</h2>
                    <div className="flex flex-wrap gap-2.5">
                      {profile.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="font-mono text-xs bg-blue-50 px-3 py-1 text-accent rounded-full border border-accent/20"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Posts Grid */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h2 className="font-heading font-semibold text-xl text-heading">Posts</h2>
                
                {postsLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="aspect-square bg-gray-200"></div>
                    ))}
                  </div>
                ) : posts.length === 0 ? (
                  <div className="bg-surface border border-border shadow-sm rounded-xl p-8 text-center text-gray-500">
                    No posts yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                    {posts.map((post) => (
                      <div 
                        key={post.id} 
                        onClick={() => setSelectedPost(post)}
                        className="aspect-square relative cursor-pointer group bg-surface border border-border overflow-hidden flex items-center justify-center hover:opacity-90 transition-opacity"
                      >
                        {post.type === "media" && post.media_url ? (
                          post.media_type === "video" ? (
                            <video src={post.media_url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={post.media_url} alt="Post preview" className="w-full h-full object-cover" />
                          )
                        ) : post.type === "note" ? (
                          <div className={`w-full h-full p-4 flex flex-col justify-center items-center text-center ${post.background || 'bg-white'}`}>
                            <div className={`absolute top-4 right-4 mb-2 shrink-0 ${post.background === 'bg-white' || post.background?.includes('bg-white') ? 'text-gray-400' : 'text-white/70'}`}>
                              <StickyNote className="w-4 h-4" />
                            </div>
                            <p className={`text-sm line-clamp-4 leading-relaxed font-medium ${post.background === 'bg-white' || post.background?.includes('bg-white') ? 'text-gray-800' : 'text-white'}`}>
                              {post.content}
                            </p>
                          </div>
                        ) : (
                          <div className="w-full h-full p-4 flex flex-col bg-surface border-border">
                            <div className="flex justify-end text-gray-400 mb-2 shrink-0">
                              {post.type === "code" ? <Code className="w-4 h-4" /> : <Type className="w-4 h-4" />}
                            </div>
                            <p className="text-xs text-body line-clamp-4 leading-relaxed font-medium">
                              {post.content}
                            </p>
                          </div>
                        )}
                        
                        {/* Hover Overlay with Likes & Actions */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="flex items-center gap-1.5 text-white font-medium">
                            <Heart className="w-5 h-5 fill-white" />
                            <span>{post.likeCount}</span>
                          </div>
                          
                          {/* Grid Tile Actions */}
                          {isOwner && (
                            <div className="absolute top-2 right-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuPostId(activeMenuPostId === post.id ? null : post.id);
                                }}
                                className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
                              >
                                <MoreHorizontal className="w-5 h-5" />
                              </button>
                              
                              {activeMenuPostId === post.id && (
                                <div 
                                  className="absolute right-0 mt-1 w-32 bg-surface border border-border shadow-lg rounded-xl overflow-hidden z-20 py-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {(post.type === "note" || post.type === "media") && (
                                    <button
                                      onClick={() => {
                                        setActiveMenuPostId(null);
                                        setShowEditModalFor(post);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-body hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setActiveMenuPostId(null);
                                      setShowDeleteConfirmFor(post);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>

      <PostDetailModal 
        isOpen={selectedPost !== null}
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        handleLike={handleLike}
        currentUserId={currentUserId}
      />

      <EditPostModal
        isOpen={showEditModalFor !== null}
        onClose={() => setShowEditModalFor(null)}
        post={showEditModalFor}
      />

      {showDeleteConfirmFor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirmFor(null)}>
          <div 
            className="bg-surface border border-border rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading font-semibold text-lg text-heading mb-2">Delete Post?</h3>
            <p className="text-body text-sm mb-6">This action cannot be undone.</p>
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirmFor(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-body hover:text-heading transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGridPost}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
