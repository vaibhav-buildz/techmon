"use client";

import { useState, useEffect } from "react";
import { Search, X, Users, Frown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type ProfileResult = {
  id: string;
  name: string;
  headline: string;
  avatar_url?: string;
  username?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SearchModal({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // Debounce logic
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, headline, avatar_url")
          .ilike("name", `%${query}%`)
          .limit(10);
          
        if (error) throw error;
        setResults(data || []);
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset query on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 md:pt-24 px-4" onClick={onClose}>
      <div 
        className="bg-surface border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-border h-14 bg-surface">
          <Search className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search developers by name or @username..."
            className="w-full bg-transparent text-heading placeholder-gray-400 focus:outline-none text-base font-medium"
          />
          {query && (
            <button 
              onClick={() => setQuery("")}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-heading transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Area */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span>Searching...</span>
            </div>
          ) : !query.trim() ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Type a name or @username to search profiles
            </div>
          ) : results.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm flex flex-col items-center gap-3">
              <Frown className="w-8 h-8 text-gray-300" />
              <p>No results found for "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    onClose();
                    router.push(`/profile/${profile.username || profile.id}`);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name} className="w-12 h-12 rounded-full object-cover shrink-0 border border-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-lg font-medium text-gray-500 shrink-0 border border-border">
                      {profile.name ? profile.name.charAt(0).toUpperCase() : "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-semibold text-heading truncate">{profile.name}</p>
                    <p className="text-sm text-gray-500 truncate">{profile.headline || 'No headline'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
