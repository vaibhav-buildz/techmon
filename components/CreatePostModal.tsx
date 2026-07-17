"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { StickyNote, Image as ImageIcon, X, Upload, Check } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
};

const BACKGROUNDS = [
  { id: "white", class: "bg-white border border-border" },
  { id: "dark", class: "bg-gray-900" },
  { id: "pink-orange", class: "bg-gradient-to-br from-pink-400 to-orange-300" },
  { id: "blue-purple", class: "bg-gradient-to-br from-blue-500 to-purple-500" },
  { id: "green-emerald", class: "bg-gradient-to-br from-green-400 to-emerald-600" },
  { id: "yellow-red", class: "bg-gradient-to-br from-yellow-300 to-red-400" },
];

export default function CreatePostModal({ isOpen, onClose, userId }: Props) {
  const [postType, setPostType] = useState<"note" | "media">("note");
  const [content, setContent] = useState("");
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setFilePreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    if (postType === "note" && !content.trim()) return;
    if (postType === "media" && !file) {
      setError("Please select a photo or video to upload.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (postType === "media" && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("posts")
          .getPublicUrl(filePath);

        mediaUrl = publicUrlData.publicUrl;
        mediaType = file.type.startsWith("video/") ? "video" : "image";
      }

      const { error: insertError } = await supabase
        .from("posts")
        .insert({
          user_id: userId,
          type: postType,
          content: content,
          ...(postType === "note" && { background: background.class }),
          ...(postType === "media" && { media_url: mediaUrl, media_type: mediaType })
        });

      if (insertError) throw insertError;

      // Reset form
      setContent("");
      setBackground(BACKGROUNDS[0]);
      setFile(null);
      if (filePreview) URL.revokeObjectURL(filePreview);
      setFilePreview(null);
      setSuccess(true);
      
      // Notify other components to refresh
      window.dispatchEvent(new Event('postCreated'));
      
      // Close modal after brief delay
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = 
    postType === "media" 
      ? file !== null 
      : content.trim().length > 0;

  const isDarkText = background.id === "white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border shadow-xl rounded-2xl w-full max-w-[500px] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-heading font-semibold text-heading text-lg">Create Post</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-heading transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          
          {/* Tabs */}
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-xl">
              {[
                { id: "note", label: "Note", icon: StickyNote },
                { id: "media", label: "Photo/Video", icon: ImageIcon },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = postType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setPostType(tab.id as any);
                      if (tab.id !== "media") {
                        setFile(null);
                        if (filePreview) URL.revokeObjectURL(filePreview);
                        setFilePreview(null);
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      isActive 
                        ? "bg-accent text-white shadow-sm" 
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6">
            
            {/* Note Tab */}
            {postType === "note" && (
              <div className="space-y-6">
                <div className={`w-full aspect-square sm:aspect-video rounded-xl flex items-center justify-center p-6 transition-all duration-300 ${background.class}`}>
                  <textarea
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What's on your mind?"
                    className={`w-full bg-transparent border-0 focus:ring-0 text-center resize-none p-0 text-xl md:text-2xl font-medium placeholder-opacity-70 ${isDarkText ? "text-gray-800 placeholder-gray-400" : "text-white placeholder-white"}`}
                  />
                </div>
                
                <div className="flex items-center justify-center gap-3">
                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBackground(bg)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${bg.class} ${background.id === bg.id ? "ring-2 ring-accent ring-offset-2" : ""}`}
                      aria-label={`Select ${bg.id} background`}
                    >
                      {background.id === bg.id && (
                        <Check className={`w-4 h-4 ${bg.id === "white" ? "text-black" : "text-white"}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Media Tab */}
            {postType === "media" && (
              <div className="space-y-4">
                {!filePreview ? (
                  <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-border border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                        <Upload className="w-5 h-5 text-accent" />
                      </div>
                      <p className="mb-1 text-sm font-medium text-heading">Click or drag to upload</p>
                      <p className="text-xs text-gray-500">SVG, PNG, JPG, GIF or Video</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
                  </label>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden border border-border bg-black/5 aspect-video flex items-center justify-center">
                      {file?.type.startsWith("video/") ? (
                        <video src={filePreview} controls className="max-h-full max-w-full object-contain bg-black" />
                      ) : (
                        <img src={filePreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                      )}
                    </div>
                    
                    <div className="flex justify-center">
                      <label className="text-xs text-accent hover:underline cursor-pointer font-medium">
                        Change
                        <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
                      </label>
                    </div>

                    <textarea
                      rows={2}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Add an optional caption..."
                      className="w-full bg-transparent border-0 border-b border-border focus:ring-0 focus:border-accent text-body placeholder-gray-400 resize-none px-0 py-2 text-sm mt-2"
                    />
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 mt-4">
                {error}
              </div>
            )}
            
            {success && (
              <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200 mt-4">
                Post created successfully!
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-6 pt-0 mt-auto">
            <button
              type="submit"
              disabled={submitting || !isFormValid}
              className="w-full py-3 bg-accent text-white font-medium rounded-xl text-sm hover:bg-accent/90 transition-all disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              {submitting ? "Sharing..." : "Share"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
