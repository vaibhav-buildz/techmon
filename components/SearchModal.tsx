"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type ProfileResult = {
  id: string;
  name: string;
  headline: string;
  avatar_url?: string;
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-surface w-full max-w-lg rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search people..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-heading placeholder:text-gray-400 text-lg"
          />
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-heading">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {!query.trim() ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Search for people by name
            </div>
          ) : loading ? (
            <div className="p-8 text-center text-gray-400 text-sm animate-pulse">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="py-2">
              {results.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    onClose();
                    router.push(`/profile/${profile.id}`);
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
