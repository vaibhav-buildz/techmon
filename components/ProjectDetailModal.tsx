"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Project } from "@/lib/types";
import { X, GitBranch, ExternalLink, Code2, Edit2, Calendar } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  isOwner?: boolean;
  onEdit?: (project: Project) => void;
};

export default function ProjectDetailModal({
  isOpen,
  onClose,
  project,
  isOwner,
  onEdit,
}: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

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

  const author = project.profiles;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover Header */}
        <div className="relative w-full h-56 md:h-64 bg-slate-900 overflow-hidden shrink-0 border-b border-border">
          {project.image_url ? (
            <img
              src={project.image_url}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-900 via-neutral-900 to-stone-900 flex flex-col items-center justify-center p-6 text-center border-b border-border">
              <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-3">
                <Code2 className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-heading font-bold text-2xl text-white tracking-tight">
                {project.title}
              </h3>
            </div>
          )}

          {/* Close & Edit buttons overlay */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {isOwner && onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(project);
                }}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-xs"
                title="Edit Project"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-xs"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Header Info */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <h1 className="font-heading font-bold text-2xl md:text-3xl text-heading tracking-tight leading-tight">
                {project.title}
              </h1>

              {/* Author Attribution */}
              {author && (
                <div className="flex items-center gap-2.5 mt-2">
                  <Link
                    href={`/profile/${author.username || project.user_id}`}
                    onClick={onClose}
                    className="flex items-center gap-2 group"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden border border-border shrink-0 bg-background">
                      {author.avatar_url ? (
                        <img src={author.avatar_url} alt={author.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted">
                          {author.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-heading font-semibold text-heading group-hover:underline">
                      {author.name}
                    </span>
                  </Link>
                  <span className="text-xs text-muted">•</span>
                  <div className="flex items-center gap-1 text-xs font-mono text-muted">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(project.created_at)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Badges */}
            <div className="flex items-center gap-2">
              {project.github_url && (
                <a
                  href={project.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-background border border-border hover:border-heading font-mono text-xs text-heading flex items-center gap-1.5 transition-colors"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>Code</span>
                </a>
              )}
              {project.live_url && (
                <a
                  href={project.live_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-accent text-white font-mono text-xs font-bold flex items-center gap-1.5 hover:bg-accent/90 transition-colors shadow-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Live Demo</span>
                </a>
              )}
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
                About the Project
              </h3>
              <p className="text-sm font-sans text-heading leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          )}

          {/* Tech Stack */}
          {Array.isArray(project.tech_stack) && project.tech_stack.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
                Technologies & Tools
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.tech_stack.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-surface border border-border font-mono text-xs text-heading font-medium tracking-wide uppercase"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-surface border border-border font-mono text-xs font-bold text-heading hover:bg-gray-100 transition-colors ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
