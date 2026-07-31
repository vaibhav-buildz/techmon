"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { JobApplication } from "@/lib/types";
import { X, Users, Calendar, ArrowRight, MessageSquare, Loader2 } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  jobTitle?: string;
};

export default function JobApplicantsModal({
  isOpen,
  onClose,
  jobId,
  jobTitle,
}: Props) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplicants = useCallback(async () => {
    if (!jobId) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch from job_applications table
      const { data: appsData, error: appsError } = await supabase
        .from("job_applications")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });

      if (appsError) throw appsError;

      if (!appsData || appsData.length === 0) {
        setApplications([]);
        return;
      }

      const applicantIds = Array.from(new Set(appsData.map((a) => a.applicant_id)));

      // 2. Fetch profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, username, headline")
        .in("id", applicantIds);

      const profileMap = new Map(profilesData?.map((p) => [p.id, p]));

      const enrichedApplications: JobApplication[] = appsData.map((a) => {
        const prof = profileMap.get(a.applicant_id);
        return {
          ...a,
          applicant: prof
            ? {
                name: prof.name,
                avatar_url: prof.avatar_url || "",
                username: prof.username,
                headline: prof.headline || "",
              }
            : { name: "Unknown Applicant" },
        };
      });

      setApplications(enrichedApplications);
    } catch (err: any) {
      console.error("[JobApplicantsModal] Fetch error:", err);
      setError(err.message || "Failed to load applicants.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (isOpen && jobId) {
      fetchApplicants();
    }
  }, [isOpen, jobId, fetchApplicants]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-border bg-background/60 backdrop-blur-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="font-heading font-bold text-xl tracking-tight text-heading">
                Job Applicants
              </h2>
            </div>
            {jobTitle && (
              <p className="text-xs font-mono text-muted mt-1 line-clamp-1">
                Applicants for: <span className="text-heading font-semibold">{jobTitle}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-heading transition-colors rounded-full hover:bg-gray-100/80 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="p-3 bg-red-50/90 border border-red-200 text-red-700 text-xs font-mono rounded-lg mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-background flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12 text-muted space-y-3">
              <div className="w-14 h-14 bg-background border border-border rounded-full flex items-center justify-center mx-auto text-gray-400">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-bold text-lg text-heading">No Applications Yet</h3>
              <p className="text-xs font-mono text-muted">No developer has submitted an application for this listing yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-mono font-bold text-muted uppercase tracking-wider">
                Total Applicants ({applications.length})
              </div>

              <div className="space-y-3">
                {applications.map((app) => {
                  const applicant = app.applicant;
                  return (
                    <div key={app.id} className="p-4 rounded-xl border border-border/80 bg-background hover:bg-surface hover:shadow-sm transition-all space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-border shrink-0 bg-surface shadow-2xs">
                            {applicant?.avatar_url ? (
                              <img src={applicant.avatar_url} alt={applicant.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-mono font-bold text-xs text-heading bg-accent/10">
                                {applicant?.name?.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-heading font-bold text-sm text-heading truncate">
                              {applicant?.name}
                            </h4>
                            {applicant?.headline && (
                              <p className="text-xs font-sans text-muted truncate">
                                {applicant.headline}
                              </p>
                            )}
                          </div>
                        </div>

                        {applicant?.username && (
                          <Link
                            href={`/profile/${applicant.username}`}
                            onClick={onClose}
                            className="px-3.5 py-1.5 bg-surface border border-border text-heading hover:border-accent hover:text-accent rounded-lg font-mono text-xs font-bold transition-all shrink-0 flex items-center gap-1 active:scale-95 shadow-2xs"
                          >
                            <span>Profile</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>

                      {/* Application Note / Message */}
                      {app.message && (
                        <div className="p-3.5 bg-surface border border-border/70 rounded-lg text-xs font-sans text-heading leading-relaxed flex items-start gap-2.5">
                          <MessageSquare className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                          <p className="whitespace-pre-wrap">{app.message}</p>
                        </div>
                      )}

                      <div className="text-[10px] font-mono text-muted text-right">
                        Applied on {formatDate(app.created_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background/60 backdrop-blur-xs flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-surface border border-border font-mono text-xs font-bold text-heading rounded-lg hover:bg-gray-100/80 transition-all active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
