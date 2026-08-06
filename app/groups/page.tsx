"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Group } from "@/lib/types";
import CreateGroupModal from "@/components/CreateGroupModal";
import { 
  Users2, 
  Plus, 
  Search, 
  Lock, 
  Globe, 
  UserCheck, 
  ArrowRight, 
  Loader2 
} from "lucide-react";

export default function GroupsPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"my_groups" | "discover">("discover");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  useEffect(() => {
    fetchUserAndGroups();
  }, []);

  const fetchUserAndGroups = async () => {
    setLoading(true);
    try {
      // 1. Get current session user
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      setCurrentUserId(userId);

      // 2. Fetch all groups
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (groupsError) throw groupsError;

      if (!groupsData || groupsData.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const groupIds = groupsData.map((g) => g.id);

      // 3. Fetch member counts via RPC and current user's memberships in parallel
      const [countsRes, myMembershipsRes] = await Promise.all([
        supabase.rpc("get_group_member_counts", { group_ids: groupIds }),
        userId
          ? supabase.from("group_members").select("group_id, role").eq("user_id", userId).in("group_id", groupIds)
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (countsRes.error) {
        console.error("Error fetching group member counts:", countsRes.error);
      }
      if (myMembershipsRes.error) {
        console.error("Error fetching user group memberships:", myMembershipsRes.error);
      }

      const countMap = new Map<string, number>();
      countsRes.data?.forEach((c: any) => {
        countMap.set(c.group_id, Number(c.member_count) || 0);
      });

      const myMembershipMap = new Map<string, "admin" | "moderator" | "member" | undefined>();
      myMembershipsRes.data?.forEach((m) => {
        myMembershipMap.set(m.group_id, m.role as "admin" | "moderator" | "member");
      });

      const formattedGroups: Group[] = groupsData.map((g) => {
        const isMember = myMembershipMap.has(g.id);
        const myRole = myMembershipMap.get(g.id);
        return {
          ...g,
          memberCount: countMap.get(g.id) || 0,
          isMember,
          myRole,
        };
      });

      setGroups(formattedGroups);

      // Default active tab to 'my_groups' if user has memberships
      const hasMyGroups = formattedGroups.some((g) => g.isMember);
      if (hasMyGroups) {
        setActiveTab("my_groups");
      } else {
        setActiveTab("discover");
      }
    } catch (err) {
      console.error("Error loading groups:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.MouseEvent, group: Group) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUserId) {
      alert("Please log in to join groups.");
      return;
    }

    setJoiningGroupId(group.id);
    try {
      if (group.isMember) {
        // Leave Group
        const { error } = await supabase
          .from("group_members")
          .delete()
          .match({ group_id: group.id, user_id: currentUserId });

        if (error) throw error;

        setGroups((prev) =>
          prev.map((g) =>
            g.id === group.id
              ? { ...g, isMember: false, memberCount: Math.max(0, (g.memberCount || 1) - 1), myRole: undefined }
              : g
          )
        );
      } else {
        // Join Group
        const { error } = await supabase
          .from("group_members")
          .insert({
            group_id: group.id,
            user_id: currentUserId,
            role: "member",
          });

        if (error) throw error;

        setGroups((prev) =>
          prev.map((g) =>
            g.id === group.id
              ? { ...g, isMember: true, memberCount: (g.memberCount || 0) + 1, myRole: "member" }
              : g
          )
        );
      }
    } catch (err: any) {
      console.error("Error toggling group membership:", err);
      alert(err.message || "Failed to update membership");
    } finally {
      setJoiningGroupId(null);
    }
  };

  const handleGroupCreated = (newGroup: Group) => {
    setGroups((prev) => [newGroup, ...prev]);
    setActiveTab("my_groups");
  };

  // Filter groups
  const filteredGroups = groups.filter((g) => {
    // Tab filter
    if (activeTab === "my_groups" && !g.isMember) return false;
    if (activeTab === "discover" && g.isMember) return false;

    // Search query filter (name or tags)
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = g.name.toLowerCase().includes(q);
    const descMatch = g.description?.toLowerCase().includes(q);
    const tagMatch = g.topic_tags?.some((t) => t.toLowerCase().includes(q));

    return nameMatch || descMatch || tagMatch;
  });

  const myGroupsCount = groups.filter((g) => g.isMember).length;
  const discoverGroupsCount = groups.filter((g) => !g.isMember && !g.is_private).length;

  return (
    <div className="min-h-screen bg-background text-heading font-sans pb-16">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24">
        {/* Header Banner / Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-accent font-mono text-xs mb-3">
              <Users2 className="w-3.5 h-3.5" />
              <span>BUILDER COMMUNITIES</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-heading">
              Techmon Groups
            </h1>
            <p className="mt-2 text-muted text-sm sm:text-base max-w-2xl font-sans">
              Connect with fellow developers, study specialized tech stacks, share code snippets, and collaborate in focused communities.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl font-mono text-xs font-semibold uppercase tracking-wider transition-all shadow-sm active:scale-95 self-start md:self-auto shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Group</span>
          </button>
        </div>

        {/* Search & Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-surface border border-border rounded-xl">
            <button
              onClick={() => setActiveTab("my_groups")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider font-semibold transition-all ${
                activeTab === "my_groups"
                  ? "bg-background text-heading shadow-xs border border-border/60"
                  : "text-muted hover:text-heading"
              }`}
            >
              <span>My Groups</span>
              <span className="px-1.5 py-0.2 bg-accent/10 text-accent rounded-full text-[10px]">
                {myGroupsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("discover")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider font-semibold transition-all ${
                activeTab === "discover"
                  ? "bg-background text-heading shadow-xs border border-border/60"
                  : "text-muted hover:text-heading"
              }`}
            >
              <span>Discover</span>
              <span className="px-1.5 py-0.2 bg-surface text-muted border border-border rounded-full text-[10px]">
                {discoverGroupsCount}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search groups by name or topic tag..."
              className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl text-heading placeholder:text-muted/60 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
            <p className="font-mono text-xs text-muted uppercase tracking-wider">
              Loading groups...
            </p>
          </div>
        ) : filteredGroups.length === 0 ? (
          /* Empty State */
          <div className="py-16 px-6 bg-surface/50 border border-dashed border-border rounded-2xl text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mx-auto mb-4">
              <Users2 className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-bold text-heading mb-2">
              {searchQuery ? "No matching groups" : activeTab === "my_groups" ? "No joined groups yet" : "No public groups available"}
            </h3>
            <p className="text-muted text-sm mb-6 max-w-xs mx-auto">
              {searchQuery
                ? `No groups matched your query "${searchQuery}". Try a different keyword or topic tag.`
                : activeTab === "my_groups"
                ? "You haven't joined any groups yet. Explore the Discover tab or create your own!"
                : "Be the pioneer and start the first community on Techmon!"}
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl font-mono text-xs font-semibold uppercase tracking-wider transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Group</span>
            </button>
          </div>
        ) : (
          /* Group Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="group flex flex-col bg-surface border border-border hover:border-heading/40 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              >
                {/* Cover Image or Gradient */}
                <div className="relative h-36 bg-gradient-to-r from-neutral-800 via-neutral-900 to-black overflow-hidden border-b border-border">
                  {group.cover_url ? (
                    <img
                      src={group.cover_url}
                      alt={group.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-surface to-background flex items-center justify-center">
                      <Users2 className="w-12 h-12 text-muted/30 stroke-1" />
                    </div>
                  )}

                  {/* Privacy Badge */}
                  <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-md text-white rounded-full text-[10px] font-mono tracking-wider flex items-center gap-1.5 border border-white/10">
                    {group.is_private ? (
                      <>
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>PRIVATE</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3 h-3 text-emerald-400" />
                        <span>PUBLIC</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex-1 p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-heading group-hover:text-accent transition-colors line-clamp-1">
                      {group.name}
                    </h2>
                    
                    <p className="text-xs text-muted mt-1.5 line-clamp-2 leading-relaxed">
                      {group.description || "No description provided."}
                    </p>
                  </div>

                  {/* Topic Tags */}
                  {group.topic_tags && group.topic_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {group.topic_tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-background border border-border text-muted rounded-md font-mono text-[10px]"
                        >
                          #{tag}
                        </span>
                      ))}
                      {group.topic_tags.length > 3 && (
                        <span className="px-1.5 py-0.5 text-muted font-mono text-[10px]">
                          +{group.topic_tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer Row: Member count & Action button */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/60">
                    <div className="text-xs font-mono text-muted flex items-center gap-1.5">
                      <Users2 className="w-3.5 h-3.5 text-accent" />
                      <span>
                        {group.memberCount || 0} {group.memberCount === 1 ? "member" : "members"}
                      </span>
                    </div>

                    {group.isMember ? (
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Member</span>
                      </span>
                    ) : (
                      <button
                        onClick={(e) => handleJoinGroup(e, group)}
                        disabled={joiningGroupId === group.id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#DC2626] text-white hover:bg-[#B91C1C] rounded-lg font-mono text-xs font-semibold uppercase tracking-wider transition-all shadow-2xs active:scale-95"
                      >
                        {joiningGroupId === group.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <span>Join</span>
                            <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      {currentUserId && (
        <CreateGroupModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          currentUserId={currentUserId}
          onGroupCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}
