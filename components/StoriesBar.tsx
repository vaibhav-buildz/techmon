"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import StoryViewer, { Story, StoryGroup } from "./StoryViewer";
import CameraCaptureModal from "./CameraCaptureModal";

type Props = {
  userId: string;
  userProfile: {
    name: string;
    avatar_url?: string;
  };
};

export default function StoriesBar({ userId, userProfile }: Props) {
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(
    new Set()
  );

  // Viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);

  // Capture modal state
  const [captureModalOpen, setCaptureModalOpen] = useState(false);

  const fetchStories = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);

      // 1. Get followed user IDs
      const { data: followData, error: followError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      if (followError) throw followError;

      const followingIds = followData?.map((f) => f.following_id) || [];
      const allUserIds = [userId, ...followingIds];

      // 2. Fetch active stories for all relevant users
      const { data: storiesData, error: storiesError } = await supabase
        .from("stories")
        .select("*")
        .in("user_id", allUserIds)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });

      if (storiesError) throw storiesError;

      console.log("[StoriesBar] Fetched stories:", storiesData?.length ?? 0, "for users:", allUserIds);

      if (!storiesData || storiesData.length === 0) {
        console.log("[StoriesBar] No active stories found");
        setStoryGroups([]);
        setMyStories([]);
        return;
      }

      // 3. Fetch profiles for story authors
      const storyUserIds = [...new Set(storiesData.map((s) => s.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", storyUserIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(
        profilesData?.map((p) => [p.id, p]) || []
      );

      // 4. Fetch story views for current user
      const storyIds = storiesData.map((s) => s.id);
      const { data: viewsData, error: viewsError } = await supabase
        .from("story_views")
        .select("story_id")
        .eq("viewer_id", userId)
        .in("story_id", storyIds);

      if (viewsError) {
        console.error("Error fetching story views:", viewsError);
      }

      const viewedIds = new Set(
        viewsData?.map((v) => v.story_id) || []
      );
      setViewedStoryIds(viewedIds);

      // 5. Group stories by user
      const groupMap = new Map<string, Story[]>();
      for (const story of storiesData) {
        const existing = groupMap.get(story.user_id) || [];
        existing.push(story as Story);
        groupMap.set(story.user_id, existing);
      }

      // Separate own stories
      const ownStories = groupMap.get(userId) || [];
      console.log("[StoriesBar] Own stories:", ownStories.length, "Followed groups:", followingIds.length);
      setMyStories(ownStories);

      // Build groups for followed users (exclude self — self is rendered as the "+" item)
      const followedGroups: StoryGroup[] = [];
      for (const uid of followingIds) {
        const stories = groupMap.get(uid);
        if (!stories || stories.length === 0) continue;

        const profile = profileMap.get(uid);
        followedGroups.push({
          userId: uid,
          name: profile?.name || "Unknown",
          avatar_url: profile?.avatar_url || "",
          stories,
        });
      }

      // Sort: unviewed groups first
      followedGroups.sort((a, b) => {
        const aHasUnviewed = a.stories.some((s) => !viewedIds.has(s.id));
        const bHasUnviewed = b.stories.some((s) => !viewedIds.has(s.id));
        if (aHasUnviewed && !bHasUnviewed) return -1;
        if (!aHasUnviewed && bHasUnviewed) return 1;
        return 0;
      });

      setStoryGroups(followedGroups);
    } catch (err: any) {
      console.error("[StoriesBar] Error fetching stories:", err);
      setError("Failed to load stories.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStories(true); // initial load with skeleton
  }, [fetchStories]);

  // Called when a story is successfully created via the capture modal
  const handleStoryCreated = useCallback(() => {
    console.log("[StoriesBar] Story created, refetching...");
    fetchStories(false); // refetch without skeleton
  }, [fetchStories]);

  // Build the full viewer groups array (self first, then followed)
  const allViewerGroups: StoryGroup[] = [];

  if (myStories.length > 0) {
    allViewerGroups.push({
      userId,
      name: userProfile.name || "You",
      avatar_url: userProfile.avatar_url || "",
      stories: myStories,
    });
  }

  allViewerGroups.push(...storyGroups);

  const openViewer = (groupIndex: number) => {
    setViewerStartIndex(groupIndex);
    setViewerOpen(true);
  };

  const handleStoryViewed = (storyId: string) => {
    setViewedStoryIds((prev) => {
      const next = new Set(prev);
      next.add(storyId);
      return next;
    });
  };

  // Check if a group has any unviewed stories
  const hasUnviewedStories = (stories: Story[]) =>
    stories.some((s) => !viewedStoryIds.has(s.id));

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden py-2 mb-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2 shrink-0">
            <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
            <div className="w-12 h-3 rounded bg-gray-200 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  // Don't render bar at all if no stories and no followed users
  const showBar = myStories.length > 0 || storyGroups.length > 0 || true; // Always show the "+" button

  if (!showBar) return null;

  return (
    <>
      {error && (
        <div className="mb-3 px-4 py-2 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto py-2 mb-6 scrollbar-hide">
        {/* Own story / Add story */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="relative">
            {/* Avatar — clicking opens viewer if user has stories, otherwise opens capture */}
            <button
              onClick={() => {
                if (myStories.length > 0) {
                  openViewer(0);
                } else {
                  setCaptureModalOpen(true);
                }
              }}
              className="block"
            >
              <div
                className={`w-16 h-16 rounded-full overflow-hidden border-2 ${
                  myStories.length > 0
                    ? "border-transparent"
                    : "border-gray-200"
                }`}
                style={
                  myStories.length > 0
                    ? {
                        background: hasUnviewedStories(myStories)
                          ? "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)"
                          : "linear-gradient(135deg, #d1d5db, #9ca3af)",
                        padding: "2px",
                      }
                    : undefined
                }
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-gray-100">
                  {userProfile.avatar_url ? (
                    <img
                      src={userProfile.avatar_url}
                      alt="Your story"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-medium text-gray-400">
                      {userProfile.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
              </div>
            </button>
            {/* Plus badge — always opens capture modal */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCaptureModalOpen(true);
              }}
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-accent rounded-full border-2 border-white flex items-center justify-center shadow-sm hover:bg-accent/90 transition-colors"
              aria-label="Add story"
            >
              <Plus className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </button>
          </div>
          <span className="text-xs text-body font-medium truncate w-16 text-center">
            Your story
          </span>
        </div>

        {/* Followed users' stories */}
        {storyGroups.map((group, i) => {
          const unviewed = hasUnviewedStories(group.stories);
          // The viewer index accounts for whether "self" group is present
          const viewerIdx = myStories.length > 0 ? i + 1 : i;

          return (
            <button
              key={group.userId}
              onClick={() => openViewer(viewerIdx)}
              className="flex flex-col items-center gap-1.5 shrink-0 group"
            >
              <div
                className={`w-16 h-16 rounded-full overflow-hidden ${
                  unviewed ? "" : "border-2 border-gray-300"
                }`}
                style={
                  unviewed
                    ? {
                        background:
                          "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                        padding: "3px",
                      }
                    : undefined
                }
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-gray-100">
                  {group.avatar_url ? (
                    <img
                      src={group.avatar_url}
                      alt={group.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-medium text-gray-400">
                      {group.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs text-body font-medium truncate w-16 text-center">
                {group.name?.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Story Viewer */}
      {viewerOpen && allViewerGroups.length > 0 && (
        <StoryViewer
          groups={allViewerGroups}
          startGroupIndex={viewerStartIndex}
          viewerId={userId}
          onClose={() => {
            setViewerOpen(false);
            // Refresh to update viewed states
            fetchStories();
          }}
          onStoryViewed={handleStoryViewed}
        />
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={captureModalOpen}
        onClose={() => setCaptureModalOpen(false)}
        userId={userId}
        onStoryCreated={handleStoryCreated}
      />
    </>
  );
}
