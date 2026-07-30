"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Project } from "@/lib/types";
import { X, Upload, Plus, Trash2, GitBranch, ExternalLink, Image as ImageIcon, Loader2 } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  projectToEdit?: Project | null;
  onProjectSaved: () => void;
};

export default function ProjectModal({
  isOpen,
  onClose,
  currentUserId,
  projectToEdit,
  onProjectSaved,
}: Props) {
  const isEditing = Boolean(projectToEdit);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [techInput, setTechInput] = useState("");
  const [techStack, setTechStack] = useState<string[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill when projectToEdit changes
  useEffect(() => {
    if (projectToEdit) {
      setTitle(projectToEdit.title || "");
      setDescription(projectToEdit.description || "");
      setTechStack(Array.isArray(projectToEdit.tech_stack) ? projectToEdit.tech_stack : []);
      setGithubUrl(projectToEdit.github_url || "");
      setLiveUrl(projectToEdit.live_url || "");
      setImageUrl(projectToEdit.image_url || "");
    } else {
      resetForm();
    }
  }, [projectToEdit, isOpen]);

  // Handle escape key
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
    setDescription("");
    setTechInput("");
    setTechStack([]);
    setGithubUrl("");
    setLiveUrl("");
    setImageUrl("");
    setImageFile(null);
    setUploadingImage(false);
    setSubmitting(false);
    setDeleting(false);
    setConfirmDelete(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddTechTag = () => {
    const trimmed = techInput.trim().replace(/,/g, "");
    if (trimmed && !techStack.includes(trimmed)) {
      setTechStack([...techStack, trimmed]);
      setTechInput("");
    }
  };

  const handleRemoveTechTag = (tagToRemove: string) => {
    setTechStack(techStack.filter((t) => t !== tagToRemove));
  };

  const handleTechKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTechTag();
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setUploadingImage(true);
    setError(null);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUserId}_${Date.now()}.${fileExt}`;
      const filePath = `project_images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("projects")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // Fallback: convert file to Base64 data URL if storage bucket fails/doesn't exist
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageUrl(reader.result as string);
          setUploadingImage(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("projects")
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setImageUrl(publicUrlData.publicUrl);
      }
    } catch (err: any) {
      console.error("[ProjectModal] Image upload error:", err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Project title is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const projectPayload = {
        user_id: currentUserId,
        title: title.trim(),
        description: description.trim(),
        tech_stack: techStack,
        github_url: githubUrl.trim() || null,
        live_url: liveUrl.trim() || null,
        image_url: imageUrl.trim() || null,
      };

      if (isEditing && projectToEdit) {
        const { error: updateError } = await supabase
          .from("projects")
          .update(projectPayload)
          .eq("id", projectToEdit.id)
          .eq("user_id", currentUserId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("projects")
          .insert(projectPayload);

        if (insertError) throw insertError;
      }

      onProjectSaved();
      handleClose();
    } catch (err: any) {
      console.error("[ProjectModal] Error saving project:", err);
      setError(err.message || "Failed to save project. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!projectToEdit) return;
    setDeleting(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectToEdit.id)
        .eq("user_id", currentUserId);

      if (deleteError) throw deleteError;

      onProjectSaved();
      handleClose();
    } catch (err: any) {
      console.error("[ProjectModal] Error deleting project:", err);
      setError(err.message || "Failed to delete project.");
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
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
          <div>
            <h2 className="font-heading font-bold text-xl text-heading">
              {isEditing ? "Edit Project" : "Add New Project"}
            </h2>
            <p className="text-xs font-sans text-muted mt-0.5">
              Showcase your code, side project, or open-source work
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-muted hover:text-heading transition-colors rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading">
              Project Title <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Antigravity IDE, DevLogs, Supabase Auth Kit"
              className="w-full bg-background border border-border px-3.5 py-2 text-sm text-heading font-heading font-medium focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading">
              Short Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what the project does, core architecture, and problems solved..."
              className="w-full bg-background border border-border p-3.5 text-sm text-heading font-sans focus:outline-none focus:border-accent transition-colors resize-y"
            />
          </div>

          {/* Tech Stack Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading">
              Tech Stack Tags
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={handleTechKeyDown}
                placeholder="Type a technology (e.g. Next.js, Rust, PostgreSQL) & press Enter"
                className="flex-1 bg-background border border-border px-3.5 py-2 text-sm text-heading font-mono text-xs focus:outline-none focus:border-accent transition-colors"
              />
              <button
                type="button"
                onClick={handleAddTechTag}
                className="px-3 py-2 bg-surface border border-border hover:border-heading font-mono text-xs font-bold text-heading flex items-center gap-1 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {/* Render Tags */}
            {techStack.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {techStack.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/30 text-accent font-mono text-[11px] font-medium"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTechTag(tag)}
                      className="hover:text-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Links Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" /> GitHub Repository URL
              </label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                className="w-full bg-background border border-border px-3.5 py-2 text-xs font-mono text-heading focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-accent" /> Live Demo URL
              </label>
              <input
                type="url"
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="https://myproject.com"
                className="w-full bg-background border border-border px-3.5 py-2 text-xs font-mono text-heading focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          {/* Image Upload / URL */}
          <div className="space-y-2 pt-1 border-t border-border">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-heading">
              Project Cover Image (Optional)
            </label>

            {imageUrl ? (
              <div className="relative w-full h-40 border border-border bg-background overflow-hidden group">
                <img src={imageUrl} alt="Project Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-full hover:bg-red-600 transition-colors"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="w-full sm:w-auto flex-1 cursor-pointer flex items-center justify-center gap-2 border border-dashed border-border hover:border-heading p-4 bg-background transition-colors text-xs font-mono text-muted">
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  ) : (
                    <Upload className="w-4 h-4 text-accent" />
                  )}
                  <span>{uploadingImage ? "Uploading..." : "Upload Cover Image"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>
                <div className="text-xs font-mono text-gray-400">OR</div>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste Image URL"
                  className="w-full sm:w-1/2 bg-background border border-border px-3.5 py-2.5 text-xs font-mono text-heading focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
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
                  title="Delete project"
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
                <span>{isEditing ? "Save Changes" : "Create Project"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
