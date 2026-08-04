"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, FileText, Upload } from "lucide-react";
import SkillsAutocomplete from "@/components/SkillsAutocomplete";

export default function EditProfilePage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"available" | "taken" | "invalid" | null>(null);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [organization, setOrganization] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [resumeUrl, setResumeUrl] = useState("");
  const [uploadingResume, setUploadingResume] = useState(false);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        if (profile) {
          setUsername(profile.username || "");
          setOriginalUsername(profile.username || "");
          setName(profile.name || "");
          setHeadline(profile.headline || "");
          setOrganization(profile.organization || "");
          setBio(profile.bio || "");
          setSkills(profile.skills || []);
          setGithubUrl(profile.github_url || "");
          setLinkedinUrl(profile.linkedin_url || "");
          setPortfolioUrl(profile.portfolio_url || "");
          setAvatarUrl(profile.avatar_url || "");
          setResumeUrl(profile.resume_url || "");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndProfile();
  }, [router]);

  // Debounced username availability check
  useEffect(() => {
    if (!username.trim()) {
      setUsernameStatus(null);
      setUsernameMessage(null);
      setCheckingUsername(false);
      return;
    }

    if (username.length < 3) {
      setUsernameStatus("invalid");
      setUsernameMessage("Username must be at least 3 characters");
      setCheckingUsername(false);
      return;
    }

    if (username === originalUsername) {
      setUsernameStatus("available");
      setUsernameMessage("This is your current username");
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);
    setUsernameStatus(null);
    setUsernameMessage(null);

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .neq("id", userId || "");

        if (error) throw error;

        if (data && data.length > 0) {
          setUsernameStatus("taken");
          setUsernameMessage("Username is taken");
        } else {
          setUsernameStatus("available");
          setUsernameMessage("Username is available");
        }
      } catch (err) {
        console.error("[EditProfile] Error checking username:", err);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, originalUsername, userId]);

  const handleUsernameChange = (val: string) => {
    const sanitized = val.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(sanitized);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingAvatar(true);
      setError(null);

      if (!e.target.files || e.target.files.length === 0) {
        throw new Error("You must select an image to upload.");
      }

      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingResume(true);
      setError(null);

      if (!e.target.files || e.target.files.length === 0) {
        throw new Error("You must select a PDF file to upload.");
      }

      const file = e.target.files[0];
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Only PDF files are allowed.");
      }

      const filePath = `${userId}/resume.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, { upsert: true, contentType: "application/pdf" });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("resumes").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;
      setResumeUrl(publicUrl);

      if (userId) {
        await supabase.from("profiles").update({ resume_url: publicUrl }).eq("id", userId);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingResume(false);
    }
  };

  const handleRemoveResume = async () => {
    try {
      setUploadingResume(true);
      setError(null);
      setResumeUrl("");

      if (userId) {
        await supabase.storage.from("resumes").remove([`${userId}/resume.pdf`]);
        await supabase.from("profiles").update({ resume_url: null }).eq("id", userId);
      }
    } catch (err: any) {
      console.error("[EditProfile] Error removing resume:", err);
    } finally {
      setUploadingResume(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (!username.trim() || username.length < 3) {
      setError("Please enter a valid username (at least 3 characters).");
      return;
    }

    if (usernameStatus === "taken") {
      setError("Username is taken. Please choose another one.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          name,
          headline,
          organization,
          bio,
          skills: skills,
          github_url: githubUrl,
          linkedin_url: linkedinUrl,
          portfolio_url: portfolioUrl,
          avatar_url: avatarUrl,
          resume_url: resumeUrl || null,
        })
        .eq("id", userId);

      if (error) throw error;

      router.push(`/profile/${username.trim()}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const inputStyle = "w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm text-heading placeholder-gray-400 transition-all font-sans";
  const labelStyle = "block text-sm font-medium text-heading mb-1.5";
  const fieldGroupStyle = "space-y-1.5";
  const sectionStyle = "bg-surface border border-border shadow-sm rounded-xl p-6 space-y-4";
  const sectionHeaderStyle = "font-mono text-xs uppercase tracking-wider text-accent font-semibold mb-2";

  if (loading) {
    return (
      <div className="min-h-screen py-12 bg-background text-body">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-border shadow-sm rounded-xl p-6 space-y-6 animate-pulse">
              <div className="w-20 h-20 rounded-full bg-gray-200" />
              <div className="h-10 bg-gray-200 rounded w-full" />
              <div className="h-10 bg-gray-200 rounded w-full" />
            </div>
            <div className="bg-surface border border-border shadow-sm rounded-xl p-6 space-y-6 animate-pulse">
              <div className="h-28 bg-gray-200 rounded w-full" />
              <div className="h-10 bg-gray-200 rounded w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-body">
        <div className="text-center space-y-4">
          <div className="text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 max-w-md">
            Error loading profile: {error}
          </div>
          <Link href="/" className="text-sm text-accent hover:underline font-medium">
            Return home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 bg-background text-body">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-heading">Edit Profile</h1>
            <p className="text-body mt-1 text-sm">Update your personal information, links, and resume.</p>
          </div>
          {userId && (
            <Link
              href={`/profile/${originalUsername || userId}`}
              className="text-sm font-medium text-body hover:text-accent transition-colors px-4 py-2 border border-border rounded-xl bg-surface"
            >
              Cancel
            </Link>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* LEFT COLUMN: Basic Info (Section 1) & Resume (Section 5) */}
            <div className="space-y-6">
              
              {/* SECTION 1: BASIC INFO */}
              <div className={sectionStyle}>
                <h2 className={sectionHeaderStyle}>&gt; BASIC INFO</h2>
                
                <div className="space-y-4">
                  {/* Avatar Field */}
                  <div className={fieldGroupStyle}>
                    <label className={labelStyle}>Avatar</label>
                    <div className="flex items-center gap-5 pt-1">
                      <div className="relative group shrink-0">
                        <div className="w-20 h-20 rounded-full overflow-hidden border border-border shadow-sm bg-gray-100 flex items-center justify-center">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt="Avatar"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-gray-500 font-bold text-2xl">
                              {name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          )}
                        </div>

                        {/* Circular Pencil Icon Overlay */}
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="absolute bottom-0 right-0 w-7 h-7 bg-[#1A1A1A] hover:bg-[#DC2626] text-white rounded-full flex items-center justify-center border-2 border-surface shadow-md transition-colors cursor-pointer disabled:opacity-50"
                          title="Upload Avatar"
                        >
                          {uploadingAvatar ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Pencil className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Hidden File Input */}
                      <input
                        type="file"
                        accept="image/*"
                        ref={avatarInputRef}
                        onChange={handleAvatarUpload}
                        disabled={uploadingAvatar}
                        className="hidden"
                      />

                      <div className="flex-1 min-w-0">
                        {uploadingAvatar ? (
                          <p className="text-xs font-medium text-accent animate-pulse">Uploading avatar image...</p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            className="text-xs font-semibold text-heading hover:text-accent transition-colors block mb-1 text-left"
                          >
                            Change profile picture
                          </button>
                        )}
                        <p className="text-xs text-gray-400">Recommended: Square PNG/JPG image</p>
                      </div>
                    </div>
                  </div>

                  {/* Username Field */}
                  <div className={fieldGroupStyle}>
                    <label className={labelStyle}>Username</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-gray-400 font-mono text-sm select-none">
                        @
                      </span>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        className={`w-full pl-9 pr-3.5 py-2.5 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm font-mono text-heading placeholder-gray-400 transition-all`}
                        placeholder="username"
                        maxLength={30}
                      />
                    </div>
                    {checkingUsername && (
                      <p className="text-xs text-gray-500 mt-1">Checking availability...</p>
                    )}
                    {!checkingUsername && usernameStatus === "available" && (
                      <p className="text-xs text-green-600 font-medium mt-1">✓ {usernameMessage}</p>
                    )}
                    {!checkingUsername && (usernameStatus === "taken" || usernameStatus === "invalid") && (
                      <p className="text-xs text-red-600 font-medium mt-1">✕ {usernameMessage}</p>
                    )}
                  </div>

                  {/* Full Name Field */}
                  <div className={fieldGroupStyle}>
                    <label className={labelStyle}>Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputStyle}
                      placeholder="Jane Doe"
                    />
                  </div>

                  {/* Headline Field */}
                  <div className={fieldGroupStyle}>
                    <label className={labelStyle}>Headline</label>
                    <input
                      type="text"
                      required
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      className={inputStyle}
                      placeholder="e.g. Full Stack Developer | CS Student"
                    />
                  </div>

                  {/* College / Company Field */}
                  <div className={fieldGroupStyle}>
                    <label className={labelStyle}>College / Company</label>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className={inputStyle}
                      placeholder="e.g. IEC College of Engineering, or Google"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: RESUME */}
              <div className={sectionStyle}>
                <h2 className={sectionHeaderStyle}>&gt; RESUME</h2>
                
                <div className={fieldGroupStyle}>
                  <label className={labelStyle}>PDF Resume</label>
                  
                  {/* Hidden File Input */}
                  <input
                    type="file"
                    accept="application/pdf"
                    ref={resumeInputRef}
                    onChange={handleResumeUpload}
                    disabled={uploadingResume}
                    className="hidden"
                  />

                  {resumeUrl ? (
                    <div className="flex items-center justify-between p-4 bg-gray-50/80 border border-border rounded-xl shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-[#DC2626]/10 text-[#DC2626] rounded-lg shrink-0">
                          <FileText className="w-5 h-5 text-[#DC2626]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-mono text-heading truncate font-semibold">resume.pdf</div>
                          <div className="text-xs text-gray-400 font-mono">PDF Document</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <a
                          href={resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-accent hover:underline font-semibold"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => resumeInputRef.current?.click()}
                          disabled={uploadingResume}
                          className="text-xs font-mono text-heading hover:underline font-semibold"
                        >
                          {uploadingResume ? "Uploading..." : "Replace"}
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveResume}
                          disabled={uploadingResume}
                          className="text-xs font-mono text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => resumeInputRef.current?.click()}
                      disabled={uploadingResume}
                      className="w-full border-2 border-dashed border-border hover:border-accent bg-gray-50/50 hover:bg-gray-100/50 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group disabled:opacity-50"
                    >
                      <div className="p-3 bg-surface border border-border rounded-full text-[#DC2626] group-hover:scale-110 transition-transform shadow-sm">
                        {uploadingResume ? (
                          <div className="w-5 h-5 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-heading block">
                          {uploadingResume ? "Uploading Resume..." : "Upload Resume (PDF)"}
                        </span>
                        <span className="text-xs text-gray-400 block mt-0.5">Click to browse PDF document</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Bio (Section 2), Skills (Section 3), Social Links (Section 4) */}
            <div className="space-y-6">
              
              {/* SECTION 2: BIO */}
              <div className={sectionStyle}>
                <h2 className={sectionHeaderStyle}>&gt; BIO</h2>
                <div className={fieldGroupStyle}>
                  <label className={labelStyle}>About You</label>
                  <textarea
                    rows={5}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className={`${inputStyle} resize-none`}
                    placeholder="Tell the community about yourself, your background, and goals..."
                  />
                </div>
              </div>

              {/* SECTION 3: SKILLS */}
              <div className={sectionStyle}>
                <h2 className={sectionHeaderStyle}>&gt; SKILLS</h2>
                <div className={fieldGroupStyle}>
                  <label className={labelStyle}>Technical & Design Skills</label>
                  <SkillsAutocomplete skills={skills} onChange={setSkills} />
                  <p className="text-xs text-gray-400 mt-1.5">Type to see suggestions or press Enter/comma to add custom skills</p>
                </div>
              </div>

              {/* SECTION 4: SOCIAL LINKS */}
              <div className={sectionStyle}>
                <h2 className={sectionHeaderStyle}>&gt; SOCIAL LINKS</h2>
                
                <div className="space-y-4">
                  {/* GitHub URL */}
                  <div className={fieldGroupStyle}>
                    <label className={labelStyle}>GitHub URL</label>
                    <input
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      className={inputStyle}
                      placeholder="https://github.com/username"
                    />
                  </div>

                  {/* LinkedIn URL */}
                  <div className={fieldGroupStyle}>
                    <label className={labelStyle}>LinkedIn URL</label>
                    <input
                      type="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      className={inputStyle}
                      placeholder="https://linkedin.com/in/username"
                    />
                  </div>

                  {/* Portfolio URL */}
                  <div className={fieldGroupStyle}>
                    <label className={labelStyle}>Portfolio URL</label>
                    <input
                      type="url"
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                      className={inputStyle}
                      placeholder="https://yourwebsite.com"
                    />
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* BOTTOM ACTION BAR */}
          <div className="bg-surface border border-border shadow-sm rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-500">
              {error ? (
                <span className="text-red-600 font-medium">✕ {error}</span>
              ) : (
                <span>All changes will be saved to your public profile.</span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {userId && (
                <Link
                  href={`/profile/${originalUsername || userId}`}
                  className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-body hover:text-heading hover:bg-gray-50 transition-colors text-center"
                >
                  Cancel
                </Link>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-7 py-2.5 bg-[#DC2626] text-white font-medium rounded-xl text-sm hover:bg-[#DC2626]/90 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 shadow-sm"
              >
                {submitting ? "Saving Changes..." : "Save Profile"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
