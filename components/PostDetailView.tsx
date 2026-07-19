"use client";

import { useState, useEffect } from "react";
import { X, MoreHorizontal, Trash2, Edit2, Send, AlertCircle, Share2, Repeat2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import EditPostModal from "./EditPostModal";
import SharePostModal from "./SharePostModal";
import { Post, CommentResult } from "@/lib/types";

type Props = {
  post: Post;
  handleLike: (postId: string, currentlyLiked: boolean) => void;
  currentUserId?: string | null;
  onClose?: () => void;
  isModal?: boolean;
};

const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}y ago`;
};

export default function PostDetailView({ post, handleLike, currentUserId, onClose, isModal = false }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReposted, setIsReposted] = useState(post.isRepostedByMe || false);

  // Comments state
  const [comments, setComments] = useState<CommentResult[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = async () => {
    if (!post) return;
    setCommentsLoading(true);
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;
      if (!commentsData || commentsData.length === 0) {
        setComments([]);
        return;
      }

      const userIds = [...new Set(commentsData.map((c) => c.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;
      const profileMap = new Map(profilesData?.map((p) => [p.id, p]) || []);

      const mergedComments = commentsData.map((c) => ({
        ...c,
        profiles: profileMap.get(c.user_id) || { name: "Unknown", avatar_url: "" },
      }));

      setComments(mergedComments);
    } catch (err) {
      console.error("Error fetching comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    if (post?.id) {
      fetchComments();
      setIsReposted(post.isRepostedByMe || false);
    }
  }, [post?.id, post?.isRepostedByMe]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !post || !currentUserId || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const { error: insertError } = await supabase
        .from("comments")
        .insert({
          post_id: post.id,
          user_id: currentUserId,
          content: commentInput.trim(),
        });
      
      if (insertError) throw insertError;

      if (post.user_id !== currentUserId) {
        await supabase
          .from("notifications")
          .insert({
            recipient_id: post.user_id,
            actor_id: currentUserId,
            type: "comment",
            post_id: post.id
          });
      }

      setCommentInput("");
      await fetchComments();
      window.dispatchEvent(new Event('postUpdated'));

    } catch (err: any) {
      console.error("Error submitting comment:", err);
      setError(err.message || "Failed to post comment.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
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
      setShowDeleteConfirm(false);
      if (onClose) onClose();
    } catch (err: any) {
      console.error("Error deleting post:", err.message);
      setError(err.message || "Failed to delete post.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyLink = async () => {
    setShowShareMenu(false);
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleRepostToggle = async () => {
    if (!currentUserId) return;
    
    try {
      const targetPostId = post.type === "repost" && post.shared_post_id ? post.shared_post_id : post.id;
      
      if (isReposted) {
        // Delete the repost
        const { error: deleteError } = await supabase
          .from("posts")
          .delete()
          .eq("user_id", currentUserId)
          .eq("type", "repost")
          .eq("shared_post_id", targetPostId);

        if (deleteError) throw deleteError;
        
        setIsReposted(false);
        window.dispatchEvent(new Event('postCreated')); // Trigger refresh in parent
      } else {
        // Create the repost
        const { error: insertError } = await supabase
          .from("posts")
          .insert({
            user_id: currentUserId,
            type: "repost",
            content: "",
            shared_post_id: targetPostId,
          });

        if (insertError) throw insertError;
        
        setIsReposted(true);
        alert("Reposted!");
        window.dispatchEvent(new Event('postCreated')); // Trigger refresh in parent
      }
    } catch (err: any) {
      console.error("Error toggling repost:", err);
      alert("Failed to repost.");
    }
  };

  const handleRepost = async () => {
    // Legacy handleRepost kept for safety, but we use toggle now
    handleRepostToggle();
  };

  if (!post) return null;

  const author = post.profiles;
  const initials = author?.name
    ? author.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  // Repost related
  const isRepost = post.type === "repost";
  const originalPost = isRepost ? post.original_post : post;

  return (
    <div className={`bg-surface flex flex-col w-full h-full relative ${!isModal ? 'border border-border rounded-2xl shadow-sm' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          {author?.avatar_url ? (
            <img
              src={author.avatar_url}
              alt={author.name}
              className="w-10 h-10 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-xs font-medium text-gray-400">
              {initials}
            </div>
          )}
          <div>
            <div className="font-heading font-semibold text-heading flex items-center gap-2">
              {author?.name || "Unknown User"}
              {isRepost && <span className="text-xs text-gray-500 font-normal flex items-center gap-1"><Repeat2 className="w-3 h-3" /> reposted</span>}
            </div>
            <p className="text-xs text-body font-mono mt-0.5">
              {author?.headline || "No headline"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {currentUserId === post.user_id && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-gray-400 hover:text-heading transition-colors rounded-full hover:bg-gray-100"
                aria-label="More options"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-1 w-36 bg-surface border border-border shadow-lg rounded-xl overflow-hidden z-10 py-1">
                  {(post.type === "note" || post.type === "media") && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowEditModal(true);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-body hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-heading transition-colors rounded-full hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-6 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2 text-sm text-red-600 shrink-0">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <h3 className="font-heading font-semibold text-lg text-heading mb-2">Delete Post?</h3>
            <p className="text-body text-sm mb-6">This action cannot be undone.</p>
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-body hover:text-heading transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="overflow-y-auto flex-1 bg-surface">
        {/* Repost Caption */}
        {isRepost && post.content && (
          <div className="p-6 pb-2">
            <p className="text-body whitespace-pre-wrap leading-relaxed text-lg">{post.content}</p>
          </div>
        )}

        {/* Repost Container */}
        {isRepost && (
          <div className="px-6 pb-4 pt-2">
            {!originalPost ? (
              <div className="border border-border rounded-xl p-6 bg-gray-50 flex items-center justify-center text-gray-500">
                This post is no longer available.
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-gray-50 flex items-center gap-3">
                   {originalPost.profiles?.avatar_url ? (
                    <img src={originalPost.profiles.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-500">
                      {originalPost.profiles?.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                  <span className="font-semibold text-sm text-heading">{originalPost.profiles?.name || "Unknown"}</span>
                  <span className="text-xs text-gray-400 ml-auto">{getRelativeTime(originalPost.created_at)}</span>
                </div>
                {/* Original Post Content below */}
              </div>
            )}
          </div>
        )}

        {(!isRepost || (isRepost && originalPost)) && (
          <>
            {/* The actual content to render (either original post or just the post) */}
            {(originalPost?.type === "media" && originalPost.media_url) && (
              <div className="w-full bg-black flex justify-center items-center">
                {originalPost.media_type === "video" ? (
                  <video src={originalPost.media_url} controls className="max-h-[60vh] max-w-full object-contain" />
                ) : (
                  <img src={originalPost.media_url} alt="Post media" className="max-h-[60vh] max-w-full object-contain" />
                )}
              </div>
            )}

            <div className={`p-6 ${isRepost ? 'pt-2' : ''}`}>
              {originalPost?.type === "note" && (
                <div className={`w-full aspect-square sm:aspect-video rounded-xl flex items-center justify-center p-6 sm:p-12 text-center transition-all duration-300 ${originalPost.background || 'bg-white border border-border'}`}>
                  <p className={`text-xl sm:text-2xl md:text-3xl font-medium whitespace-pre-wrap leading-relaxed ${originalPost.background === 'bg-white' || originalPost.background?.includes('bg-white') ? 'text-gray-800' : 'text-white'}`}>
                    {originalPost.content}
                  </p>
                </div>
              )}

              {originalPost?.type === "text" && (
                <p className="text-body whitespace-pre-wrap leading-relaxed text-lg">
                  {originalPost.content}
                </p>
              )}
              
              {originalPost?.type === "code" && (
                <div className="rounded-xl overflow-hidden border border-[#2d2d2d] bg-[#1e1e1e]">
                  {originalPost.code_lang && (
                    <div className="bg-[#2d2d2d] px-4 py-2 border-b border-[#3d3d3d] flex items-center">
                      <span className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                        {originalPost.code_lang}
                      </span>
                    </div>
                  )}
                  <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300 whitespace-pre-wrap">
                    <code>{originalPost.content}</code>
                  </pre>
                </div>
              )}

              {originalPost?.type === "media" && originalPost.content && (
                <p className="text-body whitespace-pre-wrap leading-relaxed mt-4">
                  {originalPost.content}
                </p>
              )}
            </div>
          </>
        )}
        
        {/* Footer (Likes & Timestamp) */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-border bg-surface">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleLike(post.id, post.isLikedByMe)}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors focus:outline-none ${
                post.isLikedByMe
                  ? "text-accent"
                  : "text-gray-400 hover:text-accent"
              }`}
            >
              {post.isLikedByMe ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              )}
              <span className="text-base">{post.likeCount}</span>
            </button>

            <button
              onClick={handleRepostToggle}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors focus:outline-none ${
                isReposted ? "text-green-500" : "text-gray-400 hover:text-green-500"
              }`}
            >
              <Repeat2 className="w-6 h-6" />
            </button>

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-accent transition-colors focus:outline-none"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          <span className="text-sm text-gray-400">
            {getRelativeTime(post.created_at)}
          </span>
        </div>

        {/* Comments Section */}
        <div className="px-6 py-4 border-t border-border bg-surface">
          <h4 className="text-sm font-semibold text-heading mb-4">{comments.length} comments</h4>
          {commentsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0"></div>
                  <div className="flex-1 space-y-2 mt-1">
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-500">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  {comment.profiles.avatar_url ? (
                      <img src={comment.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-border" />
                  ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500 shrink-0 border border-border">
                        {comment.profiles.name.charAt(0).toUpperCase()}
                      </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm text-heading">{comment.profiles.name}</span>
                      <span className="text-xs text-gray-400">{getRelativeTime(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-body mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Comment Input */}
      {currentUserId && (
        <form onSubmit={handleSubmitComment} className="px-6 py-4 border-t border-border bg-surface shrink-0 flex items-center gap-3">
          <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-gray-50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
              type="submit"
              disabled={!commentInput.trim() || isSubmittingComment}
              className="shrink-0 p-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
      
      <EditPostModal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)} 
        post={post} 
      />
      
      <SharePostModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        postId={post.id}
        currentUserId={currentUserId || null}
      />
    </div>
  );
}
