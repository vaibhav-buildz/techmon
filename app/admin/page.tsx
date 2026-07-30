"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { UserProfile, ContentReport } from "@/lib/types";
import {
  Shield,
  Users,
  FileText,
  MessageSquare,
  AlertTriangle,
  Search,
  Ban,
  CheckCircle2,
  Eye,
  Trash2,
  XCircle,
  BarChart3,
  TrendingUp,
  RefreshCw,
  ArrowUpRight,
  UserCheck,
  Heart,
  ChevronRight
} from "lucide-react";

type TabType = "overview" | "users" | "reports" | "analytics";
type ReportFilter = "pending" | "dismissed" | "reviewed";

export default function AdminPage() {
  const router = useRouter();

  // Auth & Admin verification states
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Overview stats state
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    totalComments: 0,
    pendingReports: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Users tab state
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);

  // Reports tab state
  const [reportsList, setReportsList] = useState<ContentReport[]>([]);
  const [reportFilter, setReportFilter] = useState<ReportFilter>("pending");
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportActionLoading, setReportActionLoading] = useState<string | null>(null);

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<{
    usersPerDay: { date: string; label: string; count: number }[];
    postsPerDay: { date: string; label: string; count: number }[];
    topFollowedUsers: { id: string; name: string; username?: string; avatar_url?: string; followerCount: number }[];
    topLikedPosts: { id: string; content: string; authorName: string; likeCount: number }[];
  }>({
    usersPerDay: [],
    postsPerDay: [],
    topFollowedUsers: [],
    topLikedPosts: [],
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Verification Effect: Check if user is logged in & is_admin
  useEffect(() => {
    const verifyAdminStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push("/login");
          return;
        }

        setCurrentUserId(session.user.id);

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error || !profile?.is_admin) {
          console.warn("[AdminPage] Access denied: User is not an admin.");
          router.push("/");
          return;
        }

        setIsAdmin(true);
      } catch (err) {
        console.error("[AdminPage] Auth verification error:", err);
        router.push("/");
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyAdminStatus();
  }, [router]);

  // Fetch Overview Stats
  const fetchOverviewStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      // 1. Total Users
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // 2. Total Posts
      const { count: postsCount } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true });

      // 3. Total Comments
      const { count: commentsCount } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true });

      // 4. Pending Reports
      let reportsCount = 0;
      try {
        const { count } = await supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");
        reportsCount = count || 0;
      } catch (e) {
        // Table might not exist yet
        reportsCount = 0;
      }

      setStats({
        totalUsers: usersCount || 0,
        totalPosts: postsCount || 0,
        totalComments: commentsCount || 0,
        pendingReports: reportsCount,
      });
    } catch (err) {
      console.error("[AdminPage] Error fetching overview stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Users List
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      if (!profilesData) {
        setUsersList([]);
        return;
      }

      // Fetch posts counts and followers counts
      const { data: postsData } = await supabase.from("posts").select("user_id");
      const { data: followsData } = await supabase.from("follows").select("following_id");

      const postCountMap = new Map<string, number>();
      postsData?.forEach(p => {
        postCountMap.set(p.user_id, (postCountMap.get(p.user_id) || 0) + 1);
      });

      const followerCountMap = new Map<string, number>();
      followsData?.forEach(f => {
        followerCountMap.set(f.following_id, (followerCountMap.get(f.following_id) || 0) + 1);
      });

      const formattedUsers: UserProfile[] = profilesData.map((p: any) => ({
        id: p.id,
        name: p.name || "Unknown",
        username: p.username,
        avatar_url: p.avatar_url,
        headline: p.headline,
        created_at: p.created_at || p.updated_at,
        is_admin: p.is_admin || false,
        is_banned: p.is_banned || false,
        postCount: postCountMap.get(p.id) || 0,
        followerCount: followerCountMap.get(p.id) || 0,
      }));

      setUsersList(formattedUsers);
    } catch (err) {
      console.error("[AdminPage] Error fetching users:", err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Fetch Content Reports
  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const { data: reportsData, error: reportsError } = await supabase
        .from("reports")
        .select("*")
        .eq("status", reportFilter)
        .order("created_at", { ascending: false });

      if (reportsError || !reportsData) {
        setReportsList([]);
        setReportsLoading(false);
        return;
      }

      // Fetch reporters' profiles
      const reporterIds = Array.from(new Set(reportsData.map((r: any) => r.reporter_id).filter(Boolean)));
      let reporterMap = new Map();
      if (reporterIds.length > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("id, name, username, avatar_url")
          .in("id", reporterIds);
        if (profData) {
          reporterMap = new Map(profData.map((p) => [p.id, p]));
        }
      }

      // Fetch content previews
      const postIds = reportsData.filter((r: any) => r.target_type === "post").map((r: any) => r.target_id);
      const commentIds = reportsData.filter((r: any) => r.target_type === "comment").map((r: any) => r.target_id);

      let postMap = new Map();
      if (postIds.length > 0) {
        const { data: pData } = await supabase.from("posts").select("id, content").in("id", postIds);
        if (pData) postMap = new Map(pData.map((p) => [p.id, p.content]));
      }

      let commentMap = new Map();
      if (commentIds.length > 0) {
        const { data: cData } = await supabase.from("comments").select("id, content").in("id", commentIds);
        if (cData) commentMap = new Map(cData.map((c) => [c.id, c.content]));
      }

      const formattedReports: ContentReport[] = reportsData.map((r: any) => ({
        id: r.id,
        reporter_id: r.reporter_id,
        target_id: r.target_id,
        target_type: r.target_type,
        reason: r.reason || "No reason provided",
        status: r.status,
        created_at: r.created_at,
        reporter: reporterMap.get(r.reporter_id) || { name: "System User" },
        contentPreview:
          r.target_type === "post"
            ? postMap.get(r.target_id) || "[Post unavailable or deleted]"
            : commentMap.get(r.target_id) || "[Comment unavailable or deleted]",
      }));

      setReportsList(formattedReports);
    } catch (err) {
      console.error("[AdminPage] Error fetching reports:", err);
      setReportsList([]);
    } finally {
      setReportsLoading(false);
    }
  }, [reportFilter]);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const days = 7;
      const last7Days: { date: string; label: string; count: number }[] = [];

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
        last7Days.push({ date: dateStr, label: dayLabel, count: 0 });
      }

      // 1. Users per day
      const { data: allProfiles } = await supabase.from("profiles").select("created_at");
      const usersByDay = last7Days.map((d) => {
        const count = allProfiles?.filter((p: any) => {
          if (!p.created_at) return false;
          return p.created_at.startsWith(d.date);
        }).length || 0;
        return { ...d, count };
      });

      // 2. Posts per day
      const { data: allPosts } = await supabase.from("posts").select("created_at");
      const postsByDay = last7Days.map((d) => {
        const count = allPosts?.filter((p: any) => {
          if (!p.created_at) return false;
          return p.created_at.startsWith(d.date);
        }).length || 0;
        return { ...d, count };
      });

      // 3. Top-followed users (top 5)
      const { data: follows } = await supabase.from("follows").select("following_id");
      const followCounts: Record<string, number> = {};
      follows?.forEach((f: any) => {
        followCounts[f.following_id] = (followCounts[f.following_id] || 0) + 1;
      });

      const topFollowedIds = Object.entries(followCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      let topFollowedUsers: any[] = [];
      if (topFollowedIds.length > 0) {
        const { data: tfProfiles } = await supabase
          .from("profiles")
          .select("id, name, username, avatar_url")
          .in("id", topFollowedIds);

        if (tfProfiles) {
          topFollowedUsers = tfProfiles
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              username: p.username,
              avatar_url: p.avatar_url,
              followerCount: followCounts[p.id] || 0,
            }))
            .sort((a, b) => b.followerCount - a.followerCount);
        }
      }

      // 4. Most-liked posts (top 5)
      const { data: likes } = await supabase.from("likes").select("post_id");
      const likeCounts: Record<string, number> = {};
      likes?.forEach((l: any) => {
        likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
      });

      const topLikedIds = Object.entries(likeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      let topLikedPosts: any[] = [];
      if (topLikedIds.length > 0) {
        const { data: tlPosts } = await supabase
          .from("posts")
          .select("id, content, user_id, profiles(name)")
          .in("id", topLikedIds);

        if (tlPosts) {
          topLikedPosts = tlPosts
            .map((p: any) => ({
              id: p.id,
              content: p.content || "Media / Code Post",
              authorName: p.profiles?.name || "Unknown Author",
              likeCount: likeCounts[p.id] || 0,
            }))
            .sort((a, b) => b.likeCount - a.likeCount);
        }
      }

      setAnalyticsData({
        usersPerDay: usersByDay,
        postsPerDay: postsByDay,
        topFollowedUsers,
        topLikedPosts,
      });
    } catch (err) {
      console.error("[AdminPage] Error fetching analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Load data based on active tab
  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "overview") fetchOverviewStats();
    else if (activeTab === "users") fetchUsers();
    else if (activeTab === "reports") fetchReports();
    else if (activeTab === "analytics") fetchAnalytics();
  }, [isAdmin, activeTab, fetchOverviewStats, fetchUsers, fetchReports, fetchAnalytics]);

  // Action: Toggle Ban User
  const handleToggleBan = async (userId: string, currentBanned: boolean) => {
    setUserActionLoading(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_banned: !currentBanned })
        .eq("id", userId);

      if (error) throw error;

      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_banned: !currentBanned } : u))
      );
    } catch (err: any) {
      alert(`Failed to update ban status: ${err.message || "Unknown error"}`);
    } finally {
      setUserActionLoading(null);
    }
  };

  // Action: Dismiss Report
  const handleDismissReport = async (reportId: string) => {
    setReportActionLoading(reportId);
    try {
      const { error } = await supabase
        .from("reports")
        .update({ status: "dismissed" })
        .eq("id", reportId);

      if (error) throw error;

      setReportsList((prev) => prev.filter((r) => r.id !== reportId));
      setStats((prev) => ({ ...prev, pendingReports: Math.max(0, prev.pendingReports - 1) }));
    } catch (err: any) {
      alert(`Failed to dismiss report: ${err.message}`);
    } finally {
      setReportActionLoading(null);
    }
  };

  // Action: Delete Content & Mark Reviewed
  const handleDeleteContent = async (report: ContentReport) => {
    if (!window.confirm(`Are you sure you want to delete this reported ${report.target_type}?`)) {
      return;
    }

    setReportActionLoading(report.id);
    try {
      // 1. Delete target post or comment
      const table = report.target_type === "post" ? "posts" : "comments";
      const { error: deleteError } = await supabase.from(table).delete().eq("id", report.target_id);

      if (deleteError) throw deleteError;

      // 2. Mark report status as reviewed
      const { error: updateError } = await supabase
        .from("reports")
        .update({ status: "reviewed" })
        .eq("id", report.id);

      if (updateError) throw updateError;

      setReportsList((prev) => prev.filter((r) => r.id !== report.id));
      setStats((prev) => ({ ...prev, pendingReports: Math.max(0, prev.pendingReports - 1) }));
      alert(`Reported ${report.target_type} successfully deleted.`);
    } catch (err: any) {
      alert(`Error deleting content: ${err.message}`);
    } finally {
      setReportActionLoading(null);
    }
  };

  // Filtered Users List by Search Query
  const filteredUsers = usersList.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      u.id.toLowerCase().includes(q)
    );
  });

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-background pt-24 px-4 flex justify-center items-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-accent animate-spin" />
          <span className="font-mono text-xs uppercase tracking-wider text-muted">Authenticating Admin Session...</span>
        </div>
      </main>
    );
  }

  if (!isAdmin) return null;

  return (
    <main className="min-h-screen bg-background pb-16 pt-20 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto">
      {/* Top Header Banner */}
      <div className="border-b border-border pb-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-accent/10 text-accent font-mono text-[10px] uppercase font-bold tracking-widest border border-accent/20 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Restricted Area
            </span>
            <span className="font-mono text-xs text-muted">| Internal Platform Admin</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-heading tracking-tight">
            Admin Panel
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === "overview") fetchOverviewStats();
              else if (activeTab === "users") fetchUsers();
              else if (activeTab === "reports") fetchReports();
              else if (activeTab === "analytics") fetchAnalytics();
            }}
            className="px-3.5 py-2 bg-surface border border-border hover:border-heading text-heading font-mono text-xs uppercase tracking-wider flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted" />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Main Tab Navigation Header */}
      <div className="flex border-b border-border mb-8 overflow-x-auto no-scrollbar">
        {[
          { key: "overview", label: "Overview", icon: BarChart3 },
          { key: "users", label: "Users", icon: Users, badge: usersList.length > 0 ? usersList.length : undefined },
          {
            key: "reports",
            label: "Content Reports",
            icon: AlertTriangle,
            badge: stats.pendingReports > 0 ? stats.pendingReports : undefined,
            badgeColor: "bg-red-500 text-white",
          },
          { key: "analytics", label: "Analytics", icon: TrendingUp },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as TabType)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-mono text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? "border-accent text-accent bg-accent/5"
                  : "border-transparent text-muted hover:text-heading hover:border-border"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span
                  className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-sans font-bold ${
                    t.badgeColor ? t.badgeColor : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface border border-border p-5 flex flex-col justify-between space-y-4 shadow-2xs hover:border-heading/40 transition-colors">
              <div className="flex items-center justify-between text-muted">
                <span className="font-mono text-xs uppercase tracking-wider font-bold">Total Users</span>
                <Users className="w-5 h-5 text-accent" />
              </div>
              <div className="text-3xl font-heading font-bold text-heading">
                {statsLoading ? "..." : stats.totalUsers.toLocaleString()}
              </div>
              <div className="text-xs text-muted font-mono">Registered accounts on Techmon</div>
            </div>

            <div className="bg-surface border border-border p-5 flex flex-col justify-between space-y-4 shadow-2xs hover:border-heading/40 transition-colors">
              <div className="flex items-center justify-between text-muted">
                <span className="font-mono text-xs uppercase tracking-wider font-bold">Total Posts</span>
                <FileText className="w-5 h-5 text-accent" />
              </div>
              <div className="text-3xl font-heading font-bold text-heading">
                {statsLoading ? "..." : stats.totalPosts.toLocaleString()}
              </div>
              <div className="text-xs text-muted font-mono">Published articles & dispatches</div>
            </div>

            <div className="bg-surface border border-border p-5 flex flex-col justify-between space-y-4 shadow-2xs hover:border-heading/40 transition-colors">
              <div className="flex items-center justify-between text-muted">
                <span className="font-mono text-xs uppercase tracking-wider font-bold">Total Comments</span>
                <MessageSquare className="w-5 h-5 text-accent" />
              </div>
              <div className="text-3xl font-heading font-bold text-heading">
                {statsLoading ? "..." : stats.totalComments.toLocaleString()}
              </div>
              <div className="text-xs text-muted font-mono">Community discussion replies</div>
            </div>

            <div className="bg-surface border border-border p-5 flex flex-col justify-between space-y-4 shadow-2xs hover:border-heading/40 transition-colors">
              <div className="flex items-center justify-between text-muted">
                <span className="font-mono text-xs uppercase tracking-wider font-bold text-red-600">Pending Reports</span>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-3xl font-heading font-bold text-red-600">
                {statsLoading ? "..." : stats.pendingReports.toLocaleString()}
              </div>
              <div className="text-xs text-muted font-mono">Reported items requiring moderation</div>
            </div>
          </div>

          {/* Quick Shortcuts & Admin Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface border border-border p-6 space-y-4">
              <h2 className="font-heading font-bold text-lg text-heading border-b border-border pb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" />
                Moderation Shortcuts
              </h2>
              <p className="text-sm text-body">
                Quickly review content flags, manage user permissions, or inspect engagement metrics.
              </p>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => setActiveTab("reports")}
                  className="flex items-center justify-between p-3 bg-background border border-border hover:border-accent group transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <div>
                      <div className="text-xs font-mono font-bold uppercase text-heading group-hover:text-accent">
                        Review Pending Reports ({stats.pendingReports})
                      </div>
                      <div className="text-[11px] text-muted">Dismiss or remove reported posts and comments</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  onClick={() => setActiveTab("users")}
                  className="flex items-center justify-between p-3 bg-background border border-border hover:border-accent group transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-accent" />
                    <div>
                      <div className="text-xs font-mono font-bold uppercase text-heading group-hover:text-accent">
                        User Account Directory
                      </div>
                      <div className="text-[11px] text-muted">Search, ban, or inspect registered user accounts</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </div>

            <div className="bg-surface border border-border p-6 space-y-4">
              <h2 className="font-heading font-bold text-lg text-heading border-b border-border pb-3">
                System Guidelines
              </h2>
              <div className="space-y-3 text-xs text-body leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <p>
                    <strong className="text-heading">User Moderation:</strong> Banning a user sets their{" "}
                    <code className="font-mono text-accent">is_banned</code> flag to true in the profiles table.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <p>
                    <strong className="text-heading">Content Removal:</strong> Deleting reported content permanently removes the target post/comment from Supabase.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <p>
                    <strong className="text-heading">Audit Trails:</strong> Reports are marked as either{" "}
                    <code className="font-mono text-muted">dismissed</code> or{" "}
                    <code className="font-mono text-accent">reviewed</code> for transparency.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS */}
      {activeTab === "users" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Search & Filter Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface border border-border p-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search user name or @username..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-background border border-border focus:border-accent px-9 py-2 text-xs font-mono text-heading focus:outline-none"
              />
            </div>
            <div className="text-xs font-mono text-muted">
              Showing <strong className="text-heading">{filteredUsers.length}</strong> of {usersList.length} users
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-surface border border-border overflow-x-auto">
            {usersLoading ? (
              <div className="p-12 text-center text-xs font-mono text-muted flex justify-center items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-accent" /> Loading User Directory...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-xs font-mono text-muted">
                No users found matching query "{userSearchQuery}"
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-background/50 text-[11px] font-mono uppercase tracking-wider text-muted">
                    <th className="py-3 px-4 font-bold">User Profile</th>
                    <th className="py-3 px-4 font-bold">Joined</th>
                    <th className="py-3 px-4 font-bold text-center">Posts</th>
                    <th className="py-3 px-4 font-bold text-center">Followers</th>
                    <th className="py-3 px-4 font-bold text-center">Status</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {filteredUsers.map((u) => {
                    const isBanned = u.is_banned;
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                        {/* Avatar & Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden border border-border shrink-0 bg-background flex items-center justify-center font-bold text-heading font-mono text-xs">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                u.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-heading flex items-center gap-1.5">
                                {u.name}
                                {u.is_admin && (
                                  <span className="px-1.5 py-0.2 bg-accent/10 text-accent font-mono text-[9px] uppercase border border-accent/20">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted font-mono">
                                {u.username ? `@${u.username}` : u.id.slice(0, 8)}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Joined Date */}
                        <td className="py-3 px-4 font-mono text-[11px] text-muted whitespace-nowrap">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                        </td>

                        {/* Post Count */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-heading">
                          {u.postCount}
                        </td>

                        {/* Follower Count */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-heading">
                          {u.followerCount}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4 text-center">
                          {isBanned ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 font-mono text-[10px] font-bold uppercase rounded-none border border-red-200">
                              <Ban className="w-3 h-3" /> Banned
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold uppercase rounded-none border border-emerald-200">
                              <UserCheck className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          {u.username && (
                            <Link
                              href={`/profile/${u.username}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface border border-border hover:border-heading text-heading font-mono text-[11px] uppercase transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-muted" /> View
                            </Link>
                          )}

                          <button
                            onClick={() => handleToggleBan(u.id, isBanned || false)}
                            disabled={userActionLoading === u.id || u.id === currentUserId}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 font-mono text-[11px] uppercase border transition-colors ${
                              isBanned
                                ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                                : "bg-red-50 text-red-700 border-red-200 hover:bg-red-600 hover:text-white"
                            } ${u.id === currentUserId ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            {userActionLoading === u.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : isBanned ? (
                              "Unban"
                            ) : (
                              "Ban"
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CONTENT REPORTS */}
      {activeTab === "reports" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Filter Bar */}
          <div className="flex items-center justify-between bg-surface border border-border p-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-muted mr-2">Filter Status:</span>
              {(["pending", "dismissed", "reviewed"] as ReportFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setReportFilter(f)}
                  className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                    reportFilter === f
                      ? "bg-accent text-white font-bold"
                      : "bg-background border border-border text-muted hover:text-heading"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="text-xs font-mono text-muted">
              Showing <strong className="text-heading">{reportsList.length}</strong> reports
            </div>
          </div>

          {/* Reports List */}
          {reportsLoading ? (
            <div className="p-12 text-center text-xs font-mono text-muted flex justify-center items-center gap-2 bg-surface border border-border">
              <RefreshCw className="w-4 h-4 animate-spin text-accent" /> Loading Content Reports...
            </div>
          ) : reportsList.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-muted bg-surface border border-border space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div>No {reportFilter} content reports found.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {reportsList.map((r) => (
                <div
                  key={r.id}
                  className="bg-surface border border-border p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-heading/40 transition-colors"
                >
                  {/* Left Report Details */}
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 font-mono text-[10px] uppercase font-bold">
                        {r.target_type} Report
                      </span>
                      <span className="font-mono text-xs text-muted">
                        Reported by <strong className="text-heading">{r.reporter?.name || "Anonymous"}</strong>
                      </span>
                      <span className="text-muted">•</span>
                      <span className="font-mono text-xs text-muted">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-mono text-muted uppercase font-bold mb-1">Reason:</div>
                      <div className="text-sm font-sans text-heading font-medium bg-background p-2.5 border border-border border-l-2 border-l-red-500">
                        "{r.reason}"
                      </div>
                    </div>

                    {/* Preview of Reported Content */}
                    <div>
                      <div className="text-[11px] font-mono text-muted uppercase font-bold mb-1">
                        Reported Content Preview ({r.target_type}):
                      </div>
                      <div className="text-xs font-mono text-muted italic bg-background p-3 border border-border rounded-none line-clamp-3">
                        {r.contentPreview}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex md:flex-col items-center justify-end gap-2 shrink-0 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                    {r.target_type === "post" && (
                      <Link
                        href={`/post/${r.target_id}`}
                        target="_blank"
                        className="w-full px-3 py-2 bg-background border border-border hover:border-heading text-heading font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-muted" /> View Post
                      </Link>
                    )}

                    {r.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleDismissReport(r.id)}
                          disabled={reportActionLoading === r.id}
                          className="w-full px-3 py-2 bg-background border border-border hover:bg-gray-100 text-body font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5 text-muted" /> Dismiss
                        </button>

                        <button
                          onClick={() => handleDeleteContent(r)}
                          disabled={reportActionLoading === r.id}
                          className="w-full px-3 py-2 bg-red-600 text-white hover:bg-red-700 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Content
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {analyticsLoading ? (
            <div className="p-12 text-center text-xs font-mono text-muted flex justify-center items-center gap-2 bg-surface border border-border">
              <RefreshCw className="w-4 h-4 animate-spin text-accent" /> Calculating Platform Analytics...
            </div>
          ) : (
            <>
              {/* Daily Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. New Users Per Day */}
                <div className="bg-surface border border-border p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h2 className="font-heading font-bold text-lg text-heading">New Users (Last 7 Days)</h2>
                    <Users className="w-4 h-4 text-accent" />
                  </div>

                  <div className="h-48 flex items-end justify-between gap-2 pt-6">
                    {analyticsData.usersPerDay.map((item, idx) => {
                      const maxCount = Math.max(1, ...analyticsData.usersPerDay.map((d) => d.count));
                      const heightPercent = Math.round((item.count / maxCount) * 100);
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                          <div className="text-[10px] font-mono font-bold text-heading opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.count}
                          </div>
                          <div
                            style={{ height: `${Math.max(8, heightPercent)}%` }}
                            className="w-full bg-accent/80 group-hover:bg-accent transition-all duration-300 rounded-none"
                          />
                          <div className="text-[10px] font-mono text-muted uppercase text-center">{item.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Posts Created Per Day */}
                <div className="bg-surface border border-border p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h2 className="font-heading font-bold text-lg text-heading">Posts Created (Last 7 Days)</h2>
                    <FileText className="w-4 h-4 text-accent" />
                  </div>

                  <div className="h-48 flex items-end justify-between gap-2 pt-6">
                    {analyticsData.postsPerDay.map((item, idx) => {
                      const maxCount = Math.max(1, ...analyticsData.postsPerDay.map((d) => d.count));
                      const heightPercent = Math.round((item.count / maxCount) * 100);
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                          <div className="text-[10px] font-mono font-bold text-heading opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.count}
                          </div>
                          <div
                            style={{ height: `${Math.max(8, heightPercent)}%` }}
                            className="w-full bg-heading/80 group-hover:bg-heading transition-all duration-300 rounded-none"
                          />
                          <div className="text-[10px] font-mono text-muted uppercase text-center">{item.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Leaderboards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Most Followed Users (Top 5) */}
                <div className="bg-surface border border-border p-6 space-y-4">
                  <h2 className="font-heading font-bold text-lg text-heading border-b border-border pb-3 flex items-center justify-between">
                    <span>Most-Followed Users</span>
                    <span className="font-mono text-xs text-muted uppercase font-normal">Top 5</span>
                  </h2>

                  {analyticsData.topFollowedUsers.length === 0 ? (
                    <div className="text-xs font-mono text-muted p-4 text-center">No follower data available yet.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {analyticsData.topFollowedUsers.map((u, i) => (
                        <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold text-accent w-4">#{i + 1}</span>
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-border shrink-0 bg-background flex items-center justify-center font-bold font-mono text-xs text-heading">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                u.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-heading">{u.name}</div>
                              <div className="text-[10px] font-mono text-muted">
                                {u.username ? `@${u.username}` : u.id.slice(0, 6)}
                              </div>
                            </div>
                          </div>

                          <div className="text-xs font-mono font-bold text-heading bg-background px-2.5 py-1 border border-border">
                            {u.followerCount} followers
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Most Liked Posts (Top 5) */}
                <div className="bg-surface border border-border p-6 space-y-4">
                  <h2 className="font-heading font-bold text-lg text-heading border-b border-border pb-3 flex items-center justify-between">
                    <span>Most-Liked Posts</span>
                    <span className="font-mono text-xs text-muted uppercase font-normal">Top 5</span>
                  </h2>

                  {analyticsData.topLikedPosts.length === 0 ? (
                    <div className="text-xs font-mono text-muted p-4 text-center">No likes recorded yet.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {analyticsData.topLikedPosts.map((p, i) => (
                        <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="flex items-start gap-3 overflow-hidden">
                            <span className="font-mono text-xs font-bold text-accent w-4 mt-0.5">#{i + 1}</span>
                            <div className="overflow-hidden">
                              <div className="font-mono text-[10px] uppercase text-muted font-bold">
                                By {p.authorName}
                              </div>
                              <div className="text-xs text-heading font-medium truncate max-w-xs">
                                {p.content}
                              </div>
                            </div>
                          </div>

                          <div className="text-xs font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 shrink-0 flex items-center gap-1">
                            <Heart className="w-3 h-3 fill-red-600" /> {p.likeCount}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
