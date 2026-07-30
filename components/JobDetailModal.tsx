"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { JobListing } from "@/lib/types";
import { X, ExternalLink, MapPin, Building2, Calendar, CheckCircle2, Send, Loader2, Edit2 } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  job: JobListing | null;
  currentUserId: string | null;
  onApplicationSubmitted?: () => void;
  isOwner?: boolean;
  onEdit?: (job: JobListing) => void;
};

export default function JobDetailModal({
  isOpen,
  onClose,
  job,
  currentUserId,
  onApplicationSubmitted,
  isOwner,
  onEdit,
}: Props) {
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applicantNote, setApplicantNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAppliedStatus = async () => {
      if (job && currentUserId && !job.apply_url) {
        const { data } = await supabase
          .from("job_applications")
          .select("id")
          .match({ job_id: job.id, applicant_id: currentUserId })
          .maybeSingle();

        if (data) {
          setHasApplied(true);
        } else {
          setHasApplied(Boolean(job.hasApplied));
        }
      }
    };

    if (isOpen) {
      setShowApplyForm(false);
      setApplicantNote("");
      setError(null);
      checkAppliedStatus();
    }
  }, [isOpen, job, currentUserId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !job) return null;

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

  const handleInAppApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      setError("You must be logged in to apply.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Insert into job_applications table
      const { error: appError } = await supabase
        .from("job_applications")
        .insert({
          job_id: job.id,
          applicant_id: currentUserId,
          message: applicantNote.trim() || null,
        });

      if (appError) throw appError;

      // 2. Fetch applicant profile name to construct clean notification
      let applicantName = "Someone";
      const { data: appProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", currentUserId)
        .maybeSingle();
      if (appProfile?.name) applicantName = appProfile.name;

      // 3. Notify the job poster (if not applying to own post)
      if (job.posted_by !== currentUserId) {
        const { error: notifErr } = await supabase.from("notifications").insert({
          recipient_id: job.posted_by,
          actor_id: currentUserId,
          type: "job_application",
          post_id: job.id,
        });

        if (notifErr) {
          console.warn("[JobDetailModal] Notification insert warning:", notifErr);
        }
      }

      setHasApplied(true);
      setShowApplyForm(false);
      if (onApplicationSubmitted) onApplicationSubmitted();
    } catch (err: any) {
      console.error("[JobDetailModal] Error applying to job:", err);
      setError(err.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  const poster = job.profiles;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-border bg-background/50 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-accent/10 border border-accent/30 text-accent font-mono text-[11px] font-bold uppercase tracking-wider">
                  {job.job_type}
                </span>
                <span className="px-2.5 py-0.5 bg-surface border border-border text-heading font-mono text-[11px] font-bold uppercase tracking-wider">
                  {job.work_mode}
                </span>
              </div>

              <h1 className="font-heading font-bold text-2xl md:text-3xl text-heading tracking-tight leading-tight">
                {job.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted font-sans pt-1">
                <div className="flex items-center gap-1.5 font-medium text-heading">
                  <Building2 className="w-4 h-4 text-accent" />
                  <span>{job.company}</span>
                </div>
                {job.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted" />
                    <span>{job.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-muted" />
                  <span>Posted {formatDate(job.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isOwner && onEdit && (
                <button
                  onClick={() => {
                    onClose();
                    onEdit(job);
                  }}
                  className="p-2 text-muted hover:text-heading transition-colors rounded-full hover:bg-gray-100"
                  title="Edit listing"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-muted hover:text-heading transition-colors rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Poster Attribution */}
          {poster && (
            <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2">
              <span className="text-xs font-mono text-muted">Posted by</span>
              <Link
                href={`/profile/${poster.username || job.posted_by}`}
                onClick={onClose}
                className="flex items-center gap-1.5 group"
              >
                <div className="w-5 h-5 rounded-full overflow-hidden border border-border shrink-0 bg-background">
                  {poster.avatar_url ? (
                    <img src={poster.avatar_url} alt={poster.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-muted">
                      {poster.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-xs font-heading font-semibold text-heading group-hover:underline">
                  {poster.name}
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
              Role Description
            </h3>
            <p className="text-sm font-sans text-heading leading-relaxed whitespace-pre-wrap">
              {job.description}
            </p>
          </div>

          {/* Requirements */}
          {job.requirements && (
            <div className="space-y-2 pt-4 border-t border-border">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
                Requirements & Qualifications
              </h3>
              <p className="text-sm font-sans text-heading leading-relaxed whitespace-pre-wrap">
                {job.requirements}
              </p>
            </div>
          )}

          {/* Skills & Tags */}
          {Array.isArray(job.tags) && job.tags.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-border">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
                Skills & Technologies
              </h3>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-surface border border-border font-mono text-xs text-heading uppercase tracking-wide"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* In-App Application Form */}
          {showApplyForm && !hasApplied && (
            <form onSubmit={handleInAppApply} className="p-5 bg-background border border-accent space-y-3 animate-in fade-in duration-150">
              <h4 className="font-heading font-bold text-base text-heading">
                Submit In-App Application
              </h4>
              <p className="text-xs font-sans text-muted">
                Send your profile details directly to {job.company}'s hiring team.
              </p>
              <textarea
                rows={3}
                value={applicantNote}
                onChange={(e) => setApplicantNote(e.target.value)}
                placeholder="Add an optional note introducing yourself and your relevant projects..."
                className="w-full bg-surface border border-border p-3 text-xs font-sans text-heading focus:outline-none focus:border-accent"
              />
              <div className="flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowApplyForm(false)}
                  className="px-3 py-1.5 bg-surface border border-border font-mono text-xs text-heading"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-1.5 bg-accent text-white font-heading font-bold text-xs uppercase tracking-wider hover:bg-accent/90 transition-colors flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Application</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:px-8 border-t border-border bg-background/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface border border-border font-mono text-xs font-bold text-heading hover:bg-gray-100 transition-colors"
          >
            Close
          </button>

          {/* Apply Button Options */}
          {job.apply_url ? (
            <a
              href={job.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-accent text-white font-heading font-bold text-xs uppercase tracking-wider hover:bg-accent/90 transition-colors flex items-center gap-2 shadow-xs"
            >
              <span>Apply Externally</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : hasApplied ? (
            <div className="px-5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Applied ✓</span>
            </div>
          ) : !showApplyForm ? (
            <button
              onClick={() => {
                if (!currentUserId) {
                  setError("Please log in to apply.");
                } else {
                  setShowApplyForm(true);
                }
              }}
              className="px-6 py-2.5 bg-accent text-white font-heading font-bold text-xs uppercase tracking-wider hover:bg-accent/90 transition-colors flex items-center gap-2 shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span>Apply Now</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
