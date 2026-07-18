"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import PostDetailModal, { Post } from "@/components/PostDetailModal";
import EditPostModal from "@/components/EditPostModal";
import PostGrid from "@/components/PostGrid";
import SwitchAccountModal from "@/components/SwitchAccountModal";
import FollowListModal from "@/components/FollowListModal";
import StoryViewer, { Story } from "@/components/StoryViewer";
import { Type, Code, Heart, StickyNote, MoreHorizontal, Trash2, Edit2, AlertCircle, Menu, Settings, Users, LogOut, X, MessageCircle } from "lucide-react";

type Profile = {
  id: string;
  name: string;
  headline: string;
  organization: string;
  bio: string;
  skills: string[];
  avatar_url?: string;
  github_url?: string;
  linkedin_url?: string;
  portfolio_url?: string;
};

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  
  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [followListModalOpen, setFollowListModalOpen] = useState(false);
  const [followListType, setFollowListType] = useState<"followers" | "following">("followers");
  
  // Stories state
  const [profileStories, setProfileStories] = useState<Story[]>([]);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);

  const fetchFollowCounts = useCallback(async () => {
    try {
      // Followers: users who follow this profile
      const { count: followers, error: followersError } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", id);

      if (followersError) {
        console.error("[ProfilePage] Error fetching followers count:", followersError);
      } else {
        setFollowersCount(followers ?? 0);
      }

      // Following: users this profile follows
      const { count: following, error: followingError } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", id);

      if (followingError) {
        console.error("[ProfilePage] Error fetching following count:", followingError);
      } else {
        setFollowingCount(following ?? 0);
      }
    } catch (err: any) {
      console.error("[ProfilePage] Error fetching follow counts:", err);
    }
  }, [id]);

  const fetchProfileStories = useCallback(async (profileOwnerId: string, viewerId: string | null) => {
    try {
      const nowStr = new Date().toISOString();
      const { data: storiesData, error: storiesError } = await supabase
        .from("stories")
        .select("*")
        .eq("user_id", profileOwnerId)
        .gt("expires_at", nowStr)
        .order("created_at", { ascending: true });

      if (storiesError) {
        console.error("[ProfilePage] Error fetching stories:", storiesError);
        return;
      }

      setProfileStories(storiesData || []);

      if (storiesData && storiesData.length > 0 && viewerId) {
        const storyIds = storiesData.map((s) => s.id);
        const { data: viewsData, error: viewsError } = await supabase
          .from("story_views")
          .select("story_id")
          .eq("viewer_id", viewerId)
          .in("story_id", storyIds);

        if (viewsError) {
          console.error("[ProfilePage] Error fetching story views:", viewsError);
        }

        const viewedIds = new Set<string>(viewsData?.map((v) => v.story_id) || []);
        setViewedStoryIds(viewedIds);
      } else {
        setViewedStoryIds(new Set());
      }
    } catch (err) {
      console.error("[ProfilePage] Error in fetchProfileStories:", err);
    }
  }, []);

  const fetchProfileAndUser = useCallback(async () => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (profileError) {
        if (profileError.code === "PGRST116") {
          setProfile(null);
        } else {
          throw profileError;
        }
      } else {
        setProfile(profileData);
      }

      // Fetch current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        if (user.id === id) {
          setIsOwner(true);
        } else {
          // Check follow status
          const { data: followData } = await supabase
            .from("follows")
            .select("*")
            .match({ follower_id: user.id, following_id: id })
            .single();
            
          if (followData) {
            setIsFollowing(true);
          }
        }
      }

      // Fetch follower/following counts
      await fetchFollowCounts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, fetchFollowCounts]);

  const fetchPosts = useCallback(async (userId: string, currentViewerId: string | null, authorProfile: Profile | null) => {
    if (!authorProfile) return;
    try {
      setPostsLoading(true);

      console.log("[ProfilePage] Fetching posts for user_id:", userId);

      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (postsError) {
        console.error("[ProfilePage] Posts query error:", postsError);
        throw postsError;
      }

      console.log("[ProfilePage] Posts fetched:", postsData?.length ?? 0, "for user_id:", userId);
      
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setPostsCount(0);
        return;
      }

      const postIds = postsData.map((post) => post.id);

      let likesData: any[] = [];
      if (postIds.length > 0) {
        const { data: fetchLikesData, error: likesError } = await supabase
          .from("likes")
          .select("post_id, user_id")
          .in("post_id", postIds);

        if (likesError) {
          console.error("Error fetching likes:", likesError);
        } else {
          likesData = fetchLikesData || [];
        }
      }

      let commentsData: any[] = [];
      if (postIds.length > 0) {
        const { data: fetchCommentsData, error: commentsError } = await supabase
          .from("comments")
          .select("post_id")
          .in("post_id", postIds);

        if (commentsError) {
          console.error("Error fetching comments:", commentsError);
        } else {
          commentsData = fetchCommentsData || [];
        }
      }

      const mergedPosts = postsData.map((post) => {
        const postLikes = likesData.filter((l) => l.post_id === post.id);
        const postComments = commentsData.filter((c) => c.post_id === post.id);
        const isLikedByMe = currentViewerId ? postLikes.some((l) => l.user_id === currentViewerId) : false;

        return {
          ...post,
          profiles: {
            name: authorProfile.name,
            avatar_url: authorProfile.avatar_url || "",
            headline: authorProfile.headline || "",
          },
          likeCount: postLikes.length,
          commentCount: postComments.length,
          isLikedByMe,
        };
      });

      setPosts(mergedPosts as Post[]);
      setPostsCount(mergedPosts.length);
    } catch (err: any) {
      console.error("[ProfilePage] Posts fetch failed:", err.message);
      setPosts([]);
      setPostsCount(0);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchProfileAndUser();
  }, [id, fetchProfileAndUser]);

  useEffect(() => {
    if (profile && !loading) {
      fetchPosts(profile.id, currentUserId, profile);
      fetchProfileStories(profile.id, currentUserId);
    }
  }, [profile, currentUserId, loading, fetchPosts, fetchProfileStories]);

  // Listen for custom events from Modals
  useEffect(() => {
    if (!profile) return;

    const handleRefresh = () => {
      fetchPosts(profile.id, currentUserId, profile);
    };

    window.addEventListener('postCreated', handleRefresh);
    window.addEventListener('postDeleted', handleRefresh);
    window.addEventListener('postUpdated', handleRefresh);
    
    return () => {
      window.removeEventListener('postCreated', handleRefresh);
      window.removeEventListener('postDeleted', handleRefresh);
      window.removeEventListener('postUpdated', handleRefresh);
    };
  }, [profile, currentUserId, fetchPosts]);

  // Escape key listener for avatar viewer
  useEffect(() => {
    if (!avatarViewerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAvatarViewerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [avatarViewerOpen]);

  const handleFollowToggle = async () => {
    if (!currentUserId || isOwner) return;
    setFollowLoading(true);
    
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .match({ follower_id: currentUserId, following_id: id });
        if (error) throw error;
        setIsFollowing(false);
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: currentUserId, following_id: id });
        if (error) throw error;
        
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            recipient_id: id,
            actor_id: currentUserId,
            type: "follow",
            post_id: null
          });
          
        if (notifError) {
          console.error("Error creating follow notification:", notifError);
        }
        
        setIsFollowing(true);
      }

      // Update follower count after follow/unfollow
      await fetchFollowCounts();
    } catch (err: any) {
      console.error("Error toggling follow:", err.message);
      setFollowError("Failed to update follow status.");
      setTimeout(() => setFollowError(null), 3000);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      console.error("[ProfilePage] Logout failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-16 bg-background text-body">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8">
            {/* Left Column Skeleton */}
            <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-6 h-fit animate-pulse">
              <div className="flex flex-col items-center sm:items-start space-y-4">
                <div className="w-24 h-24 rounded-full bg-gray-200"></div>
                <div className="space-y-2 w-full">
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
            {/* Right Column Skeleton */}
            <div className="space-y-8 animate-pulse">
              <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-body">
        <div className="text-red-600 bg-red-50 p-4 rounded-lg border border-red-100">
          Error loading profile: {error}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-body">
        <h2 className="text-2xl font-heading font-bold tracking-tight text-heading">Profile not found</h2>
        <p className="text-body mt-2 text-sm">The user you are looking for does not exist.</p>
        <Link href="/" className="mt-6 text-sm text-accent hover:underline font-medium">
          Return home
        </Link>
      </div>
    );
  }

  // Get initials for avatar placeholder
  const initials = profile.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <>
      <div className="min-h-screen py-16 bg-background text-body">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8">
            {/* Left Column (Sticky Sidebar) */}
            <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-8 h-fit lg:sticky lg:top-24 relative">
              
              {isOwner && (
                <div className="absolute top-4 right-4 z-30">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="p-1.5 text-body hover:text-heading hover:bg-gray-100 rounded-lg transition-all"
                    aria-label="Menu"
                  >
                    <Menu className="w-6 h-6" />
                  </button>

                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-52 bg-surface border border-border shadow-xl rounded-xl z-50 overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                        <Link
                          href="/profile/edit"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-body hover:bg-gray-50 transition-colors font-medium"
                        >
                          <Edit2 className="w-4 h-4 text-gray-400" />
                          Edit Profile
                        </Link>
                        <Link
                          href="/settings"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-body hover:bg-gray-50 transition-colors font-medium"
                        >
                          <Settings className="w-4 h-4 text-gray-400" />
                          Settings
                        </Link>
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setSwitchModalOpen(true);
                          }}
                          className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-body hover:bg-gray-50 transition-colors font-medium"
                        >
                          <Users className="w-4 h-4 text-gray-400" />
                          Switch Account
                        </button>
                        <div className="h-px bg-border my-1" />
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            handleLogout();
                          }}
                          className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                        >
                          <LogOut className="w-4 h-4 text-red-500" />
                          Logout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-6">
                {/* Avatar */}
                {profileStories.length > 0 ? (
                  <button
                    onClick={() => setStoryViewerOpen(true)}
                    className="focus:outline-none cursor-pointer group rounded-full"
                  >
                    <div
                      className={`w-24 h-24 rounded-full overflow-hidden border-2 flex items-center justify-center ${
                        profileStories.some((s) => !viewedStoryIds.has(s.id))
                          ? "border-transparent"
                          : "border-gray-200"
                      }`}
                      style={
                        profileStories.some((s) => !viewedStoryIds.has(s.id))
                          ? {
                              background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                              padding: "3px",
                            }
                          : {
                              padding: "2px",
                            }
                      }
                    >
                      <div className="w-full h-full rounded-full overflow-hidden bg-surface flex items-center justify-center">
                        {profile.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={profile.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-background flex items-center justify-center text-3xl font-medium text-gray-400">
                            {initials}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ) : profile.avatar_url ? (
                  <button
                    onClick={() => setAvatarViewerOpen(true)}
                    className="focus:outline-none cursor-pointer group rounded-full"
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden border border-border group-hover:opacity-90 transition-opacity">
                      <img
                        src={profile.avatar_url}
                        alt={profile.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </button>
                ) : (
                  <div className="w-24 h-24 rounded-full overflow-hidden border border-border">
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center text-3xl font-medium text-gray-400">
                      {initials}
                    </div>
                  </div>
                )}

                {/* Basic Info */}
                <div className="space-y-2 w-full">
                  <h1 className="text-2xl font-heading font-bold tracking-tight text-heading">
                    {profile.name}
                  </h1>
                  <p className="text-sm font-mono text-body">
                    {profile.headline}
                  </p>
                  {profile.organization && (
                    <p className="text-sm text-gray-500 mt-1">
                      {profile.organization}
                    </p>
                  )}

                  {/* Counts: Posts · Followers · Following */}
                  <div className="flex items-center gap-4 mt-3 flex-wrap text-sm">
                    <div>
                      <span className="font-semibold text-heading">{postsCount}</span>
                      <span className="text-body ml-1">{postsCount === 1 ? "Post" : "Posts"}</span>
                    </div>
                    <span className="text-border">·</span>
                    <button
                      onClick={() => {
                        setFollowListType("followers");
                        setFollowListModalOpen(true);
                      }}
                      className="hover:text-accent hover:underline transition-colors flex items-center cursor-pointer"
                    >
                      <span className="font-semibold text-heading">{followersCount}</span>
                      <span className="text-body ml-1">{followersCount === 1 ? "Follower" : "Followers"}</span>
                    </button>
                    <span className="text-border">·</span>
                    <button
                      onClick={() => {
                        setFollowListType("following");
                        setFollowListModalOpen(true);
                      }}
                      className="hover:text-accent hover:underline transition-colors flex items-center cursor-pointer"
                    >
                      <span className="font-semibold text-heading">{followingCount}</span>
                      <span className="text-body ml-1">Following</span>
                    </button>
                  </div>
                  
                  {currentUserId && !isOwner && (
                    <div className="mt-4">
                      {followError && (
                        <div className="mb-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-xs text-red-600">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {followError}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleFollowToggle}
                          disabled={followLoading}
                          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors group disabled:opacity-50 ${
                            isFollowing 
                              ? "bg-surface border border-border text-heading hover:border-red-500 hover:text-red-600" 
                              : "bg-accent text-white border border-transparent hover:bg-accent/90"
                          }`}
                        >
                          {followLoading ? "Loading..." : isFollowing ? (
                            <>
                              <span className="block group-hover:hidden">Following</span>
                              <span className="hidden group-hover:block">Unfollow</span>
                            </>
                          ) : "Follow"}
                        </button>
                        <button
                          onClick={() => alert("Messaging coming soon")}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-surface border border-border text-heading hover:bg-gray-50 transition-colors text-sm font-medium rounded-lg flex-1"
                        >
                          <MessageCircle className="w-4.5 h-4.5 text-gray-500" />
                          <span>Message</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Links */}
              {(profile.github_url || profile.linkedin_url || profile.portfolio_url) && (
                <div className="space-y-3 pt-6 border-t border-border">
                  <h2 className="font-mono text-xs uppercase text-accent">&gt; Links</h2>
                  <div className="flex flex-col gap-3">
                    {profile.github_url && (
                      <a
                        href={profile.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-body hover:text-accent transition-colors w-fit"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                        </svg>
                        GitHub
                      </a>
                    )}
                    {profile.linkedin_url && (
                      <a
                        href={profile.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-body hover:text-accent transition-colors w-fit"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                        LinkedIn
                      </a>
                    )}
                    {profile.portfolio_url && (
                      <a
                        href={profile.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-body hover:text-accent transition-colors w-fit"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        Portfolio
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              
              {/* Profile Details Cards */}
              <div className="space-y-8">
                {/* Bio */}
                {profile.bio && (
                  <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-4">
                    <h2 className="font-mono text-xs uppercase text-accent">&gt; About</h2>
                    <p className="text-body leading-relaxed whitespace-pre-wrap">
                      {profile.bio}
                    </p>
                  </div>
                )}

                {/* Skills */}
                {profile.skills && profile.skills.length > 0 && (
                  <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-5">
                    <h2 className="font-mono text-xs uppercase text-accent">&gt; Skills</h2>
                    <div className="flex flex-wrap gap-2.5">
                      {profile.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="font-mono text-xs bg-blue-50 px-3 py-1 text-accent rounded-full border border-accent/20"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Posts Grid */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h2 className="font-heading font-semibold text-xl text-heading">Posts</h2>
                <PostGrid posts={posts} loading={postsLoading} currentUserId={currentUserId} />
              </div>

            </div>
          </div>

        </div>
      </div>

      <SwitchAccountModal
        isOpen={switchModalOpen}
        onClose={() => setSwitchModalOpen(false)}
        currentUserId={currentUserId}
      />

      <FollowListModal
        isOpen={followListModalOpen}
        onClose={() => setFollowListModalOpen(false)}
        type={followListType}
        profileId={profile.id}
        currentUserId={currentUserId}
        isOwner={isOwner}
        onCountChange={fetchFollowCounts}
      />

      {storyViewerOpen && profileStories.length > 0 && (
        <StoryViewer
          groups={[{
            userId: profile.id,
            name: profile.name,
            avatar_url: profile.avatar_url || "",
            stories: profileStories
          }]}
          startGroupIndex={0}
          viewerId={currentUserId || ""}
          onClose={() => {
            setStoryViewerOpen(false);
            fetchProfileStories(profile.id, currentUserId);
          }}
          onStoryViewed={(storyId) => {
            setViewedStoryIds((prev) => {
              const next = new Set(prev);
              next.add(storyId);
              return next;
            });
          }}
        />
      )}

      {avatarViewerOpen && profile.avatar_url && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setAvatarViewerOpen(false)}
        >
          <button
            onClick={() => setAvatarViewerOpen(false)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="relative max-w-sm w-full aspect-square rounded-full overflow-hidden border-4 border-white/10 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={profile.avatar_url}
              alt={profile.name}
              className="w-full h-full object-cover rounded-full"
            />
          </div>
        </div>
      )}
    </>
  );
}
