"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { JobListing } from "@/lib/types";
import JobListingModal from "@/components/JobListingModal";
import JobDetailModal from "@/components/JobDetailModal";
import JobApplicantsModal from "@/components/JobApplicantsModal";
import {
  Briefcase,
  Plus,
  Search,
  MapPin,
  Building2,
  Calendar,
  CheckCircle2,
  Users,
  Edit2,
  ExternalLink,
  Filter,
  XCircle,
  Clock
} from "lucide-react";

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function JobsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [jobListings, setJobListings] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedWorkMode, setSelectedWorkMode] = useState<string>("All");

  // Modal States
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<JobListing | null>(null);
  
  const [selectedJobDetail, setSelectedJobDetail] = useState<JobListing | null>(null);

  const [applicantsModalJobId, setApplicantsModalJobId] = useState<string | null>(null);
  const [applicantsModalJobTitle, setApplicantsModalJobTitle] = useState<string>("");

  const fetchJobs = useCallback(async (viewerId: string | null) => {
    try {
      setLoading(true);
      setError(null);

      const nowIso = new Date().toISOString();

      // 1. Fetch job listings
      const { data: rawJobs, error: jobsError } = await supabase
        .from("job_listings")
        .select("*, profiles(name, avatar_url, username)")
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("created_at", { ascending: false });

      if (jobsError) {
        console.warn("[JobsPage] Query warning:", jobsError.message);
        setJobListings([]);
        return;
      }

      if (!rawJobs || rawJobs.length === 0) {
        setJobListings([]);
        return;
      }

      const jobIds = rawJobs.map((j) => j.id);

      // 2. Fetch applicant counts for each job
      const { data: appCounts } = await supabase
        .from("job_applications")
        .select("job_id");

      const countMap = new Map<string, number>();
      (appCounts || []).forEach((row) => {
        countMap.set(row.job_id, (countMap.get(row.job_id) || 0) + 1);
      });

      // 3. Fetch applications by current user to mark "Applied ✓"
      let myAppliedJobIds = new Set<string>();
      if (viewerId) {
        const { data: myApps } = await supabase
          .from("job_applications")
          .select("job_id")
          .eq("applicant_id", viewerId)
          .in("job_id", jobIds);

        if (myApps) {
          myApps.forEach((a) => myAppliedJobIds.add(a.job_id));
        }
      }

      const enrichedJobs: JobListing[] = rawJobs.map((j) => ({
        ...j,
        applicantCount: countMap.get(j.id) || 0,
        hasApplied: myAppliedJobIds.has(j.id),
      }));

      setJobListings(enrichedJobs);
    } catch (err: any) {
      console.error("[JobsPage] Error fetching jobs:", err);
      setError(err.message || "Failed to load job listings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      setCurrentUserId(userId);
      fetchJobs(userId);
    };

    checkAuth();
  }, [fetchJobs]);

  const handleOpenCreateModal = () => {
    if (!currentUserId) {
      router.push("/login");
    } else {
      setJobToEdit(null);
      setIsListingModalOpen(true);
    }
  };

  const handleEditJob = (job: JobListing) => {
    setJobToEdit(job);
    setIsListingModalOpen(true);
  };

  // Filter listings
  const filteredListings = jobListings.filter((job) => {
    const matchesSearch =
      !searchQuery.trim() ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.location && job.location.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = selectedType === "All" || job.job_type === selectedType;
    const matchesWorkMode = selectedWorkMode === "All" || job.work_mode === selectedWorkMode;

    return matchesSearch && matchesType && matchesWorkMode;
  });

  return (
    <main className="min-h-screen bg-background text-body pb-16">
      <div className="max-w-6xl mx-auto px-4 pt-20 md:pt-24 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-accent/10 border border-accent/20 rounded-none text-accent">
                <Briefcase className="w-6 h-6" />
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-heading tracking-tight">
                Jobs & Internships
              </h1>
            </div>
            <p className="text-sm font-sans text-muted">
              Discover software engineering roles, internships, and remote dev contracts.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="self-start sm:self-auto px-5 py-2.5 bg-accent text-white font-heading font-bold text-xs uppercase tracking-wider hover:bg-accent/90 transition-colors flex items-center gap-2 shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Post a Job</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-surface border border-border p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by title, company, or city..."
                className="w-full bg-background border border-border pl-10 pr-4 py-2 text-xs font-mono text-heading focus:outline-none focus:border-accent"
              />
            </div>

            {/* Job Type Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-mono font-bold uppercase text-muted mr-1 shrink-0 hidden sm:inline">Type:</span>
              {["All", "Full-time", "Part-time", "Internship", "Contract"].map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors shrink-0 ${
                    selectedType === t
                      ? "bg-accent text-white font-bold"
                      : "bg-background border border-border text-heading hover:border-heading"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Work Mode Filter Pills */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-xs font-mono font-bold uppercase text-muted mr-1">Work Mode:</span>
            {["All", "Remote", "Onsite", "Hybrid"].map((mode) => (
              <button
                key={mode}
                onClick={() => setSelectedWorkMode(mode)}
                className={`px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  selectedWorkMode === mode
                    ? "bg-heading text-background font-bold"
                    : "bg-background border border-border text-muted hover:text-heading"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Grid */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-xs font-mono text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 4, 4].map((i) => (
              <div key={i} className="h-48 bg-surface border border-border animate-pulse p-6 space-y-3">
                <div className="h-5 bg-gray-200 w-1/3" />
                <div className="h-6 bg-gray-200 w-2/3" />
                <div className="h-4 bg-gray-200 w-full" />
              </div>
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-20 bg-surface border border-border p-8 space-y-3">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="font-heading font-bold text-xl text-heading">No Listings Found</h3>
            <p className="text-xs font-mono text-muted max-w-sm mx-auto">
              No active job or internship listings match your filters. Be the first to post one!
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-2 px-5 py-2 bg-accent text-white font-heading font-bold text-xs uppercase tracking-wider hover:bg-accent/90 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Post a Job Listing</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredListings.map((job) => {
              const isPoster = currentUserId && job.posted_by === currentUserId;

              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJobDetail(job)}
                  className="group bg-surface border border-border p-6 flex flex-col justify-between hover:border-heading transition-all shadow-xs cursor-pointer relative"
                >
                  <div className="space-y-3">
                    {/* Top Badges & Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-accent/10 border border-accent/30 text-accent font-mono text-[10px] font-bold uppercase tracking-wider">
                          {job.job_type}
                        </span>
                        <span className="px-2.5 py-0.5 bg-background border border-border text-heading font-mono text-[10px] font-bold uppercase tracking-wider">
                          {job.work_mode}
                        </span>
                      </div>

                      <span className="text-[11px] font-mono text-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(job.created_at)}
                      </span>
                    </div>

                    {/* Title & Company */}
                    <div>
                      <h3 className="font-heading font-bold text-xl text-heading group-hover:text-accent transition-colors leading-tight">
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-muted font-sans mt-1">
                        <span className="font-semibold text-heading flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-accent" /> {job.company}
                        </span>
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-muted" /> {job.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description Preview */}
                    <p className="text-xs font-sans text-muted line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>
                  </div>

                  {/* Footer Stats & Actions */}
                  <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between gap-2">
                    {/* Skills Tags */}
                    {Array.isArray(job.tags) && job.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {job.tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-background border border-border font-mono text-[10px] uppercase text-muted"
                          >
                            {tag}
                          </span>
                        ))}
                        {job.tags.length > 3 && (
                          <span className="px-1 py-0.5 font-mono text-[10px] text-muted">
                            +{job.tags.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}

                    {/* Poster vs Applicant status */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isPoster ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setApplicantsModalJobId(job.id);
                            setApplicantsModalJobTitle(job.title);
                          }}
                          className="px-3 py-1 bg-surface border border-border hover:border-accent font-mono text-xs text-heading flex items-center gap-1.5 transition-colors"
                        >
                          <Users className="w-3.5 h-3.5 text-accent" />
                          <span>Applicants ({job.applicantCount || 0})</span>
                        </button>
                      ) : job.hasApplied ? (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[11px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Applied ✓
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono font-bold text-accent uppercase group-hover:underline">
                          View & Apply &rarr;
                        </span>
                      )}

                      {isPoster && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditJob(job);
                          }}
                          className="p-1.5 text-muted hover:text-heading transition-colors"
                          title="Edit job"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Post / Edit Job Listing Modal */}
      {currentUserId && (
        <JobListingModal
          isOpen={isListingModalOpen}
          onClose={() => setIsListingModalOpen(false)}
          currentUserId={currentUserId}
          jobToEdit={jobToEdit}
          onJobSaved={() => fetchJobs(currentUserId)}
        />
      )}

      {/* Job Detail & In-App Application Modal */}
      <JobDetailModal
        isOpen={Boolean(selectedJobDetail)}
        onClose={() => setSelectedJobDetail(null)}
        job={selectedJobDetail}
        currentUserId={currentUserId}
        onApplicationSubmitted={() => fetchJobs(currentUserId)}
        isOwner={currentUserId ? selectedJobDetail?.posted_by === currentUserId : false}
        onEdit={(job) => {
          setSelectedJobDetail(null);
          handleEditJob(job);
        }}
      />

      {/* View Applicants Modal */}
      <JobApplicantsModal
        isOpen={Boolean(applicantsModalJobId)}
        onClose={() => setApplicantsModalJobId(null)}
        jobId={applicantsModalJobId}
        jobTitle={applicantsModalJobTitle}
      />
    </main>
  );
}
