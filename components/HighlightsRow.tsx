"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, MoreHorizontal, Trash2, Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import StoryViewer, { Story, StoryGroup } from "./StoryViewer";
import CreateHighlightModal from "./CreateHighlightModal";

type Highlight = {
  id: string;
  user_id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
  stories: Story[];
};

type Props = {
  profileId: string;
  isOwner: boolean;
  currentUserId: string | null;
  profileName: string;
  profileAvatarUrl: string;
};

export default function HighlightsRow({
  profileId,
  isOwner,
  currentUserId,
  profileName,
  profileAvatarUrl,
}: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerGroups, setViewerGroups] = useState<StoryGroup[]>([]);

  // Delete menu state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHighlights = useCallback(async () => {
    try {
      // 1. Fetch highlights for this profile
      const { data: highlightsData, error: highlightsError } = await supabase
        .from("highlights")
        .select("*")
        .eq("user_id", profileId)
        .order("created_at", { ascending: true });

      if (highlightsError) throw highlightsError;

      if (!highlightsData || highlightsData.length === 0) {
        setHighlights([]);
        return;
      }

      // 2. Fetch linked story IDs via highlight_stories
      const highlightIds = highlightsData.map((h) => h.id);
      const { data: linksData, error: linksError } = await supabase
        .from("highlight_stories")
        .select("highlight_id, story_id")
        .in("highlight_id", highlightIds);

      if (linksError) throw linksError;

      // 3. Fetch the actual story rows
      const storyIds = [...new Set((linksData || []).map((l) => l.story_id))];
      let storiesMap = new Map<string, Story>();

      if (storyIds.length > 0) {
        const { data: storiesData, error: storiesError } = await supabase
          .from("stories")
          .select("*")
          .in("id", storyIds);

        if (storiesError) throw storiesError;

        storiesMap = new Map(
          (storiesData || []).map((s) => [s.id, s as Story])
        );
      }

      // 4. Build highlight objects with their stories
      const linksByHighlight = new Map<string, string[]>();
      (linksData || []).forEach((l) => {
        const existing = linksByHighlight.get(l.highlight_id) || [];
        existing.push(l.story_id);
        linksByHighlight.set(l.highlight_id, existing);
      });

      const merged: Highlight[] = highlightsData.map((h) => {
        const linkedStoryIds = linksByHighlight.get(h.id) || [];
        const stories = linkedStoryIds
          .map((sid) => storiesMap.get(sid))
          .filter(Boolean) as Story[];

        return {
          ...h,
          stories,
        };
      });

      setHighlights(merged);
    } catch (err) {
      console.error("[HighlightsRow] Error fetching highlights:", err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const handleOpenViewer = (highlight: Highlight) => {
    if (highlight.stories.length === 0) return;

    const group: StoryGroup = {
      userId: profileId,
      name: highlight.title,
      avatar_url: highlight.cover_url || profileAvatarUrl,
      stories: highlight.stories,
    };

    setViewerGroups([group]);
    setViewerOpen(true);
  };

  const handleDelete = async (highlightId: string) => {
    setDeletingId(highlightId);
    setMenuOpenId(null);

    try {
      // Delete highlight_stories first (in case no cascade)
      await supabase
        .from("highlight_stories")
        .delete()
        .eq("highlight_id", highlightId);

      const { error } = await supabase
        .from("highlights")
        .delete()
        .eq("id", highlightId);

      if (error) throw error;

      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    } catch (err) {
      console.error("[HighlightsRow] Error deleting highlight:", err);
      alert("Failed to delete highlight.");
    } finally {
      setDeletingId(null);
    }
  };

  // Don't render anything if loading skeleton not needed and no highlights and not owner
  if (!loading && highlights.length === 0 && !isOwner) return null;

  return (
    <>
      {/* Highlights Row */}
      <div className="flex gap-4 overflow-x-auto py-3 scrollbar-hide">
        {/* "+ New" button for owner */}
        {isOwner && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 group-hover:border-accent group-hover:bg-accent/5 transition-colors">
              <Plus className="w-6 h-6 text-gray-400 group-hover:text-accent transition-colors" />
            </div>
            <span className="text-xs text-body font-medium truncate w-16 text-center">
              New
            </span>
          </button>
        )}

        {/* Loading skeleton */}
        {loading &&
          [1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
              <div className="w-12 h-3 rounded bg-gray-200 animate-pulse" />
            </div>
          ))}

        {/* Highlight bubbles */}
        {!loading &&
          highlights.map((highlight) => (
            <div
              key={highlight.id}
              className="flex flex-col items-center gap-1.5 shrink-0 relative group/hl"
            >
              <button
                onClick={() => handleOpenViewer(highlight)}
                className="relative focus:outline-none"
                disabled={deletingId === highlight.id}
              >
                <div
                  className={`w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 transition-opacity ${
                    deletingId === highlight.id ? "opacity-40" : ""
                  }`}
                >
                  {highlight.cover_url ? (
                    <img
                      src={highlight.cover_url}
                      alt={highlight.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
              </button>

              {/* Delete menu (owner only) */}
              {isOwner && (
                <div className="absolute -top-1 -right-1 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(
                        menuOpenId === highlight.id ? null : highlight.id
                      );
                    }}
                    className="w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/hl:opacity-100 transition-opacity hover:bg-black/70"
                    aria-label="Highlight options"
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </button>

                  {menuOpenId === highlight.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpenId(null)}
                      />
                      <div className="absolute right-0 top-6 w-40 bg-surface border border-border shadow-xl rounded-xl overflow-hidden z-50 py-1">
                        <button
                          onClick={() => handleDelete(highlight.id)}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Highlight
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <span className="text-xs text-body font-medium truncate w-16 text-center">
                {highlight.title}
              </span>
            </div>
          ))}
      </div>

      {/* Story Viewer for Highlights */}
      {viewerOpen && viewerGroups.length > 0 && (
        <StoryViewer
          groups={viewerGroups}
          startGroupIndex={0}
          viewerId={currentUserId || ""}
          onClose={() => {
            setViewerOpen(false);
            setViewerGroups([]);
          }}
        />
      )}

      {/* Create Highlight Modal */}
      {isOwner && currentUserId && (
        <CreateHighlightModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          userId={currentUserId}
          onCreated={() => {
            setCreateModalOpen(false);
            fetchHighlights();
          }}
        />
      )}
    </>
  );
}
