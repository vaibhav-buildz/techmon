"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Check, Sparkles, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import CreateHighlightModal from "./CreateHighlightModal";

type HighlightItem = {
  id: string;
  title: string;
  cover_url: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  storyId: string;
  storyMediaUrl: string;
};

export default function SaveToHighlightModal({
  isOpen,
  onClose,
  userId,
  storyId,
  storyMediaUrl,
}: Props) {
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetchHighlights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user's highlights
      const { data, error: fetchError } = await supabase
        .from("highlights")
        .select("id, title, cover_url")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;
      setHighlights(data || []);

      // Check which highlights already contain this story
      if (data && data.length > 0) {
        const highlightIds = data.map((h) => h.id);
        const { data: existingLinks } = await supabase
          .from("highlight_stories")
          .select("highlight_id")
          .eq("story_id", storyId)
          .in("highlight_id", highlightIds);

        if (existingLinks) {
          setAddedIds(new Set(existingLinks.map((l) => l.highlight_id)));
        }
      }
    } catch (err) {
      console.error("[SaveToHighlightModal] Error:", err);
      setError("Failed to load highlights.");
    } finally {
      setLoading(false);
    }
  }, [userId, storyId]);

  useEffect(() => {
    if (isOpen) {
      fetchHighlights();
    }
  }, [isOpen, fetchHighlights]);

  if (!isOpen) return null;

  const handleAddToHighlight = async (highlightId: string) => {
    if (addedIds.has(highlightId)) return; // Already added
    setAddingToId(highlightId);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from("highlight_stories")
        .insert({
          highlight_id: highlightId,
          story_id: storyId,
        });

      if (insertError) throw insertError;

      setAddedIds((prev) => {
        const next = new Set(prev);
        next.add(highlightId);
        return next;
      });
    } catch (err: any) {
      // Ignore duplicate errors
      if (err?.code === "23505") {
        setAddedIds((prev) => {
          const next = new Set(prev);
          next.add(highlightId);
          return next;
        });
      } else {
        console.error("[SaveToHighlightModal] Error adding:", err);
        setError("Failed to add to highlight.");
      }
    } finally {
      setAddingToId(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-surface border border-border shadow-2xl rounded-t-2xl sm:rounded-2xl w-full max-w-sm max-h-[70vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h3 className="font-heading font-semibold text-heading text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              Save to Highlight
            </h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-heading transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                    <div className="flex-1 h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {highlights.length === 0 && (
                  <p className="text-center text-sm text-gray-500 py-6">
                    No highlights yet. Create your first one!
                  </p>
                )}

                {highlights.map((highlight) => {
                  const isAdded = addedIds.has(highlight.id);
                  const isAdding = addingToId === highlight.id;

                  return (
                    <button
                      key={highlight.id}
                      onClick={() => handleAddToHighlight(highlight.id)}
                      disabled={isAdded || isAdding}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                        isAdded
                          ? "bg-accent/5 cursor-default"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Cover */}
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-gray-100 shrink-0">
                        {highlight.cover_url ? (
                          <img
                            src={highlight.cover_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <span className="flex-1 text-left text-sm font-medium text-heading truncate">
                        {highlight.title}
                      </span>

                      {/* Status */}
                      {isAdding ? (
                        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin shrink-0" />
                      ) : isAdded ? (
                        <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </div>
                      ) : (
                        <Plus className="w-5 h-5 text-gray-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* Create New */}
          <div className="px-4 py-3 border-t border-border shrink-0">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-accent hover:bg-accent/5 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Highlight
            </button>
          </div>
        </div>
      </div>

      {/* Create Highlight Modal */}
      <CreateHighlightModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        userId={userId}
        preSelectedStoryId={storyId}
        onCreated={() => {
          setCreateModalOpen(false);
          fetchHighlights(); // Refresh the list
        }}
      />
    </>
  );
}
