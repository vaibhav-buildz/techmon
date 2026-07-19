"use client";

import PostDetailView from "./PostDetailView";
import { Post } from "@/lib/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
  handleLike: (postId: string, currentlyLiked: boolean) => void;
  currentUserId?: string | null;
};

export default function PostDetailModal({ isOpen, onClose, post, handleLike, currentUserId }: Props) {
  if (!isOpen || !post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-2xl max-h-[90vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <PostDetailView
          post={post}
          handleLike={handleLike}
          currentUserId={currentUserId}
          onClose={onClose}
          isModal={true}
        />
      </div>
    </div>
  );
}
