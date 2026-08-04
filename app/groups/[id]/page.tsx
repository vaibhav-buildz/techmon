"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Group, GroupMember, GroupPost } from "@/lib/types";
import {
  Users2,
  Lock,
  Globe,
  UserCheck,
  UserPlus,
  LogOut,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Send,
  ShieldCheck,
  ArrowLeft,
  MessageSquare,
  Users,
  Code,
  AlertTriangle,
} from "lucide-react";

function timeAgo(dateString: string) {
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(Math.max(0, seconds)) + "s ago";
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params?.id as string;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"posts" | "members">("posts");
  const [joining, setJoining] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // New Post Form State
  const [postContent, setPostContent] = useState("");
  const [postMediaFile, setPostMediaFile] = useState<File | null>(null);
  const [postMediaUrl, setPostMediaUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploadingPostMedia, setUploadingPostMedia] = useState(false);

  const isMember = Boolean(group?.isMember);
  const isAdmin = group?.myRole === "admin" || group?.created_by === currentUserId;

  useEffect(() => {
    if (groupId) {
      fetchGroupDetails();
    }
  }, [groupId]);

  const fetchGroupDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch current user session
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      setCurrentUserId(userId);

      // 2. Fetch group info
      const { data: groupData, error: groupErr } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();

      if (groupErr) throw groupErr;

      // 3. Fetch group members & user profiles
      const { data: membersData, error: membersErr } = await supabase
        .from("group_members")
        .select("id, group_id, user_id, role, created_at")
        .eq("group_id", groupId);

      if (membersErr) {
        console.error("Error fetching group members:", membersErr);
      }

      // Fetch user profile data for members
      const memberUserIds = membersData?.map((m) => m.user_id) || [];
      let profileMap = new Map();
      
      if (memberUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, name, username, avatar_url, headline")
          .in("id", memberUserIds);

        profilesData?.forEach((p) => profileMap.set(p.id, p));
      }

      const formattedMembers: GroupMember[] = (membersData || []).map((m) => ({
        ...m,
        profile: profileMap.get(m.user_id),
      }));

      setMembers(formattedMembers);

      const myMembership = userId ? formattedMembers.find((m) => m.user_id === userId) : null;
      const isUserMember = Boolean(myMembership);
      const userRole = myMembership?.role || (groupData.created_by === userId ? "admin" : undefined);

      setGroup({
        ...groupData,
        memberCount: formattedMembers.length,
        isMember: isUserMember,
        myRole: userRole,
      });

      // 4. Fetch group posts if public OR user is a member
      if (!groupData.is_private || isUserMember) {
        fetchGroupPosts(groupId);
      }
    } catch (err) {
      console.error("Error fetching group details:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupPosts = async (gId: string) => {
    try {
      const { data: postsData, error: postsErr } = await supabase
        .from("group_posts")
        .select("*")
        .eq("group_id", gId)
        .order("created_at", { ascending: false });

      if (postsErr) throw postsErr;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      // Fetch profiles of post authors
      const authorIds = [...new Set(postsData.map((p) => p.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, username")
        .in("id", authorIds);

      const authorMap = new Map(profilesData?.map((p) => [p.id, p]));

      const formattedPosts: GroupPost[] = postsData.map((p) => ({
        ...p,
        profiles: authorMap.get(p.user_id),
      }));

      setPosts(formattedPosts);
    } catch (err) {
      console.error("Error fetching group posts:", err);
    }
  };

  const handleJoinOrLeave = async () => {
    if (!currentUserId || !group) {
      alert("Please log in to join groups.");
      return;
    }

    setJoining(true);
    try {
      if (isMember) {
        // Leave
        const { error } = await supabase
          .from("group_members")
          .delete()
          .match({ group_id: group.id, user_id: currentUserId });

        if (error) throw error;

        setGroup((prev) =>
          prev
            ? {
                ...prev,
                isMember: false,
                memberCount: Math.max(0, (prev.memberCount || 1) - 1),
                myRole: undefined,
              }
            : null
        );
        setMembers((prev) => prev.filter((m) => m.user_id !== currentUserId));
      } else {
        // Join
        const { error } = await supabase.from("group_members").insert({
          group_id: group.id,
          user_id: currentUserId,
          role: "member",
        });

        if (error) throw error;

        // Fetch user profile for new member
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("id, name, username, avatar_url, headline")
          .eq("id", currentUserId)
          .single();

        const newMember: GroupMember = {
          id: `${group.id}_${currentUserId}`,
          group_id: group.id,
          user_id: currentUserId,
          role: "member",
          created_at: new Date().toISOString(),
          profile: userProfile || undefined,
        };

        setGroup((prev) =>
          prev
            ? {
                ...prev,
                isMember: true,
                memberCount: (prev.memberCount || 0) + 1,
                myRole: "member",
              }
            : null
        );
        setMembers((prev) => [newMember, ...prev]);
        fetchGroupPosts(group.id);
      }
    } catch (err: any) {
      console.error("Error toggling group membership:", err);
      alert(err.message || "Failed to update membership");
    } finally {
      setJoining(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!confirm("Are you sure you want to remove this member from the group?")) return;

    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .match({ group_id: groupId, user_id: memberUserId });

      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
      setGroup((prev) => (prev ? { ...prev, memberCount: Math.max(0, (prev.memberCount || 1) - 1) } : null));
    } catch (err: any) {
      console.error("Error removing member:", err);
      alert(err.message || "Failed to remove member");
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm("Are you sure you want to delete this group? All posts and memberships will be permanently deleted.")) {
      return;
    }

    setDeletingGroup(true);
    try {
      const { error } = await supabase.from("groups").delete().eq("id", groupId);
      if (error) throw error;
      router.push("/groups");
    } catch (err: any) {
      console.error("Error deleting group:", err);
      alert(err.message || "Failed to delete group.");
      setDeletingGroup(false);
    }
  };

  const handlePostMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPostMediaFile(file);
    setUploadingPostMedia(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUserId}_${Date.now()}.${fileExt}`;
      const filePath = `group_posts/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("groups")
        .upload(filePath, file);

      if (uploadErr) {
        // Fallback base64
        const reader = new FileReader();
        reader.onloadend = () => {
          setPostMediaUrl(reader.result as string);
          setUploadingPostMedia(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("groups")
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setPostMediaUrl(publicUrlData.publicUrl);
      }
    } catch (err) {
      console.error("Error uploading post media:", err);
    } finally {
      setUploadingPostMedia(false);
    }
  };

  const handleCreateGroupPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() && !postMediaUrl) return;
    if (!currentUserId || !group) return;

    setPosting(true);
    try {
      const mediaType = postMediaFile?.type?.startsWith("video/") ? "video" : postMediaUrl ? "image" : undefined;
      const postType = mediaType ? "media" : "text";

      const { data: insertedPost, error: insertErr } = await supabase
        .from("group_posts")
        .insert({
          group_id: group.id,
          user_id: currentUserId,
          content: postContent.trim(),
          media_url: postMediaUrl || null,
          media_type: mediaType || null,
          type: postType,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Fetch author profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url, username")
        .eq("id", currentUserId)
        .single();

      const newGroupPost: GroupPost = {
        ...insertedPost,
        profiles: profile,
      };

      setPosts((prev) => [newGroupPost, ...prev]);
      setPostContent("");
      setPostMediaFile(null);
      setPostMediaUrl("");
    } catch (err: any) {
      console.error("Error creating group post:", err);
      alert(err.message || "Failed to publish post.");
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Delete this group post?")) return;

    try {
      const { error } = await supabase.from("group_posts").delete().eq("id", postId);
      if (error) throw error;
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      console.error("Error deleting group post:", err);
      alert(err.message || "Failed to delete post");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-heading flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
          <p className="font-mono text-xs text-muted uppercase tracking-wider">
            Loading community details...
          </p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background text-heading">
        <main className="max-w-4xl mx-auto px-4 pt-28 text-center py-20">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="font-serif text-2xl font-bold mb-2">Group Not Found</h1>
          <p className="text-muted text-sm mb-6">
            The group you are looking for does not exist or has been removed.
          </p>
          <Link
            href="/groups"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#DC2626] text-white rounded-xl font-mono text-xs uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Groups</span>
          </Link>
        </main>
      </div>
    );
  }

  const isRestrictedPrivate = group.is_private && !isMember;

  return (
    <div className="min-h-screen bg-background text-heading font-sans pb-20">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        {/* Back Link */}
        <div className="py-4">
          <Link
            href="/groups"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted hover:text-heading uppercase tracking-wider transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Groups</span>
          </Link>
        </div>

        {/* Group Hero / Banner Header */}
        <div className="relative rounded-2xl overflow-hidden border border-border bg-surface mb-8">
          {/* Cover Header */}
          <div className="h-44 sm:h-64 bg-gradient-to-r from-neutral-800 via-neutral-900 to-black relative">
            {group.cover_url ? (
              <img
                src={group.cover_url}
                alt={group.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-accent/25 via-surface to-background flex items-center justify-center">
                <Users2 className="w-20 h-20 text-muted/20 stroke-1" />
              </div>
            )}

            {/* Privacy Badge */}
            <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md text-white rounded-full text-xs font-mono tracking-wider flex items-center gap-1.5 border border-white/10">
              {group.is_private ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>PRIVATE GROUP</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PUBLIC GROUP</span>
                </>
              )}
            </div>
          </div>

          {/* Group Info Body */}
          <div className="p-6 sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-heading">
                  {group.name}
                </h1>
                
                {group.description && (
                  <p className="text-sm sm:text-base text-muted leading-relaxed">
                    {group.description}
                  </p>
                )}

                {/* Topic Tags & Stats */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-mono text-heading bg-background border border-border px-3 py-1 rounded-lg">
                    <Users2 className="w-3.5 h-3.5 text-accent" />
                    <span>{group.memberCount || 0} {group.memberCount === 1 ? "Member" : "Members"}</span>
                  </div>

                  {group.topic_tags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 bg-accent/10 border border-accent/20 text-accent font-mono text-xs rounded-lg"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 self-start shrink-0">
                {isAdmin && (
                  <button
                    onClick={handleDeleteGroup}
                    disabled={deletingGroup}
                    className="p-2.5 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded-xl transition-all"
                    title="Delete Group"
                  >
                    {deletingGroup ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}

                <button
                  onClick={handleJoinOrLeave}
                  disabled={joining}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-semibold uppercase tracking-wider transition-all shadow-xs active:scale-95 ${
                    isMember
                      ? "bg-surface border border-border text-heading hover:border-red-500/40 hover:text-red-500"
                      : "bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                  }`}
                >
                  {joining ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isMember ? (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span>Leave Group</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Join Group</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Private Restricted Gate */}
        {isRestrictedPrivate ? (
          <div className="py-16 px-6 bg-surface border border-border rounded-2xl text-center max-w-lg mx-auto space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-heading">
              This is a Private Group
            </h2>
            <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
              Only members can view group discussions, code dispatches, and participant rosters. Join the group to participate!
            </p>
            <button
              onClick={handleJoinOrLeave}
              disabled={joining}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#DC2626] text-white hover:bg-[#B91C1C] rounded-xl font-mono text-xs font-semibold uppercase tracking-wider transition-all shadow-xs"
            >
              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>Join Group to Unlock</span>
            </button>
          </div>
        ) : (
          /* Public or Member View: Tabs & Content */
          <div className="space-y-6">
            {/* Tabs Header */}
            <div className="flex items-center border-b border-border gap-6">
              <button
                onClick={() => setActiveTab("posts")}
                className={`pb-3.5 font-mono text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === "posts"
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-heading"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Discussions ({posts.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("members")}
                className={`pb-3.5 font-mono text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === "members"
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-heading"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Members ({members.length})</span>
              </button>
            </div>

            {/* Tab 1: Posts & Feed */}
            {activeTab === "posts" && (
              <div className="space-y-6">
                {/* Post Creator (Only for members) */}
                {isMember ? (
                  <form
                    onSubmit={handleCreateGroupPost}
                    className="p-5 bg-surface border border-border rounded-2xl space-y-4 shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center font-mono text-xs font-bold text-accent shrink-0">
                        P
                      </div>
                      <div className="flex-1">
                        <textarea
                          rows={3}
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                          placeholder={`Post an update or code snippet to ${group.name}...`}
                          className="w-full bg-background border border-border rounded-xl p-3.5 text-heading placeholder:text-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none"
                        />
                      </div>
                    </div>

                    {/* Post Media Preview */}
                    {postMediaUrl && (
                      <div className="relative max-h-56 rounded-xl overflow-hidden border border-border group ml-12">
                        {postMediaFile?.type?.startsWith("video/") ? (
                          <video src={postMediaUrl} controls className="w-full max-h-56 object-cover" />
                        ) : (
                          <img src={postMediaUrl} alt="Upload Preview" className="w-full max-h-56 object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPostMediaUrl("");
                            setPostMediaFile(null);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Form Controls */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/60 ml-12">
                      <label className="flex items-center gap-1.5 text-xs font-mono text-muted hover:text-heading cursor-pointer transition-colors">
                        <ImageIcon className="w-4 h-4 text-accent" />
                        <span>{uploadingPostMedia ? "Uploading..." : "Attach Media"}</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={handlePostMediaSelect}
                          disabled={uploadingPostMedia}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={posting || uploadingPostMedia || (!postContent.trim() && !postMediaUrl)}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-50 rounded-xl font-mono text-xs font-semibold uppercase tracking-wider transition-all shadow-2xs"
                      >
                        {posting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <span>Publish</span>
                            <Send className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-4 bg-surface/50 border border-border rounded-xl text-center text-xs font-mono text-muted">
                    Join this group to post updates and share with members.
                  </div>
                )}

                {/* Posts Feed List */}
                {posts.length === 0 ? (
                  <div className="py-12 px-4 text-center border border-dashed border-border rounded-2xl bg-surface/30">
                    <MessageSquare className="w-8 h-8 text-muted/40 mx-auto mb-2" />
                    <p className="font-serif text-lg font-bold text-heading">No posts in this group yet</p>
                    <p className="text-xs text-muted mt-1">Start the conversation by publishing the first update above!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => {
                      const isPostAuthor = currentUserId === post.user_id;

                      return (
                        <div
                          key={post.id}
                          className="p-5 bg-surface border border-border rounded-2xl space-y-3 shadow-2xs transition-all"
                        >
                          {/* Post Header */}
                          <div className="flex items-center justify-between">
                            <Link
                              href={post.profiles?.username ? `/profile/${post.profiles.username}` : "#"}
                              className="flex items-center gap-3 group"
                            >
                              {post.profiles?.avatar_url ? (
                                <img
                                  src={post.profiles.avatar_url}
                                  alt={post.profiles.name}
                                  className="w-10 h-10 rounded-full object-cover border border-border group-hover:border-accent transition-colors"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center font-mono text-xs font-bold text-heading">
                                  {post.profiles?.name?.charAt(0) || "U"}
                                </div>
                              )}

                              <div>
                                <h4 className="text-sm font-semibold text-heading group-hover:text-accent transition-colors">
                                  {post.profiles?.name || "Group Member"}
                                </h4>
                                <span className="text-[11px] font-mono text-muted">
                                  {timeAgo(post.created_at)}
                                </span>
                              </div>
                            </Link>

                            {(isPostAuthor || isAdmin) && (
                              <button
                                onClick={() => handleDeletePost(post.id)}
                                className="p-1.5 text-muted hover:text-red-500 rounded-lg hover:bg-background transition-colors"
                                title="Delete post"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* Post Content */}
                          {post.content && (
                            <p className="text-sm text-heading leading-relaxed whitespace-pre-wrap">
                              {post.content}
                            </p>
                          )}

                          {/* Post Media */}
                          {post.media_url && (
                            <div className="rounded-xl overflow-hidden border border-border max-h-96">
                              {post.media_type === "video" ? (
                                <video src={post.media_url} controls className="w-full max-h-96 object-cover" />
                              ) : (
                                <img src={post.media_url} alt="Group post media" className="w-full max-h-96 object-cover" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Members Roster */}
            {activeTab === "members" && (
              <div className="bg-surface border border-border rounded-2xl divide-y divide-border overflow-hidden">
                {members.map((m) => {
                  const isSelf = m.user_id === currentUserId;
                  const isMemberAdmin = m.role === "admin";

                  return (
                    <div
                      key={m.id}
                      className="p-4 flex items-center justify-between hover:bg-background/40 transition-colors"
                    >
                      <Link
                        href={m.profile?.username ? `/profile/${m.profile.username}` : "#"}
                        className="flex items-center gap-3 group"
                      >
                        {m.profile?.avatar_url ? (
                          <img
                            src={m.profile.avatar_url}
                            alt={m.profile.name}
                            className="w-10 h-10 rounded-full object-cover border border-border group-hover:border-accent transition-colors"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center font-mono text-xs font-bold text-heading">
                            {m.profile?.name?.charAt(0) || "U"}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-heading group-hover:text-accent transition-colors">
                              {m.profile?.name || "Techmon Builder"}
                            </span>

                            {isMemberAdmin && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 border border-accent/20 text-accent font-mono text-[10px] uppercase font-bold rounded">
                                <ShieldCheck className="w-3 h-3" />
                                Admin
                              </span>
                            )}
                          </div>

                          {m.profile?.headline && (
                            <p className="text-xs text-muted line-clamp-1">
                              {m.profile.headline}
                            </p>
                          )}
                        </div>
                      </Link>

                      {/* Admin Management Options */}
                      {isAdmin && !isSelf && (
                        <button
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded-lg font-mono text-xs transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
