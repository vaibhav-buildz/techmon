"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Check } from "lucide-react";
import { Post } from "@/lib/types";
import { processHashtags } from "@/lib/hashtagHelpers";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
};

const BACKGROUNDS = [
  { id: "white", class: "bg-white border border-border" },
  { id: "dark", class: "bg-gray-900" },
  { id: "pink-orange", class: "bg-gradient-to-br from-pink-400 to-orange-300" },
  { id: "blue-purple", class: "bg-gradient-to-br from-blue-500 to-purple-500" },
  { id: "green-emerald", class: "bg-gradient-to-br from-green-400 to-emerald-600" },
  { id: "yellow-red", class: "bg-gradient-to-br from-yellow-300 to-red-400" },
];

export default function EditPostModal({ isOpen, onClose, post }: Props) {
  const [content, setContent] = useState("");
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen && post) {
      setContent(post.content || "");
      if (post.type === "note") {
        const bgMatch = BACKGROUNDS.find(bg => bg.class === post.background) || BACKGROUNDS[0];
        setBackground(bgMatch);
      }
      setSuccess(false);
      setError(null);
    }
  }, [isOpen, post]);

  if (!isOpen || !post) return null;
  
  // We only support editing notes and media captions
  if (post.type !== "note" && post.type !== "media") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (post.type === "note" && !content.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const updateData: any = {
        content: content,
      };

      if (post.type === "note") {
        updateData.background = background.class;
      }

      const { error: updateError } = await supabase
        .from("posts")
        .update(updateData)
        .eq("id", post.id);

      if (updateError) throw updateError;
      await processHashtags(post.id, content);

      setSuccess(true);
      
      // Notify other components to refresh
      window.dispatchEvent(new Event('postUpdated'));
      
      // Close modal after brief delay
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = post.type === "note" ? content.trim().length > 0 : true;
  const isDarkText = background.id === "white";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-surface border border-border shadow-xl rounded-2xl w-full max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface shrink-0">
          <h2 className="font-heading font-semibold text-heading text-lg">Edit Post</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-heading transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          
          <div className="p-6 space-y-6">
            
            {/* Note Editor */}
            {post.type === "note" && (
              <div className="space-y-6">
                <div className={`w-full aspect-square sm:aspect-video rounded-xl flex items-center justify-center p-6 transition-all duration-300 ${background.class}`}>
                  <textarea
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What's on your mind?"
                    className={`w-full bg-transparent border-0 focus:ring-0 text-center resize-none p-0 text-xl md:text-2xl font-medium placeholder-opacity-70 ${isDarkText ? "text-gray-800 placeholder-gray-400" : "text-white placeholder-white"}`}
                  />
                </div>
                
                <div className="flex items-center justify-center gap-3">
                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBackground(bg)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${bg.class} ${background.id === bg.id ? "ring-2 ring-accent ring-offset-2" : ""}`}
                      aria-label={`Select ${bg.id} background`}
                    >
                      {background.id === bg.id && (
                        <Check className={`w-4 h-4 ${bg.id === "white" ? "text-black" : "text-white"}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Media Editor */}
            {post.type === "media" && (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-border bg-black/5 aspect-video flex items-center justify-center">
                  {post.media_type === "video" ? (
                    <video src={post.media_url} controls className="max-h-full max-w-full object-contain bg-black" />
                  ) : (
                    <img src={post.media_url} alt="Preview" className="max-h-full max-w-full object-contain" />
                  )}
                </div>

                <textarea
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Add an optional caption..."
                  className="w-full bg-transparent border-0 border-b border-border focus:ring-0 focus:border-accent text-body placeholder-gray-400 resize-none px-0 py-2 text-sm mt-2"
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 mt-4">
                {error}
              </div>
            )}
            
            {success && (
              <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200 mt-4">
                Post updated successfully!
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-6 pt-0 mt-auto shrink-0 bg-surface">
            <button
              type="submit"
              disabled={submitting || !isFormValid}
              className="w-full py-3 bg-accent text-white font-medium rounded-xl text-sm hover:bg-accent/90 transition-all disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
