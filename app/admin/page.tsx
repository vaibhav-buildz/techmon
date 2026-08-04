"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { UserProfile, ContentReport, Post } from "@/lib/types";
import {
  Shield,
  Users,
  FileText,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  Search,
  Ban,
  Eye,
  UserCheck,
  Trash2,
  XCircle,
  Filter,
  Heart,
  MessageCircle,
  ExternalLink,
  TrendingUp,
  UserPlus,
  BarChart3,
} from "lucide-react";

/* ════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════ */
type Tab = "overview" | "users" | "posts" | "reports";
type PostFilter = "all" | "note" | "media" | "repost" | "text" | "code";
type ReportFilter = "pending" | "dismissed" | "reviewed";

/* ════════════════════════════════════════════════════════
   ADMIN PAGE
   ════════════════════════════════════════════════════════ */
export default function AdminPage() {
  const router = useRouter();

  /* ── auth ─────────────────────────────────── */
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [myId, setMyId] = useState("");

  /* ── tab ──────────────────────────────────── */
  const [tab, setTab] = useState<Tab>("overview");

  /* ── overview ─────────────────────────────── */
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0, users7d: 0, posts7d: 0, reports: 0 });
  const statsOk = useRef(false);
  const [statsLoading, setStatsLoading] = useState(false);

  /* ── users ────────────────────────────────── */
  const [users, setUsers] = useState<UserProfile[]>([]);
  const usersOk = useRef(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");

  /* ── posts ────────────────────────────────── */
  const [posts, setPosts] = useState<Post[]>([]);
  const postsOk = useRef(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [pf, setPf] = useState<PostFilter>("all");
  const lastPf = useRef<PostFilter>("all");
  const [postBusy, setPostBusy] = useState("");

  /* ── reports ──────────────────────────────── */
  const [reports, setReports] = useState<ContentReport[]>([]);
  const reportsOk = useRef(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [rf, setRf] = useState<ReportFilter>("pending");
  const lastRf = useRef<ReportFilter>("pending");
  const [reportBusy, setReportBusy] = useState("");

  /* ═══════════════════════════════════════════
     AUTH — runs once
     ═══════════════════════════════════════════ */
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/login"); return; }
      setMyId(session.user.id);
      const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle();
      if (!p?.is_admin) { router.push("/"); return; }
      setAdmin(true);
      setReady(true);
    })();
  }, [router]);

  /* ═══════════════════════════════════════════
     FETCHERS
     ═══════════════════════════════════════════ */
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const d7 = new Date(Date.now() - 7 * 864e5).toISOString();
    const [a, b, c, d, e, f] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", d7),
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }).gte("created_at", d7),
      supabase.from("comments").select("*", { count: "exact", head: true }),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setStats({ users: a.count || 0, users7d: b.count || 0, posts: c.count || 0, posts7d: d.count || 0, comments: e.count || 0, reports: f.count || 0 });
    statsOk.current = true;
    setStatsLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const { data: pr } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (!pr) { setUsers([]); setUsersLoading(false); usersOk.current = true; return; }
    const [{ data: pd }, { data: fd }] = await Promise.all([
      supabase.from("posts").select("user_id"),
      supabase.from("follows").select("following_id"),
    ]);
    const pc = new Map<string, number>(); pd?.forEach(x => pc.set(x.user_id, (pc.get(x.user_id) || 0) + 1));
    const fc = new Map<string, number>(); fd?.forEach(x => fc.set(x.following_id, (fc.get(x.following_id) || 0) + 1));
    setUsers(pr.map((u: any) => ({
      id: u.id, name: u.name || "Unknown", username: u.username, avatar_url: u.avatar_url,
      headline: u.headline, email: u.email, created_at: u.created_at,
      is_admin: !!u.is_admin, is_banned: !!u.is_banned,
      postCount: pc.get(u.id) || 0, followerCount: fc.get(u.id) || 0,
    })));
    usersOk.current = true;
    setUsersLoading(false);
  }, []);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    let query = supabase.from("posts").select("*").order("created_at", { ascending: false });
    if (pf !== "all") query = query.eq("type", pf);
    const { data: raw } = await query;
    if (!raw?.length) { setPosts([]); postsOk.current = true; setPostsLoading(false); return; }
    const aids = [...new Set(raw.map((r: any) => r.user_id).filter(Boolean))];
    const pm = new Map();
    if (aids.length) { const { data } = await supabase.from("profiles").select("id,name,avatar_url,headline,username").in("id", aids); data?.forEach((p: any) => pm.set(p.id, p)); }
    const ids = raw.map((r: any) => r.id);
    const [{ data: ld }, { data: cd }] = await Promise.all([
      supabase.from("likes").select("post_id").in("post_id", ids),
      supabase.from("comments").select("post_id").in("post_id", ids),
    ]);
    const lm = new Map<string, number>(); ld?.forEach((x: any) => lm.set(x.post_id, (lm.get(x.post_id) || 0) + 1));
    const cm = new Map<string, number>(); cd?.forEach((x: any) => cm.set(x.post_id, (cm.get(x.post_id) || 0) + 1));
    setPosts(raw.map((p: any) => ({
      id: p.id, user_id: p.user_id, type: p.type || "text", content: p.content || "",
      background: p.background, code_lang: p.code_lang, media_url: p.media_url,
      media_type: p.media_type, created_at: p.created_at, archived: !!p.archived,
      likeCount: lm.get(p.id) || 0, commentCount: cm.get(p.id) || 0, isLikedByMe: false,
      profiles: pm.get(p.user_id) || { name: "Unknown", avatar_url: "", headline: "" },
    })));
    postsOk.current = true;
    setPostsLoading(false);
  }, [pf]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    const { data: raw } = await supabase.from("reports").select("*").eq("status", rf).order("created_at", { ascending: false });
    if (!raw?.length) { setReports([]); reportsOk.current = true; setReportsLoading(false); return; }
    const rIds = [...new Set(raw.map((r: any) => r.reporter_id).filter(Boolean))];
    const rm = new Map();
    if (rIds.length) { const { data } = await supabase.from("profiles").select("id,name,username,avatar_url").in("id", rIds); data?.forEach((p: any) => rm.set(p.id, p)); }
    const postIds = raw.filter((r: any) => r.target_type === "post").map((r: any) => r.target_id);
    const commIds = raw.filter((r: any) => r.target_type === "comment").map((r: any) => r.target_id);
    const pMap = new Map(); const cMap = new Map();
    if (postIds.length) { const { data } = await supabase.from("posts").select("id,content").in("id", postIds); data?.forEach((p: any) => pMap.set(p.id, p.content)); }
    if (commIds.length) { const { data } = await supabase.from("comments").select("id,content").in("id", commIds); data?.forEach((c: any) => cMap.set(c.id, c.content)); }
    setReports(raw.map((r: any) => ({
      id: r.id, reporter_id: r.reporter_id, target_id: r.target_id, target_type: r.target_type,
      reason: r.reason || "No reason", status: r.status, created_at: r.created_at,
      reporter: rm.get(r.reporter_id) || { name: "System" },
      contentPreview: r.target_type === "post" ? pMap.get(r.target_id) || "[Deleted]" : cMap.get(r.target_id) || "[Deleted]",
    })));
    reportsOk.current = true;
    setReportsLoading(false);
  }, [rf]);

  /* ═══════════════════════════════════════════
     LAZY LOAD ON TAB
     ═══════════════════════════════════════════ */
  useEffect(() => {
    if (!admin) return;
    if (tab === "overview" && !statsOk.current) loadStats();
    if (tab === "users" && !usersOk.current) loadUsers();
    if (tab === "posts" && !postsOk.current) loadPosts();
    if (tab === "reports" && !reportsOk.current) loadReports();
  }, [admin, tab, loadStats, loadUsers, loadPosts, loadReports]);

  // post filter change
  useEffect(() => {
    if (tab === "posts" && pf !== lastPf.current) { lastPf.current = pf; postsOk.current = false; loadPosts(); }
  }, [tab, pf, loadPosts]);

  // report filter change
  useEffect(() => {
    if (tab === "reports" && rf !== lastRf.current) { lastRf.current = rf; reportsOk.current = false; loadReports(); }
  }, [tab, rf, loadReports]);

  /* ═══════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════ */
  const toggleBan = async (id: string, ban: boolean) => {
    if (id === myId) return alert("Can't modify yourself.");
    if (!confirm(ban ? "Unban this user?" : "Ban this user?")) return;
    setBusy(id);
    await supabase.from("profiles").update({ is_banned: !ban }).eq("id", id);
    setUsers(p => p.map(u => u.id === id ? { ...u, is_banned: !ban } : u));
    setBusy("");
  };

  const toggleAdminRole = async (id: string, isAdm: boolean) => {
    if (id === myId) return alert("Can't modify yourself.");
    if (!confirm(isAdm ? "Remove admin?" : "Grant admin?")) return;
    setBusy(id);
    await supabase.from("profiles").update({ is_admin: !isAdm }).eq("id", id);
    setUsers(p => p.map(u => u.id === id ? { ...u, is_admin: !isAdm } : u));
    setBusy("");
  };

  const deletePost = async (id: string) => {
    if (!confirm("Permanently delete this post?")) return;
    setPostBusy(id);
    await supabase.from("posts").delete().eq("id", id);
    setPosts(p => p.filter(x => x.id !== id));
    setPostBusy("");
  };

  const dismissReport = async (id: string) => {
    setReportBusy(id);
    await supabase.from("reports").update({ status: "dismissed" }).eq("id", id);
    setReports(p => p.filter(r => r.id !== id));
    setReportBusy("");
  };

  const nukeReport = async (r: ContentReport) => {
    if (!confirm(`Delete this ${r.target_type}?`)) return;
    setReportBusy(r.id);
    await supabase.from(r.target_type === "post" ? "posts" : "comments").delete().eq("id", r.target_id);
    await supabase.from("reports").update({ status: "reviewed" }).eq("id", r.id);
    setReports(p => p.filter(x => x.id !== r.id));
    setReportBusy("");
  };

  const refresh = () => {
    if (tab === "overview") { statsOk.current = false; loadStats(); }
    if (tab === "users") { usersOk.current = false; loadUsers(); }
    if (tab === "posts") { postsOk.current = false; loadPosts(); }
    if (tab === "reports") { reportsOk.current = false; loadReports(); }
  };

  /* ── filtered users ──────────────────────── */
  const filtered = useMemo(() => {
    if (!q.trim()) return users;
    const s = q.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(s) || u.username?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s));
  }, [users, q]);

  /* ═══════════════════════════════════════════
     LOADING GATE
     ═══════════════════════════════════════════ */
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }
  if (!admin) return null;

  const isLoading = (tab === "overview" && statsLoading) || (tab === "users" && usersLoading) || (tab === "posts" && postsLoading) || (tab === "reports" && reportsLoading);

  const tabs: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users, count: users.length || undefined },
    { id: "posts", label: "Posts", icon: FileText, count: posts.length || undefined },
    { id: "reports", label: "Reports", icon: AlertTriangle, count: stats.reports || undefined },
  ];

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* ▌ HEADER ▌ */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-accent flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent font-bold">Admin Console</p>
              <h1 className="text-xl font-heading font-bold text-heading leading-tight -mt-0.5">Dashboard</h1>
            </div>
          </div>
        </header>

        {/* ▌ TABS + REFRESH ▌ */}
        <div className="flex items-center justify-between border-b border-border mb-6">
          <nav className="flex -mb-px">
            {tabs.map(t => {
              const Icon = t.icon;
              const on = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`group relative px-4 py-3 flex items-center gap-2 text-xs font-mono uppercase tracking-wider transition-colors ${on ? "text-heading font-bold" : "text-muted hover:text-heading"}`}>
                  <Icon className={`w-3.5 h-3.5 ${on ? "text-accent" : "text-muted group-hover:text-heading"}`} />
                  {t.label}
                  {!!t.count && t.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-px rounded-full font-bold ${t.id === "reports" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-600"}`}>
                      {t.count}
                    </span>
                  )}
                  {on && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />}
                </button>
              );
            })}
          </nav>
          <button onClick={refresh}
            className="text-muted hover:text-heading transition-colors p-2 -mr-2"
            title="Refresh data">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-accent" : ""}`} />
          </button>
        </div>

        {/* ▌ CONTENT ▌ */}
        <div className="min-h-[450px]">

          {/* ━━━ OVERVIEW ━━━ */}
          {tab === "overview" && (
            statsLoading ? <Loader /> : (
              <div className="animate-fade-in-up">
                {/* stat grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                  <Stat label="Users" val={stats.users} icon={Users} />
                  <Stat label="Posts" val={stats.posts} icon={FileText} />
                  <Stat label="Comments" val={stats.comments} icon={MessageSquare} />
                  <Stat label="New users · 7d" val={stats.users7d} icon={UserPlus} accent />
                  <Stat label="New posts · 7d" val={stats.posts7d} icon={TrendingUp} accent />
                  <Stat label="Pending reports" val={stats.reports} icon={AlertTriangle} danger={stats.reports > 0} />
                </div>

                {/* quick links */}
                <div className="bg-surface border border-border p-5 shadow-editorial">
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted font-bold mb-4">Quick Actions</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { label: "Manage users", t: "users" as Tab, icon: Users },
                      { label: "Moderate posts", t: "posts" as Tab, icon: FileText },
                      { label: `Reports (${stats.reports})`, t: "reports" as Tab, icon: AlertTriangle },
                    ].map(a => (
                      <button key={a.t} onClick={() => setTab(a.t)}
                        className="flex items-center gap-3 px-4 py-3 bg-background border border-border hover:border-accent text-left transition-colors group press-scale">
                        <a.icon className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
                        <span className="text-xs font-mono uppercase tracking-wider text-heading group-hover:text-accent font-semibold">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}

          {/* ━━━ USERS ━━━ */}
          {tab === "users" && (
            usersLoading ? <Loader /> : (
              <div className="animate-fade-in-up space-y-4">
                {/* search */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..."
                      className="w-full input-editorial pl-9 pr-3 py-2 text-xs font-mono rounded-none" />
                  </div>
                  <span className="text-[11px] font-mono text-muted">{filtered.length} users</span>
                </div>

                {/* table */}
                {filtered.length === 0 ? <Empty msg={q ? `No match for "${q}"` : "No users"} /> : (
                  <div className="bg-surface border border-border shadow-editorial overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted">
                          <th className="py-2.5 px-3 font-bold">User</th>
                          <th className="py-2.5 px-3 font-bold hidden md:table-cell">Joined</th>
                          <th className="py-2.5 px-3 font-bold text-center w-16">Posts</th>
                          <th className="py-2.5 px-3 font-bold text-center w-20">Status</th>
                          <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filtered.map(u => (
                          <tr key={u.id} className="text-xs hover:bg-surface-hover transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center overflow-hidden shrink-0 text-[10px] font-bold font-mono text-heading">
                                  {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : u.name[0]}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-heading truncate flex items-center gap-1.5">
                                    {u.name}
                                    {u.is_admin && <Badge text="Admin" color="accent" />}
                                    {u.is_banned && <Badge text="Banned" color="red" />}
                                  </div>
                                  <div className="text-[10px] text-muted font-mono truncate">{u.username ? `@${u.username}` : u.id.slice(0, 8)}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] font-mono text-muted hidden md:table-cell">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-heading">{u.postCount}</td>
                            <td className="py-2.5 px-3 text-center">
                              {u.is_banned
                                ? <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-red-600"><Ban className="w-3 h-3" />Banned</span>
                                : <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-emerald-600"><UserCheck className="w-3 h-3" />Active</span>
                              }
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex gap-1">
                                {u.username && (
                                  <Link href={`/profile/${u.username}`} target="_blank" className="px-2 py-1 text-[10px] font-mono uppercase border border-border hover:border-heading text-heading transition-colors inline-flex items-center gap-1">
                                    <Eye className="w-3 h-3" />View
                                  </Link>
                                )}
                                <Btn
                                  onClick={() => toggleBan(u.id, !!u.is_banned)}
                                  disabled={busy === u.id || u.id === myId}
                                  variant={u.is_banned ? "green" : "red"}
                                  loading={busy === u.id}
                                  label={u.is_banned ? "Unban" : "Ban"}
                                />
                                <Btn
                                  onClick={() => toggleAdminRole(u.id, !!u.is_admin)}
                                  disabled={busy === u.id || u.id === myId}
                                  variant={u.is_admin ? "muted" : "accent"}
                                  loading={busy === u.id}
                                  label={u.is_admin ? "Revoke" : "Admin"}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          )}

          {/* ━━━ POSTS ━━━ */}
          {tab === "posts" && (
            postsLoading ? <Loader /> : (
              <div className="animate-fade-in-up space-y-4">
                {/* filter pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-muted" />
                  {(["all","note","media","repost","text","code"] as PostFilter[]).map(f => (
                    <button key={f} onClick={() => setPf(f)}
                      className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors press-scale ${
                        pf === f ? "bg-heading text-white font-bold" : "bg-surface border border-border text-muted hover:text-heading"
                      }`}>
                      {f}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] font-mono text-muted">{posts.length} results</span>
                </div>

                {posts.length === 0 ? <Empty msg="No posts found" /> : (
                  <div className="space-y-2">
                    {posts.map(p => (
                      <div key={p.id} className="bg-surface border border-border p-4 flex gap-4 items-start shadow-editorial hover:border-heading/30 transition-colors">
                        {/* content */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="w-6 h-6 rounded-full border border-border overflow-hidden shrink-0 bg-background flex items-center justify-center text-[9px] font-bold font-mono">
                              {p.profiles?.avatar_url ? <img src={p.profiles.avatar_url} className="w-full h-full object-cover" /> : (p.profiles?.name?.[0] || "U")}
                            </div>
                            <span className="text-xs font-semibold text-heading">{p.profiles?.name}</span>
                            {p.profiles?.username && <span className="text-[10px] font-mono text-muted">@{p.profiles.username}</span>}
                            <Badge text={p.type} color="accent" />
                            {p.archived && <Badge text="Archived" color="yellow" />}
                            <span className="text-[10px] font-mono text-muted ml-auto">{new Date(p.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-body line-clamp-2 leading-relaxed">{p.content || <span className="italic text-muted">[No text]</span>}</p>
                          {p.media_url && <img src={p.media_url} className="w-20 h-14 object-cover border border-border" />}
                          <div className="flex gap-3 text-[10px] font-mono text-muted">
                            <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" />{p.likeCount}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3 text-accent" />{p.commentCount}</span>
                          </div>
                        </div>
                        {/* actions */}
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <Link href={`/post/${p.id}`} target="_blank"
                            className="px-2.5 py-1.5 text-[10px] font-mono uppercase border border-border hover:border-heading text-heading transition-colors inline-flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />View
                          </Link>
                          <Btn onClick={() => deletePost(p.id)} disabled={postBusy === p.id} variant="red" loading={postBusy === p.id} label="Delete" icon={Trash2} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {/* ━━━ REPORTS ━━━ */}
          {tab === "reports" && (
            reportsLoading ? <Loader /> : (
              <div className="animate-fade-in-up space-y-4">
                {/* filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-muted" />
                  {(["pending","dismissed","reviewed"] as ReportFilter[]).map(f => (
                    <button key={f} onClick={() => setRf(f)}
                      className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors press-scale ${
                        rf === f ? "bg-heading text-white font-bold" : "bg-surface border border-border text-muted hover:text-heading"
                      }`}>
                      {f}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] font-mono text-muted">{reports.length} {rf}</span>
                </div>

                {reports.length === 0 ? <Empty msg={`No ${rf} reports`} /> : (
                  <div className="space-y-2">
                    {reports.map(r => (
                      <div key={r.id} className="bg-surface border border-border p-4 flex gap-4 items-start shadow-editorial hover:border-heading/30 transition-colors">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono font-bold text-red-600 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />#{r.id.slice(0, 8)}
                            </span>
                            <Badge text={r.target_type} color="accent" />
                            <span className="text-[10px] font-mono text-muted ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="text-xs text-body">
                            <span className="text-muted">By </span>
                            <strong className="text-heading">{r.reporter?.name}</strong>
                            <span className="text-muted"> · Reason: </span>
                            <span className="text-red-600 font-medium">{r.reason}</span>
                          </div>
                          <p className="text-xs text-muted italic line-clamp-2 border-l-2 border-border pl-3">
                            {r.contentPreview}
                          </p>
                        </div>
                        {rf === "pending" && (
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <Btn onClick={() => dismissReport(r.id)} disabled={reportBusy === r.id} variant="muted" loading={reportBusy === r.id} label="Dismiss" icon={XCircle} />
                            <Btn onClick={() => nukeReport(r)} disabled={reportBusy === r.id} variant="red" loading={reportBusy === r.id} label="Delete" icon={Trash2} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MICRO-COMPONENTS
   ════════════════════════════════════════════════════════ */

function Stat({ label, val, icon: Icon, accent, danger }: {
  label: string; val: number; icon: any; accent?: boolean; danger?: boolean;
}) {
  return (
    <div className="bg-surface border border-border p-4 shadow-editorial hover-lift">
      <div className="flex items-center justify-between mb-3">
        <span className={`font-mono text-[10px] uppercase tracking-[0.12em] font-bold ${danger ? "text-red-600" : accent ? "text-accent" : "text-muted"}`}>{label}</span>
        <Icon className={`w-4 h-4 ${danger ? "text-red-400" : "text-accent/60"}`} />
      </div>
      <span className={`text-2xl font-heading font-bold ${danger ? "text-red-600" : "text-heading"}`}>{val.toLocaleString()}</span>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: "accent" | "red" | "yellow" }) {
  const c = {
    accent: "bg-accent/10 text-accent border-accent/20",
    red: "bg-red-50 text-red-600 border-red-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
  }[color];
  return <span className={`px-1.5 py-px text-[9px] font-mono uppercase font-bold border ${c}`}>{text}</span>;
}

function Btn({ onClick, disabled, variant, loading, label, icon: Icon }: {
  onClick: () => void; disabled: boolean; variant: "red" | "green" | "accent" | "muted"; loading: boolean; label: string; icon?: any;
}) {
  const v = {
    red: "bg-red-50 text-red-600 border-red-200 hover:bg-red-600 hover:text-white",
    green: "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white",
    accent: "bg-accent/10 text-accent border-accent/20 hover:bg-accent hover:text-white",
    muted: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-600 hover:text-white",
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-2 py-1 text-[10px] font-mono uppercase border transition-colors inline-flex items-center gap-1 press-scale disabled:opacity-40 disabled:cursor-not-allowed ${v}`}>
      {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : Icon ? <><Icon className="w-3 h-3" />{label}</> : label}
    </button>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="w-5 h-5 text-accent animate-spin" />
        <span className="text-[11px] font-mono text-muted">Loading...</span>
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center py-16 bg-surface border border-border">
      <span className="text-xs font-mono text-muted">{msg}</span>
    </div>
  );
}
