"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Post } from "@/lib/types";
import PostDetailModal from "@/components/PostDetailModal";
import EditPostModal from "@/components/EditPostModal";
import PostGrid from "@/components/PostGrid";
import SwitchAccountModal from "@/components/SwitchAccountModal";
import FollowListModal from "@/components/FollowListModal";
import StoryViewer, { Story } from "@/components/StoryViewer";
import HighlightsRow from "@/components/HighlightsRow";
import { Type, Code, Heart, StickyNote, MoreHorizontal, Trash2, Edit2, AlertCircle, Menu, Settings, Users, LogOut, X, MessageCircle, Archive, Activity, Grid, Repeat2 } from "lucide-react";

type Profile = {
  id: string;
  username?: string;
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
  const routeUsername = params?.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"posts" | "reposts">("posts");
  
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

  const fetchFollowCounts = useCallback(async (profileId: string) => {
    try {
      // Followers: users who follow this profile
      const { count: followers, error: followersError } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileId);

      if (followersError) {
        console.error("[ProfilePage] Error fetching followers count:", followersError);
      } else {
        setFollowersCount(followers ?? 0);
      }

      // Following: users this profile follows
      const { count: following, error: followingError } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileId);

      if (followingError) {
        console.error("[ProfilePage] Error fetching following count:", followingError);
      } else {
        setFollowingCount(following ?? 0);
      }
    } catch (err: any) {
      console.error("[ProfilePage] Error fetching follow counts:", err);
    }
  }, []);

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
      if (!routeUsername) return;

      // Check if parameter is a UUID or a username string
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(routeUsername);
      
      let profileQuery = supabase.from("profiles").select("*");
      if (isUUID) {
        profileQuery = profileQuery.eq("id", routeUsername);
      } else {
        profileQuery = profileQuery.eq("username", routeUsername);
      }

      const { data: profileData, error: profileError } = await profileQuery.maybeSingle();

      if (profileError) {
        throw profileError;
      }
      
      if (profileData) {
        let activeUsername = profileData.username;
        if (!activeUsername) {
          const generated = (profileData.name || "user").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15) || "user";
          activeUsername = `${generated}_${profileData.id.slice(0, 4)}`;
          profileData.username = activeUsername;
          await supabase.from("profiles").update({ username: activeUsername }).eq("id", profileData.id);
        }

        setProfile(profileData);

        // If accessed via UUID route parameter, redirect browser URL to /profile/[username]
        if (isUUID && activeUsername) {
          router.replace(`/profile/${activeUsername}`);
        }
      } else {
        setProfile(null);
      }

      // Fetch current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        if (profileData && user.id === profileData.id) {
          setIsOwner(true);
        } else if (profileData) {
          // Check follow status
          const { data: followData } = await supabase
            .from("follows")
            .select("*")
            .match({ follower_id: user.id, following_id: profileData.id })
            .maybeSingle();
            
          if (followData) {
            setIsFollowing(true);
          }
        }
      }

      if (profileData) {
        // Fetch follower/following counts
        await fetchFollowCounts(profileData.id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [routeUsername, fetchFollowCounts, router]);

  const fetchPostsData = useCallback(async (userId: string, currentViewerId: string | null, authorProfile: Profile | null, specificPostIds?: string[]) => {
    if (!authorProfile) return [];
    try {
      let postsQuery = supabase.from("posts").select("*").eq("archived", false).order("created_at", { ascending: false });
      if (specificPostIds) {
        if (specificPostIds.length === 0) return [];
        postsQuery = postsQuery.in("id", specificPostIds);
      } else {
        postsQuery = postsQuery.eq("user_id", userId);
      }
      
      const { data: postsData, error: postsError } = await postsQuery;

      if (postsError) {
        console.error("[ProfilePage] Posts query error:", postsError);
        throw postsError;
      }

      if (!postsData || postsData.length === 0) {
        return [];
      }

      const postIds = postsData.map((post) => post.id);
      const userIds = new Set(postsData.map(p => p.user_id));

      const sharedPostIds = postsData.filter(p => p.type === "repost" && p.shared_post_id).map(p => p.shared_post_id);
      let sharedPostsData: any[] = [];
      if (sharedPostIds.length > 0) {
        const { data: spData } = await supabase.from('posts').select('*').in('id', sharedPostIds);
        if (spData) {
          sharedPostsData = spData;
          spData.forEach(p => userIds.add(p.user_id));
        }
      }

      // Fetch all needed profiles (author + any original post authors)
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline, username")
        .in("id", Array.from(userIds));

      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      let likesData: any[] = [];
      if (postIds.length > 0) {
        const { data: fetchLikesData, error: likesError } = await supabase
          .from("likes")
          .select("post_id, user_id")
          .in("post_id", postIds);

        if (!likesError) {
          likesData = fetchLikesData || [];
        }
      }

      let commentsData: any[] = [];
      if (postIds.length > 0) {
        const { data: fetchCommentsData, error: commentsError } = await supabase
          .from("comments")
          .select("post_id")
          .in("post_id", postIds);

        if (!commentsError) {
          commentsData = fetchCommentsData || [];
        }
      }

      let myRepostsData: any[] = [];
      if (postIds.length > 0 && currentViewerId) {
        const targetPostIds = postsData.map(p => p.type === "repost" && p.shared_post_id ? p.shared_post_id : p.id);
        const { data: fetchRepostsData, error: repostsError } = await supabase
          .from("posts")
          .select("shared_post_id")
          .eq("type", "repost")
          .eq("user_id", currentViewerId)
          .in("shared_post_id", targetPostIds);
        
        if (!repostsError) {
          myRepostsData = fetchRepostsData || [];
        }
      }

      let savedPostsData: any[] = [];
      if (postIds.length > 0 && currentViewerId) {
        const { data: fetchSavedData, error: savedError } = await supabase
          .from("saved_posts")
          .select("post_id, collection_id")
          .eq("user_id", currentViewerId)
          .in("post_id", postIds);
          
        if (!savedError) {
          savedPostsData = fetchSavedData || [];
        }
      }

      const sharedPostMap = new Map(sharedPostsData.map(p => [p.id, p]));

      const mergedPosts = postsData.map((post) => {
        const postLikes = likesData.filter((l) => l.post_id === post.id);
        const postComments = commentsData.filter((c) => c.post_id === post.id);
        const isLikedByMe = currentViewerId ? postLikes.some((l) => l.user_id === currentViewerId) : false;
        
        const targetPostId = post.type === "repost" && post.shared_post_id ? post.shared_post_id : post.id;
        const isRepostedByMe = myRepostsData.some((r) => r.shared_post_id === targetPostId);
        
        const outerProfile = profileMap.get(post.user_id) || authorProfile;

        const merged: Post = {
          ...post,
          profiles: {
            name: outerProfile.name,
            avatar_url: outerProfile.avatar_url || "",
            headline: outerProfile.headline || "",
            username: outerProfile.username,
          },
          likeCount: postLikes.length,
          commentCount: postComments.length,
          isLikedByMe,
          isRepostedByMe,
          savedCollectionIds: savedPostsData.filter(s => s.post_id === post.id).map(s => s.collection_id),
        };

        if (post.type === "repost" && post.shared_post_id) {
          const original = sharedPostMap.get(post.shared_post_id);
          if (original) {
            const opProfile = profileMap.get(original.user_id) || { name: 'Unknown', avatar_url: '', headline: '', username: undefined };
            merged.original_post = {
              ...original,
              profiles: {
                name: opProfile.name,
                avatar_url: opProfile.avatar_url || "",
                headline: opProfile.headline || "",
                username: opProfile.username,
              },
              likeCount: 0,
              commentCount: 0,
              isLikedByMe: false,
            };
          }
        }

        return merged;
      });

      return mergedPosts as Post[];
    } catch (err: any) {
      console.error("[ProfilePage] Posts fetch failed:", err.message);
      return [];
    }
  }, []);

  const loadProfilePosts = useCallback(async (userId: string, currentViewerId: string | null, authorProfile: Profile | null) => {
    setPostsLoading(true);
    const data = await fetchPostsData(userId, currentViewerId, authorProfile);
    setPosts(data);
    setPostsCount(data.filter(p => p.type !== "repost").length);
    setPostsLoading(false);
  }, [fetchPostsData]);

  useEffect(() => {
    if (!routeUsername) return;
    fetchProfileAndUser();
  }, [routeUsername, fetchProfileAndUser]);

  useEffect(() => {
    if (profile && !loading) {
      loadProfilePosts(profile.id, currentUserId, profile);
      fetchProfileStories(profile.id, currentUserId);
    }
  }, [profile, currentUserId, loading, loadProfilePosts, fetchProfileStories]);

  // Listen for custom events from Modals
  useEffect(() => {
    if (!profile) return;

    const handleRefresh = () => {
      loadProfilePosts(profile.id, currentUserId, profile);
    };

    window.addEventListener('postCreated', handleRefresh);
    window.addEventListener('postDeleted', handleRefresh);
    window.addEventListener('postUpdated', handleRefresh);
    
    return () => {
      window.removeEventListener('postCreated', handleRefresh);
      window.removeEventListener('postDeleted', handleRefresh);
      window.removeEventListener('postUpdated', handleRefresh);
    };
  }, [profile, currentUserId, loadProfilePosts]);

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
    if (!currentUserId || !profile || isOwner) return;
    setFollowLoading(true);
    
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .match({ follower_id: currentUserId, following_id: profile.id });

        if (error) throw error;

        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: currentUserId, following_id: profile.id });

        if (error) throw error;

        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
      }
    } catch (err: any) {
      console.error("[ProfilePage] Follow toggle error:", err);
      setFollowError("Failed to update follow status.");
      setTimeout(() => setFollowError(null), 3000);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err: any) {
      console.error("Sign out error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-8 bg-background text-body">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 border-b border-border pb-8">
            <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-gray-200 animate-pulse shrink-0" />
            <div className="flex-1 w-full space-y-4 text-center md:text-left">
              <div className="h-8 bg-gray-200 rounded w-48 mx-auto md:mx-0 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-64 mx-auto md:mx-0 animate-pulse" />
              <div className="h-10 bg-gray-200 rounded w-32 mx-auto md:mx-0 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-body">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 font-medium">
            {error ? `Error: ${error}` : "Profile not found"}
          </div>
          <Link href="/" className="inline-block text-sm text-accent hover:underline font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const hasStories = profileStories.length > 0;
  const allStoriesViewed = hasStories && profileStories.every((s) => viewedStoryIds.has(s.id));

  return (
    <div className="min-h-screen py-6 md:py-8 bg-background text-body">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        
        {/* Top Navbar Actions (Menu / Hamburger) */}
        <div className="flex justify-end relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-heading focus:outline-none"
            aria-label="Profile Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Menu Dropdown */}
          {menuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setMenuOpen(false)} 
              />
              <div className="absolute right-0 top-10 w-56 bg-surface border border-border shadow-xl rounded-2xl overflow-hidden z-50 py-2 animate-in fade-in zoom-in-95 duration-150">
                {isOwner ? (
                  <>
                    <Link
                      href="/activity"
                      onClick={() => setMenuOpen(false)}
                      className="w-full text-left px-4 py-2.5 text-sm text-heading hover:bg-gray-50 flex items-center gap-3 transition-colors font-medium"
                    >
                      <Activity className="w-4 h-4 text-gray-500" />
                      Your Activity
                    </Link>
                    <Link
                      href="/archive"
                      onClick={() => setMenuOpen(false)}
                      className="w-full text-left px-4 py-2.5 text-sm text-heading hover:bg-gray-50 flex items-center gap-3 transition-colors font-medium"
                    >
                      <Archive className="w-4 h-4 text-gray-500" />
                      Archive
                    </Link>

                    <div className="h-px bg-border my-1" />

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        alert("Settings coming soon!");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-heading hover:bg-gray-50 flex items-center gap-3 transition-colors font-medium"
                    >
                      <Settings className="w-4 h-4 text-gray-500" />
                      Settings
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setSwitchModalOpen(true);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-heading hover:bg-gray-50 flex items-center gap-3 transition-colors font-medium"
                    >
                      <Users className="w-4 h-4 text-gray-500" />
                      Switch Account
                    </button>

                    <div className="h-px bg-border my-1" />

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        handleSignOut();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        alert("Report user clicked");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors font-medium"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Report Profile
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* INSTAGRAM-STYLE HORIZONTAL PROFILE HEADER */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10 border-b border-border pb-8">
          
          {/* Left Column: Large Avatar */}
          <div className="shrink-0 relative">
            <button
              onClick={() => {
                if (hasStories) {
                  setStoryViewerOpen(true);
                } else if (profile.avatar_url) {
                  setAvatarViewerOpen(true);
                }
              }}
              className={`relative rounded-full p-1 transition-transform active:scale-95 focus:outline-none ${
                hasStories
                  ? allStoriesViewed
                    ? "bg-gray-300"
                    : "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500"
                  : ""
              }`}
              title={hasStories ? "Watch story" : "View photo"}
            >
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-surface bg-surface shadow-md">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-accent/10 text-accent font-bold text-4xl flex items-center justify-center">
                    {profile.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
            </button>
          </div>

          {/* Right Column: User Info & Actions */}
          <div className="flex-1 w-full space-y-4 text-center md:text-left">
            
            {/* Header Row: Name & Username */}
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold text-heading tracking-tight leading-none">
                  {profile.name}
                </h1>
                {profile.username && (
                  <p className="text-sm font-mono text-gray-500 mt-1">
                    @{profile.username}
                  </p>
                )}
              </div>
            </div>

            {/* Stats Row: Posts · Followers · Following */}
            <div className="flex items-center justify-center md:justify-start gap-8 pt-1 text-sm font-medium">
              <div className="text-center md:text-left">
                <span className="font-heading font-bold text-heading text-base mr-1.5">{postsCount}</span>
                <span className="text-body text-xs sm:text-sm">posts</span>
              </div>
              <button
                onClick={() => {
                  setFollowListType("followers");
                  setFollowListModalOpen(true);
                }}
                className="text-center md:text-left hover:opacity-75 transition-opacity focus:outline-none"
              >
                <span className="font-heading font-bold text-heading text-base mr-1.5">{followersCount}</span>
                <span className="text-body text-xs sm:text-sm">followers</span>
              </button>
              <button
                onClick={() => {
                  setFollowListType("following");
                  setFollowListModalOpen(true);
                }}
                className="text-center md:text-left hover:opacity-75 transition-opacity focus:outline-none"
              >
                <span className="font-heading font-bold text-heading text-base mr-1.5">{followingCount}</span>
                <span className="text-body text-xs sm:text-sm">following</span>
              </button>
            </div>

            {/* Bio / Details */}
            <div className="space-y-1.5 text-sm pt-1">
              {profile.headline && (
                <p className="font-mono text-xs font-semibold text-accent leading-relaxed">
                  {profile.headline}
                </p>
              )}
              {profile.organization && (
                <p className="text-xs text-body font-medium">
                  📍 {profile.organization}
                </p>
              )}
              {profile.bio && (
                <p className="text-sm text-heading leading-relaxed whitespace-pre-line max-w-xl">
                  {profile.bio}
                </p>
              )}

              {/* Skills Tags */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 pt-2">
                  {profile.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-2.5 py-0.5 rounded-full bg-accent/10 text-accent font-mono text-[11px] font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              {/* Social / External Links */}
              {(profile.github_url || profile.linkedin_url || profile.portfolio_url) && (
                <div className="flex items-center justify-center md:justify-start gap-4 pt-2 text-xs font-medium">
                  {profile.github_url && (
                    <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="text-body hover:text-accent transition-colors flex items-center gap-1">
                      <span>GitHub</span>
                    </a>
                  )}
                  {profile.linkedin_url && (
                    <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-body hover:text-accent transition-colors flex items-center gap-1">
                      <span>LinkedIn</span>
                    </a>
                  )}
                  {profile.portfolio_url && (
                    <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-body hover:text-accent transition-colors flex items-center gap-1">
                      <span>Portfolio</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* ACTION ROW: Edit Profile (Owner) OR Follow / Message (Visitor) */}
            <div className="pt-3">
              {followError && (
                <div className="mb-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                  {followError}
                </div>
              )}

              <div className="flex items-center gap-3">
                {isOwner ? (
                  <Link
                    href="/profile/edit"
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-surface border border-border shadow-sm text-heading hover:bg-gray-50 transition-colors text-sm font-semibold rounded-xl"
                  >
                    <Edit2 className="w-4 h-4 text-gray-500" />
                    <span>Edit Profile</span>
                  </Link>
                ) : currentUserId ? (
                  <>
                    <button
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 font-semibold text-sm rounded-xl transition-all shadow-sm ${
                        isFollowing
                          ? "bg-surface border border-border text-heading hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                          : "bg-accent text-white hover:bg-accent/90"
                      }`}
                    >
                      {followLoading ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : isFollowing ? (
                        "Following"
                      ) : (
                        "Follow"
                      )}
                    </button>
                    <button
                      onClick={() => alert("Messaging coming soon")}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-surface border border-border shadow-sm text-heading hover:bg-gray-50 transition-colors text-sm font-semibold rounded-xl"
                    >
                      <MessageCircle className="w-4 h-4 text-gray-500" />
                      <span>Message</span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Highlights Row */}
        <HighlightsRow
          profileId={profile.id}
          isOwner={isOwner}
          currentUserId={currentUserId}
          profileName={profile.name}
          profileAvatarUrl={profile.avatar_url || ""}
        />

        {/* Posts / Reposts Tabs */}
        <div className="pt-2">
          <div className="flex items-center justify-center gap-12 mb-6 border-b border-border pb-3">
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex items-center gap-2 font-heading font-bold text-xs tracking-wider uppercase transition-colors border-b-2 -mb-3.5 pb-3 ${
                activeTab === "posts"
                  ? "text-accent border-accent"
                  : "text-gray-400 border-transparent hover:text-gray-600"
              }`}
              title="Posts"
            >
              <Grid className="w-4.5 h-4.5" />
              <span>Posts</span>
            </button>
            <button
              onClick={() => setActiveTab("reposts")}
              className={`flex items-center gap-2 font-heading font-bold text-xs tracking-wider uppercase transition-colors border-b-2 -mb-3.5 pb-3 ${
                activeTab === "reposts"
                  ? "text-accent border-accent"
                  : "text-gray-400 border-transparent hover:text-gray-600"
              }`}
              title="Reposts"
            >
              <Repeat2 className="w-4.5 h-4.5" />
              <span>Reposts</span>
            </button>
          </div>
          
          {postsLoading ? (
            <PostGrid posts={[]} loading={true} currentUserId={currentUserId} />
          ) : (
            <>
              {activeTab === "posts" && posts.filter(p => p.type !== "repost").length === 0 && (
                <div className="text-center py-12 text-gray-500 font-medium bg-surface border border-border rounded-xl">
                  No posts yet
                </div>
              )}
              {activeTab === "reposts" && posts.filter(p => p.type === "repost").length === 0 && (
                <div className="text-center py-12 text-gray-500 font-medium bg-surface border border-border rounded-xl">
                  No reposts yet
                </div>
              )}
              {(activeTab === "posts" ? posts.filter(p => p.type !== "repost").length > 0 : posts.filter(p => p.type === "repost").length > 0) && (
                <PostGrid 
                  posts={posts.filter(p => activeTab === "posts" ? p.type !== "repost" : p.type === "repost")} 
                  loading={false} 
                  currentUserId={currentUserId} 
                />
              )}
            </>
          )}
        </div>

      </div>

      {/* Switch Account Modal */}
      {switchModalOpen && (
        <SwitchAccountModal
          isOpen={switchModalOpen}
          onClose={() => setSwitchModalOpen(false)}
          currentUserId={currentUserId}
        />
      )}

      {/* Follow / Followers List Modal */}
      {followListModalOpen && (
        <FollowListModal
          isOpen={followListModalOpen}
          onClose={() => setFollowListModalOpen(false)}
          profileId={profile.id}
          type={followListType}
          currentUserId={currentUserId}
          isOwner={isOwner}
        />
      )}

      {/* Story Viewer Modal */}
      {storyViewerOpen && (
        <StoryViewer
          groups={[
            {
              userId: profile.id,
              name: profile.name,
              avatar_url: profile.avatar_url || "",
              stories: profileStories,
            },
          ]}
          startGroupIndex={0}
          viewerId={currentUserId || ""}
          onClose={() => setStoryViewerOpen(false)}
          onStoryViewed={(storyId) => {
            setViewedStoryIds((prev) => new Set([...Array.from(prev), storyId]));
          }}
        />
      )}

      {/* Fullscreen Avatar Modal */}
      {avatarViewerOpen && profile.avatar_url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setAvatarViewerOpen(false)}
        >
          <div className="relative max-w-lg max-h-[80vh]">
            <img
              src={profile.avatar_url}
              alt={profile.name}
              className="w-full h-full object-contain rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setAvatarViewerOpen(false)}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/40 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
