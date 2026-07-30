"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { JobListing } from "@/lib/types";
import { X, Plus, Trash2, Briefcase, MapPin, Building2, Globe, Mail, Calendar, Loader2 } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  jobToEdit?: JobListing | null;
  onJobSaved: () => void;
};

const JOB_TYPES = ["Full-time", "Part-time", "Internship", "Contract"] as const;
const WORK_MODES = ["Remote", "Onsite", "Hybrid"] as const;

export default function JobListingModal({
  isOpen,
  onClose,
  currentUserId,
  jobToEdit,
  onJobSaved,
}: Props) {
  const isEditing = Boolean(jobToEdit);

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [jobType, setJobType] = useState<JobListing["job_type"]>("Full-time");
  const [workMode, setWorkMode] = useState<JobListing["work_mode"]>("Remote");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (jobToEdit) {
      setTitle(jobToEdit.title || "");
      setCompany(jobToEdit.company || "");
      setLocation(jobToEdit.location || "");
      setJobType(jobToEdit.job_type || "Full-time");
      setWorkMode(jobToEdit.work_mode || "Remote");
      setDescription(jobToEdit.description || "");
      setRequirements(jobToEdit.requirements || "");
      setApplyUrl(jobToEdit.apply_url || "");
      setApplyEmail(jobToEdit.apply_email || "");
      setTags(Array.isArray(jobToEdit.tags) ? jobToEdit.tags : []);
      setExpiresAt(jobToEdit.expires_at ? new Date(jobToEdit.expires_at).toISOString().split("T")[0] : "");
    } else {
      resetForm();
    }
  }, [jobToEdit, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const resetForm = () => {
    setTitle("");
    setCompany("");
    setLocation("");
    setJobType("Full-time");
    setWorkMode("Remote");
    setDescription("");
    setRequirements("");
    setApplyUrl("");
    setApplyEmail("");
    setTagInput("");
    setTags([]);
    setExpiresAt("");
    setSubmitting(false);
    setDeleting(false);
    setConfirmDelete(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/,/g, "");
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !company.trim() || !description.trim()) {
      setError("Title, company, and description are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        posted_by: currentUserId,
        title: title.trim(),
        company: company.trim(),
        location: location.trim() || null,
        job_type: jobType,
        work_mode: workMode,
        description: description.trim(),
        requirements: requirements.trim() || null,
        apply_url: applyUrl.trim() || null,
        apply_email: applyEmail.trim() || null,
        tags: tags,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      };

      if (isEditing && jobToEdit) {
        const { error: updateError } = await supabase
          .from("job_listings")
          .update(payload)
          .eq("id", jobToEdit.id)
          .eq("posted_by", currentUserId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("job_listings")
          .insert(payload);

        if (insertError) throw insertError;
      }

      onJobSaved();
      handleClose();
    } catch (err: any) {
      console.error("[JobListingModal] Error saving job listing:", err);
      setError(err.message || "Failed to save job listing. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!jobToEdit) return;
    setDeleting(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("job_listings")
        .delete()
        .eq("id", jobToEdit.id)
        .eq("posted_by", currentUserId);

      if (deleteError) throw deleteError;

      onJobSaved();
      handleClose();
    } catch (err: any) {
      console.error("[JobListingModal] Error deleting job:", err);
      setError(err.message || "Failed to delete job listing.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="bg-surface border border-border w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-accent" />
            <h2 className="font-heading font-bold text-xl text-heading">
              {isEditing ? "Edit Job Listing" : "Post a Job or Internship"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-muted hover:text-heading transition-colors rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Title & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading">
                Job Title <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer, ML Intern"
                className="w-full bg-background border border-border px-3.5 py-2 text-sm font-heading font-medium text-heading focus:outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-muted" /> Company Name <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Stripe, DeepMind, Vercel"
                className="w-full bg-background border border-border px-3.5 py-2 text-sm font-sans text-heading focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Type, Work Mode, Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading">
                Job Type
              </label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value as JobListing["job_type"])}
                className="w-full bg-background border border-border px-3 py-2 text-xs font-mono text-heading focus:outline-none focus:border-accent"
              >
                {JOB_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading">
                Work Mode
              </label>
              <select
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value as JobListing["work_mode"])}
                className="w-full bg-background border border-border px-3 py-2 text-xs font-mono text-heading focus:outline-none focus:border-accent"
              >
                {WORK_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-muted" /> Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, Remote"
                className="w-full bg-background border border-border px-3 py-2 text-xs font-sans text-heading focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading">
              Job Description <span className="text-accent">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the role, responsibilities, team environment..."
              className="w-full bg-background border border-border p-3 text-sm text-heading font-sans focus:outline-none focus:border-accent resize-y"
            />
          </div>

          {/* Requirements */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading">
              Key Requirements & Qualifications
            </label>
            <textarea
              rows={3}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="3+ years React/Next.js experience, experience with Supabase/PostgreSQL..."
              className="w-full bg-background border border-border p-3 text-xs text-heading font-sans focus:outline-none focus:border-accent resize-y"
            />
          </div>

          {/* Application Link / Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-accent" /> Apply URL (Optional)
              </label>
              <input
                type="url"
                value={applyUrl}
                onChange={(e) => setApplyUrl(e.target.value)}
                placeholder="https://company.com/careers/apply"
                className="w-full bg-background border border-border px-3.5 py-2 text-xs font-mono text-heading focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted" /> Apply Email (Optional)
              </label>
              <input
                type="email"
                value={applyEmail}
                onChange={(e) => setApplyEmail(e.target.value)}
                placeholder="jobs@company.com"
                className="w-full bg-background border border-border px-3.5 py-2 text-xs font-mono text-heading focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Tags / Required Skills */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading">
              Skills & Tech Tags
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Type skill tag (e.g. React, Python, ML) & press Enter"
                className="flex-1 bg-background border border-border px-3.5 py-2 text-xs font-mono text-heading focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 bg-surface border border-border font-mono text-xs font-bold text-heading flex items-center gap-1 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-accent/10 border border-accent/30 text-accent font-mono text-[11px]"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Expiry Date */}
          <div className="space-y-1.5 pt-1 border-t border-border">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted" /> Listing Expiry Date (Optional)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full sm:w-1/2 bg-background border border-border px-3.5 py-2 text-xs font-mono text-heading focus:outline-none focus:border-accent"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            {isEditing ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-2 bg-red-600 text-white font-mono text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 bg-surface border border-border text-heading font-mono text-xs hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
                  title="Delete job listing"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 bg-surface border border-border font-mono text-xs font-bold text-heading hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-accent text-white font-heading font-bold text-xs uppercase tracking-wider hover:bg-accent/90 transition-colors flex items-center gap-2 shadow-xs"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isEditing ? "Save Changes" : "Post Listing"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
