"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EditProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [organization, setOrganization] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
          setName(profile.name || "");
          setHeadline(profile.headline || "");
          setOrganization(profile.organization || "");
          setBio(profile.bio || "");
          setSkills(profile.skills ? profile.skills.join(", ") : "");
          setGithubUrl(profile.github_url || "");
          setLinkedinUrl(profile.linkedin_url || "");
          setPortfolioUrl(profile.portfolio_url || "");
          setAvatarUrl(profile.avatar_url || "");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndProfile();
  }, [router]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setSubmitting(true);
    setError(null);

    const skillsArray = skills
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name,
          headline,
          organization,
          bio,
          skills: skillsArray,
          github_url: githubUrl,
          linkedin_url: linkedinUrl,
          portfolio_url: portfolioUrl,
          avatar_url: avatarUrl,
        })
        .eq("id", userId);

      if (error) throw error;

      router.push(`/profile/${userId}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-body">
        <div className="text-gray-400 animate-pulse font-medium">Loading profile data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-body">
        <div className="text-center space-y-4">
          <div className="text-red-600 bg-red-50 p-4 rounded-lg border border-red-100 max-w-md">
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
    <div className="min-h-screen py-16 bg-background text-body">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-heading">Edit Profile</h1>
            <p className="text-body mt-2 text-sm">Update your personal information and links.</p>
          </div>
          {userId && (
            <Link
              href={`/profile/${userId}`}
              className="text-sm font-medium text-body hover:text-accent transition-colors"
            >
              Cancel
            </Link>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8">
          
          {/* Left Column (Sticky Sidebar) */}
          <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-6 h-fit lg:sticky lg:top-24">
            
            <div>
              <label className="block text-sm font-medium text-heading mb-2">
                Avatar
              </label>
              <div className="flex flex-col gap-4">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar preview"
                    className="w-20 h-20 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-background border border-border flex items-center justify-center text-gray-400 text-xs font-medium">
                    None
                  </div>
                )}
                <div>
                  <label className={`cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors ${uploadingAvatar ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingAvatar ? "Uploading..." : "Change photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-border my-4"></div>

            <div>
              <label className="block text-sm font-medium text-heading mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-heading mb-1">
                Headline
              </label>
              <input
                type="text"
                required
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow font-mono"
                placeholder="Software Engineer at Acme Corp"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-heading mb-1">
                Organization
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow"
                placeholder="Acme Corp"
              />
            </div>

            <div className="w-full h-px bg-border my-6"></div>

            <h3 className="font-mono text-xs uppercase text-accent mb-4">&gt; Social Links</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-heading mb-1">
                  GitHub URL
                </label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow"
                  placeholder="https://github.com/username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-heading mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-heading mb-1">
                  Portfolio URL
                </label>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow"
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8 flex flex-col">
            
            <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="font-mono text-xs uppercase text-accent">&gt; About</h2>
              <div>
                <textarea
                  rows={6}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow resize-none"
                  placeholder="Tell us about yourself..."
                />
              </div>
            </div>

            <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-4">
              <h2 className="font-mono text-xs uppercase text-accent">&gt; Skills</h2>
              <div>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow font-mono"
                  placeholder="React, TypeScript, Node.js (comma separated)"
                />
                <p className="text-xs text-body mt-2">Enter skills separated by commas.</p>
                {skills.trim().length > 0 && (
                  <div className="flex flex-wrap gap-2.5 mt-4 pt-4 border-t border-border">
                    {skills.split(',').map((s) => s.trim()).filter((s) => s.length > 0).map((skill, idx) => (
                      <span
                        key={idx}
                        className="font-mono text-xs bg-blue-50 border-l-2 border-accent px-3 py-1 text-accent rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 mb-4">
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full lg:w-auto py-2.5 px-6 bg-accent text-white font-medium rounded-lg text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                >
                  {submitting ? "Saving Changes..." : "Save Profile"}
                </button>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
