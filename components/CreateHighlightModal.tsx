"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Check, Sparkles, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type StoryItem = {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  created_at: string;
  expires_at: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onCreated: () => void;
  preSelectedStoryId?: string;
};

export default function CreateHighlightModal({
  isOpen,
  onClose,
  userId,
  onCreated,
  preSelectedStoryId,
}: Props) {
  const [title, setTitle] = useState("");
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all of the user's stories (no expiry filter — highlights preserve expired stories)
  const fetchStories = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("stories")
        .select("id, media_url, media_type, created_at, expires_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setStories(data || []);
    } catch (err) {
      console.error("[CreateHighlightModal] Error fetching stories:", err);
      setError("Failed to load stories.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      fetchStories();
      setTitle("");
      setError(null);
      setSubmitting(false);

      // Pre-select a story if provided
      if (preSelectedStoryId) {
        setSelectedIds(new Set([preSelectedStoryId]));
      } else {
        setSelectedIds(new Set());
      }
    }
  }, [isOpen, fetchStories, preSelectedStoryId]);

  if (!isOpen) return null;

  const toggleStory = (storyId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) {
        next.delete(storyId);
      } else {
        next.add(storyId);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (selectedIds.size === 0) {
      setError("Please select at least one story.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Determine cover_url from the first selected story
      const selectedArr = Array.from(selectedIds);
      const firstStory = stories.find((s) => s.id === selectedArr[0]);
      const coverUrl = firstStory?.media_url || null;

      // 1. Insert highlight
      const { data: highlightData, error: insertError } = await supabase
        .from("highlights")
        .insert({
          user_id: userId,
          title: title.trim(),
          cover_url: coverUrl,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      if (!highlightData) throw new Error("Failed to create highlight");

      // 2. Insert highlight_stories links
      const linksData = selectedArr.map((storyId) => ({
        highlight_id: highlightData.id,
        story_id: storyId,
      }));

      const { error: linksError } = await supabase
        .from("highlight_stories")
        .insert(linksData);

      if (linksError) throw linksError;

      onCreated();
    } catch (err: any) {
      console.error("[CreateHighlightModal] Error creating highlight:", err);
      setError(err.message || "Failed to create highlight.");
    } finally {
      setSubmitting(false);
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const isValid = title.trim().length > 0 && selectedIds.size > 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border shadow-xl rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-heading font-semibold text-heading text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            New Highlight
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-heading transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Title input */}
          <div className="px-6 pt-5 pb-4 shrink-0">
            <label className="block text-sm font-medium text-heading mb-2">
              Highlight Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Travel, Coding, Events..."
              className="w-full bg-gray-50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              maxLength={30}
              autoFocus
            />
          </div>

          {/* Story grid */}
          <div className="px-6 pb-4 flex-1 overflow-y-auto min-h-0">
            <label className="block text-sm font-medium text-heading mb-3">
              Select Stories{" "}
              <span className="text-gray-400 font-normal">
                ({selectedIds.size} selected)
              </span>
            </label>

            {loading ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="aspect-[9/16] bg-gray-200 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : stories.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                <p className="font-medium">No stories found</p>
                <p className="mt-1 text-xs">
                  Create a story first from the home page.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {stories.map((story) => {
                  const selected = selectedIds.has(story.id);
                  const expired = isExpired(story.expires_at);

                  return (
                    <button
                      key={story.id}
                      type="button"
                      onClick={() => toggleStory(story.id)}
                      className={`relative aspect-[9/16] rounded-xl overflow-hidden border-2 transition-all ${
                        selected
                          ? "border-accent ring-2 ring-accent/20 scale-[0.97]"
                          : "border-transparent hover:border-gray-300"
                      }`}
                    >
                      {story.media_type === "video" ? (
                        <video
                          src={story.media_url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={story.media_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Expired badge */}
                      {expired && (
                        <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                          Expired
                        </div>
                      )}

                      {/* Selected checkmark */}
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                      )}

                      {/* Dark overlay when not selected */}
                      {!selected && (
                        <div className="absolute inset-0 bg-black/10" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mb-3 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-sm text-red-600 shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border shrink-0">
            <button
              type="submit"
              disabled={submitting || !isValid}
              className="w-full py-3 bg-accent text-white font-medium rounded-xl text-sm hover:bg-accent/90 transition-all disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              {submitting ? "Creating..." : "Create Highlight"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
