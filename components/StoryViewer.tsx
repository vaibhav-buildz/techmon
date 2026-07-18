"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  created_at: string;
  expires_at: string;
};

export type StoryGroup = {
  userId: string;
  name: string;
  avatar_url: string;
  stories: Story[];
};

type Props = {
  groups: StoryGroup[];
  startGroupIndex: number;
  viewerId: string;
  onClose: () => void;
  onStoryViewed?: (storyId: string) => void;
};

function timeAgo(dateString: string) {
  const seconds = Math.floor(
    (new Date().getTime() - new Date(dateString).getTime()) / 1000
  );
  let interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return "Just now";
}

const STORY_DURATION = 5000; // 5 seconds for images

export default function StoryViewer({
  groups,
  startGroupIndex,
  viewerId,
  onClose,
  onStoryViewed,
}: Props) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewedSetRef = useRef<Set<string>>(new Set());

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  // Record a view
  const recordView = useCallback(
    async (storyId: string) => {
      if (viewedSetRef.current.has(storyId)) return;
      viewedSetRef.current.add(storyId);

      try {
        // Use upsert with onConflict to avoid duplicate inserts
        await supabase.from("story_views").insert({
          story_id: storyId,
          viewer_id: viewerId,
        });
      } catch {
        // Silently fail — might be a duplicate
      }

      onStoryViewed?.(storyId);
    },
    [viewerId, onStoryViewed]
  );

  // Navigate forward
  const goNext = useCallback(() => {
    if (!currentGroup) return;

    if (storyIndex < currentGroup.stories.length - 1) {
      // Next story in same group
      setStoryIndex((i) => i + 1);
      setProgress(0);
      elapsedRef.current = 0;
    } else if (groupIndex < groups.length - 1) {
      // Next group
      setGroupIndex((i) => i + 1);
      setStoryIndex(0);
      setProgress(0);
      elapsedRef.current = 0;
    } else {
      // All done
      onClose();
    }
  }, [currentGroup, storyIndex, groupIndex, groups.length, onClose]);

  // Navigate backward
  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
      setProgress(0);
      elapsedRef.current = 0;
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((i) => i - 1);
      setStoryIndex(prevGroup.stories.length - 1);
      setProgress(0);
      elapsedRef.current = 0;
    }
    // If at very beginning, do nothing
  }, [storyIndex, groupIndex, groups]);

  // Record view on story change
  useEffect(() => {
    if (currentStory) {
      recordView(currentStory.id);
    }
  }, [currentStory?.id, recordView]);

  // Timer for image stories
  useEffect(() => {
    if (!currentStory || currentStory.media_type === "video" || paused) return;

    const duration = STORY_DURATION;
    startTimeRef.current = performance.now() - elapsedRef.current;

    timerRef.current = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      const pct = Math.min(elapsed / duration, 1);
      setProgress(pct);

      if (pct >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        goNext();
      }
    }, 30);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        elapsedRef.current = performance.now() - startTimeRef.current;
      }
    };
  }, [currentStory?.id, currentStory?.media_type, paused, goNext]);

  // Video progress tracking
  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress(video.currentTime / video.duration);
  }, []);

  const handleVideoEnded = useCallback(() => {
    goNext();
  }, [goNext]);

  // Handle tap navigation
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const halfWidth = rect.width / 2;

    if (clickX < halfWidth) {
      goPrev();
    } else {
      goNext();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!currentGroup || !currentStory) return null;

  const totalStories = currentGroup.stories.length;

  return (
    <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center">
      {/* Story container */}
      <div
        className="relative w-full h-full max-w-[480px] max-h-[100dvh] mx-auto flex flex-col"
        onClick={handleTap}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-3">
          {currentGroup.stories.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden"
            >
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width:
                    i < storyIndex
                      ? "100%"
                      : i === storyIndex
                      ? `${progress * 100}%`
                      : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-8 pb-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-3">
            {currentGroup.avatar_url ? (
              <img
                src={currentGroup.avatar_url}
                alt={currentGroup.name}
                className="w-9 h-9 rounded-full object-cover border-2 border-white/80"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-600 border-2 border-white/80 flex items-center justify-center text-sm font-medium text-white">
                {currentGroup.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
            <div>
              <p className="text-white text-sm font-semibold leading-tight">
                {currentGroup.name}
              </p>
              <p className="text-white/60 text-xs">
                {timeAgo(currentStory.created_at)}
              </p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Media content */}
        <div className="flex-1 flex items-center justify-center w-full h-full overflow-hidden">
          {currentStory.media_type === "video" ? (
            <video
              key={currentStory.id}
              ref={videoRef}
              src={currentStory.media_url}
              className="w-full h-full object-contain"
              autoPlay
              playsInline
              muted={false}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              onLoadedData={() => setProgress(0)}
            />
          ) : (
            <img
              key={currentStory.id}
              src={currentStory.media_url}
              alt="Story"
              className="w-full h-full object-contain"
              draggable={false}
            />
          )}
        </div>

        {/* Story counter */}
        {totalStories > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            <span className="text-white/50 text-xs font-medium">
              {storyIndex + 1} / {totalStories}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
