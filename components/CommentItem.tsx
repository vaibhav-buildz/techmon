"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Send, Trash2, MoreHorizontal, AlertCircle } from "lucide-react";
import { CommentResult } from "@/lib/types";
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

type Props = {
  comment: CommentResult;
  currentUserId: string | null;
  onLike: (commentId: string, currentlyLiked: boolean) => void;
  onReplySubmit: (parentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => void;
  postOwnerId: string;
  isReply?: boolean;
};

export default function CommentItem({ comment, currentUserId, postOwnerId, onLike, onReplySubmit, onDelete, isReply = false }: Props) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onReplySubmit(comment.id, replyContent);
      setReplyContent("");
      setIsReplying(false);
      setShowReplies(true);
    } catch (err) {
      console.error("Error submitting reply", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    setShowMenu(false);
    if (window.confirm("Delete this comment?")) {
      onDelete(comment.id);
    }
  };

  const handleReportClick = () => {
    setShowMenu(false);
    // Simulate report
    alert("Comment reported. Thank you for helping keep Techmon safe.");
  };

  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className={`flex gap-3 ${isReply ? 'mt-3' : 'mt-4'}`}>
      <Link href={`/profile/${comment.profiles.username || comment.user_id}`} className="shrink-0 hover:opacity-80 transition-opacity">
        {comment.profiles.avatar_url ? (
          <img 
            src={comment.profiles.avatar_url} 
            alt="" 
            className={`${isReply ? 'w-6 h-6' : 'w-8 h-8'} rounded-full object-cover shrink-0 border border-border`} 
          />
        ) : (
          <div className={`${isReply ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'} rounded-full bg-gray-100 flex items-center justify-center font-medium text-gray-500 shrink-0 border border-border`}>
            {comment.profiles.name.charAt(0).toUpperCase()}
          </div>
        )}
      </Link>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <Link href={`/profile/${comment.profiles.username || comment.user_id}`} className="font-semibold text-sm text-heading hover:underline">
              {comment.profiles.name}
            </Link>
            <span className="text-xs text-gray-400">{getRelativeTime(comment.created_at)}</span>
          </div>
          
          {currentUserId && (
            <div className="relative shrink-0">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-gray-400 hover:text-heading transition-colors rounded-full hover:bg-gray-100 focus:outline-none -mt-1 -mr-1"
                aria-label="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-32 bg-surface border border-border shadow-lg rounded-xl overflow-hidden z-50 py-1">
                    {(currentUserId === comment.user_id || currentUserId === postOwnerId) ? (
                      <button
                        onClick={handleDeleteClick}
                        className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    ) : (
                      <button
                        onClick={handleReportClick}
                        className="w-full text-left px-4 py-2 text-xs text-body hover:bg-gray-50 flex items-center gap-2 transition-colors"
                      >
                        <AlertCircle className="w-3.5 h-3.5" /> Report
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        
        <p className={`text-body mt-0.5 whitespace-pre-wrap ${isReply ? 'text-sm' : 'text-sm'}`}>
          {comment.content}
        </p>

        {/* Action Row */}
        <div className="flex items-center gap-4 mt-2">
          <button 
            onClick={() => onLike(comment.id, comment.isLikedByMe || false)}
            className={`flex items-center gap-1.5 text-xs font-medium focus:outline-none transition-colors ${comment.isLikedByMe ? 'text-accent' : 'text-gray-400 hover:text-accent'}`}
          >
            <Heart className={`w-3.5 h-3.5 ${comment.isLikedByMe ? 'fill-accent' : ''}`} />
            {comment.likeCount && comment.likeCount > 0 ? <span>{comment.likeCount}</span> : null}
          </button>
          
          {currentUserId && (
            <button 
              onClick={() => setIsReplying(!isReplying)}
              className="text-xs font-medium text-gray-400 hover:text-heading focus:outline-none transition-colors"
            >
              Reply
            </button>
          )}


        </div>

        {/* Inline Reply Input */}
        {isReplying && currentUserId && (
          <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={`Replying to ${comment.profiles.name}...`}
              className="flex-1 bg-gray-50 border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={!replyContent.trim() || isSubmitting}
              className="shrink-0 p-1.5 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* View Replies Toggle */}
        {hasReplies && (
          <div className="mt-3">
            <button 
              onClick={() => setShowReplies(!showReplies)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-heading focus:outline-none transition-colors group"
            >
              <div className="w-6 h-[1px] bg-gray-300 group-hover:bg-gray-400 transition-colors" />
              {showReplies ? 'Hide replies' : `View ${comment.replies!.length} repl${comment.replies!.length === 1 ? 'y' : 'ies'}`}
            </button>
          </div>
        )}

        {/* Nested Replies Rendering */}
        {hasReplies && showReplies && (
          <div className="mt-2 flex flex-col">
            {comment.replies!.map(reply => (
              <CommentItem 
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                postOwnerId={postOwnerId}
                onLike={onLike}
                onReplySubmit={onReplySubmit}
                onDelete={onDelete}
                isReply={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
