"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, Link as LinkIcon, Check } from "lucide-react";

type Profile = {
  id: string;
  name: string;
  avatar_url?: string;
  headline?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  currentUserId: string | null;
};

export default function SharePostModal({ isOpen, onClose, postId, currentUserId }: Props) {
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && currentUserId) {
      fetchFollowers();
    }
  }, [isOpen, currentUserId]);

  const fetchFollowers = async () => {
    setLoading(true);
    try {
      // Fetch users the current user follows
      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId);

      if (followsError) throw followsError;

      const followingIds = follows?.map(f => f.following_id) || [];
      if (followingIds.length === 0) {
        setFollowers([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, headline, username")
        .in("id", followingIds);

      if (profilesError) throw profilesError;

      setFollowers(profiles || []);
    } catch (err) {
      console.error("Error fetching followers to share:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleSend = () => {
    alert("Messaging coming soon");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-surface border border-border shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface shrink-0">
          <h2 className="font-heading font-semibold text-lg text-heading">Share post</h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Send to</h3>
          {loading ? (
            <div className="flex justify-center p-4">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : followers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">You aren't following anyone yet.</p>
          ) : (
            <div className="space-y-3">
              {followers.map(user => (
                <div key={user.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm text-heading">{user.name}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleSend}
                    className="px-4 py-1.5 text-sm font-medium bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-full transition-colors"
                  >
                    Send
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 bg-gray-50/50 shrink-0">
          <button 
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:bg-gray-50 transition-colors text-left"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
              {copied ? <Check className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <span className="font-medium text-heading block">Copy Link</span>
              <span className="text-xs text-body block">Share this post anywhere</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
