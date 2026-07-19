"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Post } from "@/lib/types";
import Link from "next/link";
import PostDetailModal from "@/components/PostDetailModal";
import EditPostModal from "@/components/EditPostModal";
import HashtagText from "@/components/HashtagText";
import { Type, Code, Heart, StickyNote, MoreHorizontal, Trash2, Edit2, MessageCircle, AlertCircle, Camera, Share2, Repeat2, Archive, ArchiveRestore } from "lucide-react";

type Props = {
  posts: Post[];
  loading: boolean;
  currentUserId: string | null;
};

export default function PostGrid({ posts: initialPosts, loading, currentUserId }: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  
  // Modals
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showEditModalFor, setShowEditModalFor] = useState<Post | null>(null);
  
  // Grid Action Menu State
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [activeSharePostId, setActiveSharePostId] = useState<string | null>(null);
  const [showDeleteConfirmFor, setShowDeleteConfirmFor] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync props to state so parent can fetch and provide data, but we can optimistically update
  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

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

      // Optimistically remove
      setPosts((current) => current.filter(p => p.id !== post.id));
      window.dispatchEvent(new Event('postDeleted'));
      setShowDeleteConfirmFor(null);
    } catch (err: any) {
      console.error("Error deleting post:", err.message);
      setError("Failed to delete post. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveGridPost = async (post: Post) => {
    if (!currentUserId || post.user_id !== currentUserId) return;
    
    const newArchivedState = !post.archived;
    
    try {
      const { error } = await supabase
        .from("posts")
        .update({ archived: newArchivedState })
        .eq("id", post.id)
        .eq("user_id", currentUserId);

      if (error) throw error;
      
      // Optimistically remove from grid whether archiving or unarchiving
      setPosts((current) => current.filter(p => p.id !== post.id));
      
      alert(newArchivedState ? "Post archived" : "Post unarchived");
      window.dispatchEvent(new Event('postUpdated'));
      setActiveMenuPostId(null);
    } catch (err: any) {
      console.error("Error toggling archive:", err);
      alert("Failed to update post.");
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
        const { error } = await supabase
          .from("likes")
          .delete()
          .match({ post_id: postId, user_id: currentUserId });
          
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ post_id: postId, user_id: currentUserId });
          
        if (error) throw error;
        
        const targetPost = posts.find(p => p.id === postId);
        if (targetPost && targetPost.user_id !== currentUserId) {
          const { error: notifError } = await supabase
            .from("notifications")
            .insert({
              recipient_id: targetPost.user_id,
              actor_id: currentUserId,
              type: "like",
              post_id: postId
            });
            
          if (notifError) {
            console.error("Error creating like notification:", notifError);
          }
        }
      }
    } catch (err) {
      console.error("Error toggling like:", err);
      // Revert optimistic update
      setPosts((currentPosts) =>
        currentPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              isLikedByMe: currentlyLiked,
              likeCount: currentlyLiked ? post.likeCount : Math.max(0, post.likeCount - 1),
            };
          }
          return post;
        })
      );
      setError("Failed to like post.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleCopyLink = async (postId: string) => {
    setActiveSharePostId(null);
    const url = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleRepost = async (post: Post) => {
    setActiveSharePostId(null);
    if (!currentUserId) return;
    
    const caption = window.prompt("Add a caption to your repost (optional):");
    if (caption === null) return;
    
    try {
      const targetPostId = post.type === "repost" && post.shared_post_id ? post.shared_post_id : post.id;
      
      const { error: insertError } = await supabase
        .from("posts")
        .insert({
          user_id: currentUserId,
          type: "repost",
          content: caption.trim(),
          shared_post_id: targetPostId,
        });

      if (insertError) throw insertError;
      
      alert("Reposted successfully!");
      window.dispatchEvent(new Event('postCreated'));
    } catch (err: any) {
      console.error("Error reposting:", err);
      alert("Failed to repost.");
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-square bg-gray-200"></div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="bg-surface border border-border shadow-sm rounded-xl p-12 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100">
          <Camera className="w-8 h-8 text-gray-300" />
        </div>
        <div>
          <h3 className="font-heading font-semibold text-lg text-heading">No posts yet</h3>
          <p className="text-body text-sm mt-1">When there are posts, they'll show up here.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
        {posts.map((post) => {
          const isOwner = currentUserId && post.user_id === currentUserId;

          return (
            <div 
              key={post.id} 
              onClick={() => setSelectedPost(post)}
              className="aspect-square relative cursor-pointer group bg-surface border border-border overflow-hidden flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              {(() => {
                const isRepost = post.type === "repost";
                const targetPost = isRepost ? post.original_post : post;

                if (isRepost && !targetPost) {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 p-4 text-center border-border">
                      <div className="absolute top-2 right-2 text-gray-400">
                        <Repeat2 className="w-4 h-4" />
                      </div>
                      <span className="text-xs">No longer available</span>
                    </div>
                  );
                }

                return (
                  <>
                    {isRepost && (
                      <div className="absolute top-2 right-2 z-10 bg-black/60 backdrop-blur-md rounded-full p-1.5 text-white shadow-sm border border-white/10">
                        <Repeat2 className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {targetPost!.type === "media" && targetPost!.media_url ? (
                      targetPost!.media_type === "video" ? (
                        <video src={targetPost!.media_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={targetPost!.media_url} alt="Post preview" className="w-full h-full object-cover" />
                      )
                    ) : targetPost!.type === "note" ? (
                      <div className={`w-full h-full p-4 flex flex-col justify-center items-center text-center ${targetPost!.background || 'bg-white'}`}>
                        {!isRepost && (
                          <div className={`absolute top-4 right-4 mb-2 shrink-0 ${targetPost!.background === 'bg-white' || targetPost!.background?.includes('bg-white') ? 'text-gray-400' : 'text-white/70'}`}>
                            <StickyNote className="w-4 h-4" />
                          </div>
                        )}
                        <p className={`text-sm line-clamp-4 leading-relaxed font-medium ${targetPost!.background === 'bg-white' || targetPost!.background?.includes('bg-white') ? 'text-gray-800' : 'text-white'}`}>
                          <HashtagText text={targetPost!.content} />
                        </p>
                      </div>
                    ) : (
                      <div className="w-full h-full p-4 flex flex-col bg-surface border-border">
                        {!isRepost && (
                          <div className="flex justify-end text-gray-400 mb-2 shrink-0">
                            {targetPost!.type === "code" ? <Code className="w-4 h-4" /> : <Type className="w-4 h-4" />}
                          </div>
                        )}
                        <p className="text-xs text-body line-clamp-4 leading-relaxed font-medium">
                          <HashtagText text={targetPost!.content} />
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
              
              {/* Hover Overlay with Likes & Actions */}
              <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${activeMenuPostId === post.id || activeSharePostId === post.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <div className="flex items-center gap-4 text-white font-medium">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-5 h-5 fill-white" />
                    <span>{post.likeCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="w-5 h-5 fill-white" />
                    <span>{post.commentCount || 0}</span>
                  </div>
                  <div className="relative flex items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSharePostId(activeSharePostId === post.id ? null : post.id);
                      }}
                      className="hover:text-white/80 transition-colors"
                    >
                      <Share2 className="w-5 h-5 text-white" />
                    </button>
                    {activeSharePostId === post.id && (
                      <div 
                        className="absolute left-1/2 -translate-x-1/2 bottom-8 mt-1 w-36 bg-surface border border-border shadow-lg rounded-xl overflow-hidden z-20 py-1 text-body"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleCopyLink(post.id)}
                          className="w-full text-left px-4 py-2 text-sm text-body hover:bg-gray-50 flex items-center gap-2 transition-colors font-normal"
                        >
                          <Share2 className="w-3.5 h-3.5" /> Copy Link
                        </button>
                        <button
                          onClick={() => handleRepost(post)}
                          className="w-full text-left px-4 py-2 text-sm text-body hover:bg-gray-50 flex items-center gap-2 transition-colors font-normal"
                        >
                          <Repeat2 className="w-3.5 h-3.5" /> Repost
                        </button>
                      </div>
                    )}
                  </div>
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
                          onClick={() => handleArchiveGridPost(post)}
                          className="w-full text-left px-4 py-2 text-sm text-body hover:bg-gray-50 flex items-center gap-2 transition-colors"
                        >
                          {post.archived ? (
                            <><ArchiveRestore className="w-3.5 h-3.5" /> Unarchive</>
                          ) : (
                            <><Archive className="w-3.5 h-3.5" /> Archive</>
                          )}
                        </button>
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
          );
        })}
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
