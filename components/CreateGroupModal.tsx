"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Group } from "@/lib/types";
import { X, Upload, Plus, Trash2, Image as ImageIcon, Loader2, Lock, Globe, Users2 } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onGroupCreated: (group: Group) => void;
};

export default function CreateGroupModal({
  isOpen,
  onClose,
  currentUserId,
  onGroupCreated,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [topicTags, setTopicTags] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setTagInput("");
    setTopicTags([]);
    setIsPrivate(false);
    setCoverUrl("");
    setCoverFile(null);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (trimmed && !topicTags.includes(trimmed)) {
      setTopicTags([...topicTags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTopicTags(topicTags.filter((t) => t !== tagToRemove));
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Cover image must be smaller than 5MB");
      return;
    }

    setCoverFile(file);
    setError(null);
    setUploadingImage(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUserId}_${Date.now()}.${fileExt}`;
      const filePath = `group_covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("groups")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // Fallback: convert file to Base64 data URL if storage bucket fails
        const reader = new FileReader();
        reader.onloadend = () => {
          setCoverUrl(reader.result as string);
          setUploadingImage(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("groups")
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setCoverUrl(publicUrlData.publicUrl);
      }
    } catch (err: any) {
      console.error("Error uploading cover image:", err);
      // Fallback base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }
    if (!currentUserId) {
      setError("You must be logged in to create a group.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Insert into groups table
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          cover_url: coverUrl || null,
          is_private: isPrivate,
          topic_tags: topicTags,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // 2. Add creator as admin in group_members table
      const { error: memberError } = await supabase.from("group_members").insert({
        group_id: groupData.id,
        user_id: currentUserId,
        role: "admin",
      });

      if (memberError) {
        console.error("Error inserting group admin member:", memberError);
      }

      onGroupCreated({
        ...groupData,
        memberCount: 1,
        isMember: true,
        myRole: "admin",
      });

      handleClose();
    } catch (err: any) {
      console.error("Error creating group:", err);
      setError(err.message || "Failed to create group. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-background border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Users2 className="w-4.5 h-4.5" />
            </div>
            <h2 className="font-serif text-xl font-bold tracking-tight text-heading">
              Create New Group
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-muted hover:text-heading rounded-lg hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-mono">
              {error}
            </div>
          )}

          {/* Group Name */}
          <div className="space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-muted font-medium">
              Group Name <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Frontend Engineers Guild"
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-heading placeholder:text-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-muted font-medium">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this community about? Share guidelines or goals..."
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-heading placeholder:text-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none"
            />
          </div>

          {/* Topic Tags */}
          <div className="space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-muted font-medium">
              Topic Tags
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag (e.g. react, webdev)"
                className="flex-1 px-4 py-2 bg-surface border border-border rounded-xl text-heading placeholder:text-muted/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3.5 py-2 bg-surface border border-border hover:bg-border/50 text-heading rounded-xl font-mono text-xs font-medium transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {topicTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {topicTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 border border-accent/20 text-accent rounded-lg text-xs font-mono"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Cover Image Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-muted font-medium">
              Cover Image (Optional)
            </label>
            
            {coverUrl ? (
              <div className="relative h-40 rounded-xl overflow-hidden border border-border group">
                <img src={coverUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setCoverUrl("");
                    setCoverFile(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer bg-surface/50 hover:bg-surface transition-all group">
                {uploadingImage ? (
                  <div className="flex items-center gap-2 text-muted font-mono text-xs">
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                    Uploading image...
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-muted group-hover:text-accent mb-2 transition-colors" />
                    <span className="text-xs font-mono text-muted group-hover:text-heading transition-colors">
                      Click to upload cover image (Max 5MB)
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverSelect}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Privacy Toggle */}
          <div className="p-4 bg-surface border border-border rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center text-heading">
                {isPrivate ? <Lock className="w-4.5 h-4.5 text-accent" /> : <Globe className="w-4.5 h-4.5 text-muted" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-heading flex items-center gap-2">
                  Private Group
                  {isPrivate ? (
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded">Private</span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded">Public</span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {isPrivate 
                    ? "Only group members can see posts and participant activity."
                    : "Anyone on Techmon can discover and view group posts."}
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-muted hover:text-heading transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingImage || !name.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#C4402A] text-white rounded-xl font-mono text-xs font-semibold uppercase tracking-wider hover:bg-[#A33420] disabled:opacity-50 transition-all shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Group"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
