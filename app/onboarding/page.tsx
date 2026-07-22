"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import SkillsAutocomplete from "@/components/SkillsAutocomplete";
import { addAccount } from "@/lib/accountManager";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [username, setUsername] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"available" | "taken" | "invalid" | null>(null);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [organization, setOrganization] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);

        // Check if profile already exists
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profile) {
          router.push(`/profile/${profile.username || user.id}`);
        } else if (profileError && profileError.code !== "PGRST116") { // PGRST116 is "No rows found"
          throw profileError;
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
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

    setCheckingUsername(true);
    setUsernameStatus(null);
    setUsernameMessage(null);

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username);

        if (error) throw error;

        if (data && data.length > 0) {
          setUsernameStatus("taken");
          setUsernameMessage("Username is taken");
        } else {
          setUsernameStatus("available");
          setUsernameMessage("Username is available");
        }
      } catch (err) {
        console.error("[Onboarding] Error checking username:", err);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleUsernameChange = (val: string) => {
    // Only allow lowercase letters, numbers, underscores
    const sanitized = val.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(sanitized);
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
      const { error } = await supabase.from("profiles").insert({
        id: userId,
        username: username.trim(),
        name,
        headline,
        organization,
        bio,
        skills: skills,
      });

      if (error) throw error;

      // Update account in savedAccounts
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        addAccount(session, { name, avatar_url: "" });
      }

      router.push(`/profile/${username.trim()}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-12 bg-background text-body">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center md:justify-start">
          <div className="w-full max-w-xl">
            <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-8 animate-pulse">
              <div className="space-y-3">
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
              <div className="space-y-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className={i === 4 ? "h-24 bg-gray-200 rounded w-full" : "h-10 bg-gray-200 rounded w-full"}></div>
                  </div>
                ))}
                <div className="h-10 bg-gray-200 rounded w-full mt-4"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 bg-background text-body">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center md:justify-start">
        <div className="w-full max-w-xl">
          <div className="bg-surface border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-8">
          <div className="text-left">
            <h1 className="text-2xl font-heading font-bold tracking-tight text-heading">Complete your profile</h1>
            <p className="text-sm text-body mt-2">Tell us a bit about yourself to get started.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-heading mb-1">
                  Username
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-gray-500 font-mono text-sm select-none">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm font-mono placeholder-gray-400 transition-shadow"
                    placeholder="username"
                    maxLength={30}
                  />
                </div>
                {checkingUsername && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    Checking availability...
                  </p>
                )}
                {!checkingUsername && usernameStatus === "available" && (
                  <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
                    ✓ Username is available
                  </p>
                )}
                {!checkingUsername && (usernameStatus === "taken" || usernameStatus === "invalid") && (
                  <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                    ✕ {usernameMessage}
                  </p>
                )}
                <p className="text-xs text-body mt-1">Only lowercase letters, numbers, and underscores</p>
              </div>

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
                  Headline (what do you do?)
                </label>
                <input
                  type="text"
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow font-mono"
                  placeholder="e.g. Full Stack Developer | Final Year CS Student"
                />
                <p className="text-xs text-body mt-1">A short line describing your role or focus area</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-heading mb-1">
                  College / Company
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow"
                  placeholder="e.g. IEC College of Engineering, or Google"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-heading mb-1">
                  Bio
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-sm placeholder-gray-400 transition-shadow resize-none"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-heading mb-1">
                  Skills
                </label>
                <SkillsAutocomplete skills={skills} onChange={setSkills} />
                <p className="text-xs text-body mt-2">Start typing to see suggestions, or press Enter/comma to add a custom skill.</p>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-accent text-white font-medium rounded-lg text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              >
                {submitting ? "Saving..." : "Complete Profile"}
              </button>
            </div>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
