"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import SkillsAutocomplete from "@/components/SkillsAutocomplete";
import { addAccount } from "@/lib/accountManager";
import { useAppProfile } from "@/components/AppLayoutWrapper";

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshProfile } = useAppProfile();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [username, setUsername] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"available" | "taken" | "invalid" | null>(null);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [organization, setOrganization] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  const generateSuggestions = async (user: any): Promise<string[]> => {
    const emailPrefix = user.email ? user.email.split("@")[0] : "";
    let base = emailPrefix.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");

    if (!base || base.length < 3) {
      base = (base + "_user").slice(0, 15);
    }
    base = base.slice(0, 18);

    const candidates = [
      base,
      `${base}_${Math.floor(10 + Math.random() * 90)}`,
      `${base}_dev`,
      `${base}${Math.floor(100 + Math.random() * 900)}`,
      `dev_${base.slice(0, 14)}`,
      `${base}_code`,
      `${base}_${Math.floor(100 + Math.random() * 900)}`,
    ];

    const uniqueCandidates = Array.from(new Set(candidates)).filter(
      (c) => c.length >= 3 && c.length <= 30
    );

    try {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .in("username", uniqueCandidates);

      const takenSet = new Set((data || []).map((p) => p.username));
      const available = uniqueCandidates.filter((c) => !takenSet.has(c));
      return available.slice(0, 4);
    } catch (err) {
      console.error("[Onboarding] Error checking suggestion availability:", err);
      return uniqueCandidates.slice(0, 4);
    }
  };

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

        if (profile && profile.username) {
          router.push(`/profile/${profile.username}`);
          return;
        } else if (profileError && profileError.code !== "PGRST116") { // PGRST116 is "No rows found"
          throw profileError;
        }

        // Auto-suggest name and email-based username suggestions
        const meta = user.user_metadata || {};
        const fullName = meta.full_name || meta.name || "";
        if (fullName) {
          setName(fullName);
        }

        const suggestedList = await generateSuggestions(user);
        setSuggestions(suggestedList);
        if (suggestedList.length > 0) {
          setUsername(suggestedList[0]);
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

      // Explicitly sync and verify profile state in AppLayoutWrapper prior to redirect
      await refreshProfile({
        id: userId,
        username: username.trim(),
        name,
        avatar_url: "",
        is_admin: false,
      });

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
    <div className="min-h-screen py-16 bg-background text-body flex items-center justify-center">
      <div className="w-full max-w-xl px-4">
        <div className="bg-surface border border-border rounded-none p-8 md:p-10 space-y-8 shadow-xs">
          <div className="text-left space-y-2">
            <h1 className="text-3xl font-heading font-bold tracking-tight text-heading">Complete your profile</h1>
            <p className="text-sm font-sans text-muted">Tell us a bit about yourself to complete your author card.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-6">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-heading mb-1.5">
                  Username
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-0 text-muted font-mono text-sm select-none">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    className="w-full pl-6 pr-3 py-2 bg-transparent border-b-2 border-border focus:border-accent text-sm font-mono text-heading placeholder-gray-400 focus:outline-none transition-colors rounded-none"
                    placeholder="username"
                    maxLength={30}
                  />
                </div>
                {checkingUsername && (
                  <p className="text-xs font-mono text-muted mt-1">
                    Checking availability...
                  </p>
                )}
                {!checkingUsername && usernameStatus === "available" && (
                  <p className="text-xs font-mono text-green-700 font-medium mt-1">
                    ✓ Username is available
                  </p>
                )}
                {!checkingUsername && (usernameStatus === "taken" || usernameStatus === "invalid") && (
                  <p className="text-xs font-mono text-red-600 font-medium mt-1">
                    ✕ {usernameMessage}
                  </p>
                )}

                {suggestions.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-mono uppercase tracking-wider text-muted">Suggested usernames:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => handleUsernameChange(sug)}
                          className={`px-2.5 py-1 text-xs rounded-none border transition-all font-mono ${
                            username === sug
                              ? "border-accent bg-accent text-white"
                              : "border-border text-heading bg-surface hover:border-heading"
                          }`}
                        >
                          @{sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs font-mono text-muted mt-1.5">Only lowercase letters, numbers, and underscores</p>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-heading mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-transparent border-b-2 border-border focus:border-accent text-sm text-heading placeholder-gray-400 focus:outline-none transition-colors rounded-none"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-heading mb-1.5">
                  Headline (what do you do?)
                </label>
                <input
                  type="text"
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-transparent border-b-2 border-border focus:border-accent text-sm text-heading placeholder-gray-400 focus:outline-none transition-colors rounded-none font-mono"
                  placeholder="e.g. Full Stack Developer | Final Year CS Student"
                />
                <p className="text-xs text-muted mt-1">A short line describing your role or focus area</p>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-heading mb-1.5">
                  College / Company
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full px-3 py-2 bg-transparent border-b-2 border-border focus:border-accent text-sm text-heading placeholder-gray-400 focus:outline-none transition-colors rounded-none"
                  placeholder="e.g. IEC College of Engineering, or Google"
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-heading mb-1.5">
                  Bio
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border focus:border-accent text-sm text-heading placeholder-gray-400 focus:outline-none transition-colors rounded-none resize-none"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-heading mb-1.5">
                  Skills
                </label>
                <SkillsAutocomplete skills={skills} onChange={setSkills} />
                <p className="text-xs text-muted mt-2">Start typing to see suggestions, or press Enter/comma to add a custom skill.</p>
              </div>
            </div>

            {error && (
              <div className="font-mono text-xs text-red-600 bg-red-50 p-3 border border-red-200 rounded-none">
                {error}
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-accent text-white font-mono text-xs uppercase tracking-wider hover:bg-accent/90 transition-colors border border-accent disabled:opacity-50 rounded-none"
              >
                {submitting ? "Saving..." : "Complete Profile"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
